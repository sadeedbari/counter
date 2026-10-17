-- Counter: multi-tenant schema (one Supabase project, many stores, isolated by RLS).
-- Not applied anywhere yet. The prototype runs on localStorage; this is the production target.

create type job_status as enum ('new', 'in_progress', 'complete', 'ready', 'closed');

create table stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  review_link text,
  ready_message text not null default 'Hi {{name}}, your {{item}} is ready for pickup at {{store}}.',
  closed_message text not null default 'Thanks for visiting {{store}}, {{name}}! Leave us a review: {{review_link}}',
  created_at timestamptz not null default now()
);

create table members (            -- staff logins and who a job can be assigned to
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  user_id uuid references auth.users on delete set null,
  name text not null,
  role text not null default 'staff' check (role in ('owner', 'staff'))
);

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
create unique index customers_phone_uq on customers (store_id, phone) where phone is not null;  -- store E.164
create index customers_search on customers using gin (to_tsvector('simple', name || ' ' || coalesce(email, '') || ' ' || coalesce(phone, '')));

create table jobs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  customer_id uuid not null references customers on delete restrict,
  item text not null,
  notes text not null default '',
  photo_path text,                                    -- Storage bucket "job-photos", one per job
  status job_status not null default 'new',
  assignee_id uuid references members on delete set null,
  notify boolean not null default true,               -- the "send automatic messages" checkbox
  intake_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_board on jobs (store_id, status, updated_at desc);

create table job_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references jobs on delete cascade,
  text text not null,
  at timestamptz not null default now()
);

create table messages (           -- outbox + delivery log
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  job_id uuid not null references jobs on delete cascade,
  customer_id uuid not null references customers,
  channel text not null check (channel in ('email', 'sms')),
  kind text not null check (kind in ('ready', 'closed')),
  to_address text not null,
  subject text,
  body text not null,
  provider_id text,                                    -- Resend / Twilio message id
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  error text,
  at timestamptz not null default now(),
  unique (job_id, kind, channel)                       -- never double-text a customer
);

-- Phase 2 (optional): invoices
-- create table invoices (id uuid pk, store_id, job_id unique, status text, ...);
-- create table invoice_lines (id, invoice_id, kind text check (kind in ('part','labour')), description, qty, unit_cents);

-- Row-level security: every table is scoped to the caller's store.
create function my_store() returns uuid language sql stable security definer set search_path = public as
  $$ select store_id from members where user_id = auth.uid() limit 1 $$;

alter table stores enable row level security;
alter table members enable row level security;
alter table customers enable row level security;
alter table jobs enable row level security;
alter table job_events enable row level security;
alter table messages enable row level security;

create policy own_store on stores for all using (id = my_store());
create policy own_members on members for all using (store_id = my_store());
create policy own_customers on customers for all using (store_id = my_store());
create policy own_jobs on jobs for all using (store_id = my_store());
create policy own_events on job_events for all using (job_id in (select id from jobs where store_id = my_store()));
create policy own_messages on messages for select using (store_id = my_store());

-- Notification trigger: when jobs.status changes to 'ready' or 'closed' and jobs.notify is true,
-- an AFTER UPDATE trigger enqueues rows in messages (rendering the store's template); a Database
-- Webhook calls an Edge Function that sends them via Resend + Twilio and records provider_id/status.
