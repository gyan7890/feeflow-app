create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  center text,
  plan text not null default 'Free',
  message text,
  source text not null default 'feeflow_landing',
  created_at timestamptz not null default now()
);

alter table public.leads enable row level security;

drop policy if exists "Allow public lead inserts" on public.leads;

create policy "Allow public lead inserts"
on public.leads
for insert
to anon
with check (source = 'feeflow_landing');
