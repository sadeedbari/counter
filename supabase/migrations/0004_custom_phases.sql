-- Per-shop workflow phases replace the fixed job_status enum.
-- Each phase has a role (kind): 'active' sends nothing, 'ready' sends the pickup message,
-- 'closed' sends the thank-you and counts the job as finished.

create table phases (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  name text not null,
  position int not null,
  color text not null default 'gray',
  kind text not null default 'active' check (kind in ('active', 'ready', 'closed')),
  unique (id, store_id)
);
create index phases_store on phases (store_id, position);

alter table phases enable row level security;
revoke all on phases from anon, authenticated;
grant select on phases to authenticated;
create policy phases_read on phases for select to authenticated using (store_id = (select my_store()));

-- The starting template. Editing happens through set_phases() only.
create function seed_default_phases(p_store uuid) returns void
  language sql security definer set search_path = public as $$
  insert into phases (store_id, name, position, color, kind) values
    (p_store, 'New', 0, 'blue', 'active'),
    (p_store, 'In Progress', 1, 'orange', 'active'),
    (p_store, 'Complete', 2, 'teal', 'active'),
    (p_store, 'Ready for Pickup', 3, 'green', 'ready'),
    (p_store, 'Closed', 4, 'gray', 'closed')
$$;
revoke all on function seed_default_phases(uuid) from public, anon, authenticated;

do $$ declare s record; begin
  for s in select id from stores loop perform seed_default_phases(s.id); end loop;
end $$;

-- Move jobs from the status enum to phases.
alter table jobs add column phase_id uuid;
update jobs j set phase_id = p.id from phases p
  where p.store_id = j.store_id and p.name = case j.status::text
    when 'new' then 'New' when 'in_progress' then 'In Progress' when 'complete' then 'Complete'
    when 'ready' then 'Ready for Pickup' else 'Closed' end;
alter table jobs alter column phase_id set not null;
alter table jobs add foreign key (phase_id, store_id) references phases (id, store_id) on delete restrict;

drop trigger jobs_status on jobs;
drop index jobs_board;
alter table jobs drop column status;
drop type job_status;
create index jobs_board on jobs (store_id, phase_id, updated_at desc);

create or replace function on_job_status() returns trigger
  language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if new.phase_id is distinct from old.phase_id then
    new.updated_at := now();
    select kind into k from phases where id = new.phase_id;
    -- Workflow edits move jobs silently (counter.silent); only real moves message the customer.
    if new.notify and k in ('ready', 'closed') and coalesce(current_setting('counter.silent', true), '') <> 'on' then
      perform queue_messages(new.id, k, false);
    end if;
  end if;
  return new;
end $$;
revoke all on function on_job_status() from public, anon, authenticated;
create trigger jobs_phase before update of phase_id on jobs for each row execute function on_job_status();

create or replace function create_store(p_name text) returns uuid
  language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then raise exception 'already has a store'; end if;
  insert into stores (name) values (coalesce(nullif(trim(p_name), ''), 'My Shop')) returning id into sid;
  insert into members (store_id, user_id, name, role)
    values (sid, auth.uid(), coalesce((select split_part(email, '@', 1) from auth.users where id = auth.uid()), 'Owner'), 'owner');
  perform seed_default_phases(sid);
  return sid;
end $$;

-- Replace the whole workflow in one step. p_phases is an ordered array of
-- {id?, name, color, kind}. Phases without an id are created; phases left out are removed and
-- their jobs move (without messaging anyone) to the phase now at the same position.
create function set_phases(p_phases jsonb) returns void
  language plpgsql security definer set search_path = public as $$
declare
  sid uuid := my_store(); n int; i int; el jsonb; pid uuid;
  keep uuid[] := '{}'; gone record; target uuid;
begin
  if sid is null then raise exception 'no store'; end if;
  n := jsonb_array_length(p_phases);
  if n < 1 or n > 10 then raise exception 'Use between 1 and 10 phases'; end if;
  for i in 0 .. n - 1 loop
    el := p_phases -> i;
    if coalesce(trim(el ->> 'name'), '') = '' then raise exception 'Every phase needs a name'; end if;
    if coalesce(el ->> 'kind', 'active') not in ('active', 'ready', 'closed') then raise exception 'Invalid phase role'; end if;
  end loop;

  perform set_config('counter.silent', 'on', true);

  for i in 0 .. n - 1 loop
    el := p_phases -> i;
    pid := nullif(el ->> 'id', '')::uuid;
    if pid is not null and exists (select 1 from phases where id = pid and store_id = sid) then
      update phases set name = trim(el ->> 'name'), position = i,
        color = coalesce(el ->> 'color', 'gray'), kind = coalesce(el ->> 'kind', 'active')
        where id = pid;
    else
      insert into phases (store_id, name, position, color, kind)
        values (sid, trim(el ->> 'name'), i, coalesce(el ->> 'color', 'gray'), coalesce(el ->> 'kind', 'active'))
        returning id into pid;
    end if;
    keep := keep || pid;
  end loop;

  for gone in select id, position from phases where store_id = sid and id <> all (keep) loop
    select id into target from phases where store_id = sid and id = any (keep) and position = least(gone.position, n - 1);
    update jobs set phase_id = target where phase_id = gone.id;
    delete from phases where id = gone.id;
  end loop;
end $$;
revoke all on function set_phases(jsonb) from public, anon;
grant execute on function set_phases(jsonb) to authenticated;
