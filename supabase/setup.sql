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

create table if not exists public.feeflow_students (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  photo_url text,
  name text not null,
  parent_name text not null,
  mobile text not null,
  whatsapp text,
  email text,
  address text,
  class_name text not null,
  monthly_fee numeric(12, 2) not null check (monthly_fee >= 0),
  admission_date date not null default current_date,
  status text not null default 'active' check (status in ('active', 'archived')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.feeflow_payments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.feeflow_students(id) on delete cascade,
  amount numeric(12, 2) not null check (amount >= 0),
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  payment_kind text not null check (payment_kind in ('monthly', 'admission', 'extra', 'advance')),
  payment_status text not null check (payment_status in ('paid', 'pending', 'partial', 'overdue')),
  payment_method text not null check (payment_method in ('cash', 'upi', 'bank_transfer', 'card', 'other')),
  paid_on date not null default current_date,
  reference_number text,
  collected_by text not null,
  receipt_number text not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (teacher_id, receipt_number)
);

create table if not exists public.feeflow_reminders (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.feeflow_students(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('friendly', 'due', 'final')),
  channel text not null check (channel in ('email', 'whatsapp', 'sms')),
  message text not null,
  status text not null default 'opened' check (status in ('opened', 'sent_manually')),
  opened_at timestamptz not null default now(),
  sent_manually_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.feeflow_settings (
  teacher_id uuid primary key references auth.users(id) on delete cascade,
  institute_name text not null,
  logo_url text,
  address text,
  phone text,
  email text,
  currency text not null default 'INR',
  receipt_template text not null default 'Thank you for your fee payment!',
  reminder_template text not null default 'Dear parent, fee for {{student}} is pending. Amount: {{amount}}.',
  theme text not null default 'light' check (theme in ('light', 'dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feeflow_subscriptions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  plan text not null,
  subscription_status text not null check (subscription_status in ('active', 'pending', 'cancelled', 'expired', 'renewed')),
  purchase_token text not null,
  order_id text,
  purchase_date timestamptz not null default now(),
  expiry_date timestamptz not null,
  auto_renew boolean not null default true,
  raw_payload jsonb,
  updated_at timestamptz not null default now()
);

alter table public.feeflow_students enable row level security;
alter table public.feeflow_payments enable row level security;
alter table public.feeflow_reminders enable row level security;
alter table public.feeflow_settings enable row level security;
alter table public.feeflow_subscriptions enable row level security;

drop policy if exists "Teachers manage own students" on public.feeflow_students;
create policy "Teachers manage own students"
on public.feeflow_students
for all
to authenticated
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

drop policy if exists "Teachers manage own payments" on public.feeflow_payments;
create policy "Teachers manage own payments"
on public.feeflow_payments
for all
to authenticated
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

drop policy if exists "Teachers manage own reminders" on public.feeflow_reminders;
create policy "Teachers manage own reminders"
on public.feeflow_reminders
for all
to authenticated
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

drop policy if exists "Teachers manage own settings" on public.feeflow_settings;
create policy "Teachers manage own settings"
on public.feeflow_settings
for all
to authenticated
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

drop policy if exists "Teachers manage own subscriptions" on public.feeflow_subscriptions;
create policy "Teachers manage own subscriptions"
on public.feeflow_subscriptions
for all
to authenticated
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

create index if not exists feeflow_students_teacher_search_idx
on public.feeflow_students (teacher_id, name, parent_name, mobile);

create index if not exists feeflow_payments_teacher_date_idx
on public.feeflow_payments (teacher_id, paid_on desc);

create index if not exists feeflow_reminders_teacher_date_idx
on public.feeflow_reminders (teacher_id, created_at desc);

create index if not exists feeflow_subscriptions_teacher_date_idx
on public.feeflow_subscriptions (teacher_id, expiry_date desc);
