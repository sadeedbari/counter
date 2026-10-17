-- Counter: multi-tenant schema. One Supabase project, many stores, isolated by RLS.

create extension if not exists pg_net with schema extensions;

create type job_status as enum ('new', 'in_progress', 'complete', 'ready', 'closed');

create table stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  review_link text not null default '',
  ready_message text not null default 'Hi {{name}}, your {{item}} is ready for pickup at {{store}}. See you soon!',
  closed_message text not null default 'Thanks for visiting {{store}}, {{name}}! If we did right by you, a quick review means the world to us: {{review_link}}',
  created_at timestamptz not null default now()
);

create table members (            -- staff who can sign in, and people a job can be assigned to
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  user_id uuid unique references auth.users on delete set null,
  name text not null,
  role text not null default 'staff' check (role in ('owner', 'staff'))
);
create index members_store on members (store_id);

create table customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  check (email is not null or phone is not null)
);
create unique index customers_email_uq on customers (store_id, lower(email)) where email is not null;
create unique index customers_phone_uq on customers (store_id, phone) where phone is not null;

create table jobs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  customer_id uuid not null references customers on delete restrict,
  item text not null,
  notes text not null default '',
  photo_path text,                                    -- Storage bucket "job-photos", {store_id}/{job_id}.jpg
  status job_status not null default 'new',
  assignee_id uuid references members on delete set null,
  notify boolean not null default true,               -- the "automatic messages" checkbox
  intake_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_board on jobs (store_id, status, updated_at desc);
create index jobs_customer on jobs (customer_id);
create index jobs_assignee on jobs (assignee_id);

create table job_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references jobs on delete cascade,
  text text not null,
  at timestamptz not null default now()
);
create index job_events_job on job_events (job_id, at);

create table messages (           -- outbox and delivery log
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  job_id uuid not null references jobs on delete cascade,
  customer_id uuid not null references customers on delete cascade,
  channel text not null check (channel in ('email', 'sms')),
  kind text not null check (kind in ('ready', 'closed')),
  to_address text not null,
  subject text,
  body text not null,
  provider_id text,                                    -- Resend / Twilio message id
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed')),
  error text,
  at timestamptz not null default now(),
  unique (job_id, kind, channel)                       -- one message per job/kind/channel unless resent
);
create index messages_store on messages (store_id, at desc);
create index messages_customer on messages (customer_id);

-- ── row-level security ──
create function my_store() returns uuid
  language sql stable security definer set search_path = public as
  $$ select store_id from members where user_id = (select auth.uid()) limit 1 $$;
revoke all on function my_store() from public, anon;
grant execute on function my_store() to authenticated;

alter table stores enable row level security;
alter table members enable row level security;
alter table customers enable row level security;
alter table jobs enable row level security;
alter table job_events enable row level security;
alter table messages enable row level security;

create policy own_store on stores for all to authenticated using (id = (select my_store())) with check (id = (select my_store()));
create policy own_members on members for all to authenticated using (store_id = (select my_store())) with check (store_id = (select my_store()));
create policy own_customers on customers for all to authenticated using (store_id = (select my_store())) with check (store_id = (select my_store()));
create policy own_jobs on jobs for all to authenticated using (store_id = (select my_store())) with check (store_id = (select my_store()));
create policy own_events on job_events for all to authenticated
  using (job_id in (select id from jobs where store_id = (select my_store())))
  with check (job_id in (select id from jobs where store_id = (select my_store())));
create policy own_messages on messages for select to authenticated using (store_id = (select my_store()));

-- ── onboarding: first sign-in creates the store ──
create function create_store(p_name text) returns uuid
  language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then raise exception 'already has a store'; end if;
  insert into stores (name) values (coalesce(nullif(trim(p_name), ''), 'My Shop')) returning id into sid;
  insert into members (store_id, user_id, name, role)
    values (sid, auth.uid(), coalesce((select split_part(email, '@', 1) from auth.users where id = auth.uid()), 'Owner'), 'owner');
  return sid;
end $$;
revoke all on function create_store(text) from public, anon;
grant execute on function create_store(text) to authenticated;

-- ── automatic messages ──
create function render_template(t text, c customers, j jobs, s stores) returns text
  language sql immutable set search_path = public as $$
  select replace(replace(replace(replace(t,
    '{{name}}', coalesce(nullif(split_part(c.name, ' ', 1), ''), c.name)),
    '{{item}}', j.item),
    '{{store}}', s.name),
    '{{review_link}}', s.review_link)
$$;

-- Queue the email and/or text for a job. force=true re-queues rows that already exist (resend).
create function queue_messages(p_job uuid, p_kind text, p_force boolean) returns void
  language plpgsql security definer set search_path = public as $$
declare j jobs; c customers; s stores; body text; subj text;
begin
  select * into j from jobs where id = p_job;
  select * into c from customers where id = j.customer_id;
  select * into s from stores where id = j.store_id;
  body := render_template(case when p_kind = 'ready' then s.ready_message else s.closed_message end, c, j, s);
  subj := case when p_kind = 'ready' then 'Your ' || j.item || ' is ready for pickup' else 'Thank you from ' || s.name end;

  if c.email is not null then
    insert into messages (store_id, job_id, customer_id, channel, kind, to_address, subject, body)
      values (j.store_id, j.id, c.id, 'email', p_kind, c.email, subj, body)
      on conflict (job_id, kind, channel) do update
        set status = 'queued', error = null, at = now(), body = excluded.body, subject = excluded.subject, to_address = excluded.to_address
        where p_force;
  end if;
  if c.phone is not null then
    insert into messages (store_id, job_id, customer_id, channel, kind, to_address, body)
      values (j.store_id, j.id, c.id, 'sms', p_kind, c.phone, body)
      on conflict (job_id, kind, channel) do update
        set status = 'queued', error = null, at = now(), body = excluded.body, to_address = excluded.to_address
        where p_force;
  end if;
end $$;
revoke all on function queue_messages(uuid, text, boolean) from public, anon, authenticated;

create function on_job_status() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    new.updated_at := now();
    if new.notify and new.status in ('ready', 'closed') then
      perform queue_messages(new.id, new.status::text, false);
    end if;
  end if;
  return new;
end $$;
revoke all on function on_job_status() from public, anon, authenticated;
create trigger jobs_status before update of status on jobs for each row execute function on_job_status();
-- queue_messages needs the row to exist and be visible; BEFORE trigger sees the same row id, fine.

create function resend_message(p_job uuid, p_kind text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from jobs where id = p_job and store_id = my_store()) then raise exception 'not found'; end if;
  perform queue_messages(p_job, p_kind, true);
end $$;
revoke all on function resend_message(uuid, text) from public, anon;
grant execute on function resend_message(uuid, text) to authenticated;

-- Hand every queued message to the send-messages Edge Function (Resend + Twilio).
-- That function takes only a message id and sends rows that are still 'queued', so it needs no secret.
create function dispatch_message() returns trigger
  language plpgsql security definer set search_path = public, extensions as $$
begin
  perform net.http_post(
    url := 'https://ujlcxbqeywhuiulidfdr.supabase.co/functions/v1/send-messages',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('id', new.id)
  );
  return new;
end $$;
revoke all on function dispatch_message() from public, anon, authenticated;
create trigger messages_dispatch after insert or update of status on messages
  for each row when (new.status = 'queued') execute function dispatch_message();

-- ── job photos (private bucket, one folder per store) ──
insert into storage.buckets (id, name, public) values ('job-photos', 'job-photos', false) on conflict do nothing;
create policy photos_rw on storage.objects for all to authenticated
  using (bucket_id = 'job-photos' and (storage.foldername(name))[1] = (select my_store())::text)
  with check (bucket_id = 'job-photos' and (storage.foldername(name))[1] = (select my_store())::text);
