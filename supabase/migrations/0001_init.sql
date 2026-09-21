-- Finanzas App — initial Supabase schema
-- Mirrors the Dexie data model in BUILD_PLAN.md, with user_id added to every table
-- (denormalized onto transaction_splits and subcategories too, rather than relying on
-- a join through their parent for RLS — see "Accounts + Sync Migration Plan" in
-- BUILD_PLAN.md for why). Paste this whole file into the Supabase SQL editor and run
-- it once against a fresh project.

create extension if not exists "pgcrypto";

-- CATEGORIES ------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('income', 'expense')),
  icon text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index categories_user_id_idx on public.categories(user_id);

-- SUBCATEGORIES -----------------------------------------------------------------
create table public.subcategories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null,
  icon text,
  sort_order integer not null default 0
);
create index subcategories_user_id_idx on public.subcategories(user_id);
create index subcategories_category_id_idx on public.subcategories(category_id);

-- TRIPS ---------------------------------------------------------------------
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date,
  merge_into_categories boolean not null default false
);
create index trips_user_id_idx on public.trips(user_id);

-- WHO OPTIONS -----------------------------------------------------------------
create table public.who_options (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0
);
create index who_options_user_id_idx on public.who_options(user_id);

-- RECURRING RULES ---------------------------------------------------------------
create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  subcategory_id uuid references public.subcategories(id) on delete set null,
  type text not null check (type in ('income', 'expense')),
  amount numeric not null,
  currency text not null,
  day_of_month integer not null,
  start_date date not null,
  end_date date,
  active boolean not null default true
);
create index recurring_rules_user_id_idx on public.recurring_rules(user_id);

-- TRANSACTIONS ------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  type text not null check (type in ('income', 'expense')),
  currency text not null,
  total_amount numeric not null,
  note text,
  trip_id uuid references public.trips(id) on delete set null,
  recurring_rule_id uuid references public.recurring_rules(id) on delete set null,
  who_id uuid references public.who_options(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index transactions_user_id_date_idx on public.transactions(user_id, date);

-- TRANSACTION SPLITS --------------------------------------------------------------
-- amount should sum to the parent transaction's total_amount — enforced client-side
-- today (same as the Dexie model), not as a DB constraint here.
create table public.transaction_splits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  subcategory_id uuid references public.subcategories(id) on delete set null,
  amount numeric not null
);
create index transaction_splits_user_id_idx on public.transaction_splits(user_id);
create index transaction_splits_transaction_id_idx on public.transaction_splits(transaction_id);

-- USER SETTINGS -----------------------------------------------------------------
create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  currency_default text not null default 'MXN',
  theme text not null default 'blue' check (theme in ('blue', 'green'))
);

-- ROW LEVEL SECURITY ----------------------------------------------------------
-- Every table: a signed-in user can only ever see/write their own rows. Same
-- "owner-only, full access" policy shape everywhere — nothing here is ever shared
-- between accounts (per CONSTITUTION.md: each person gets a fully isolated account).
alter table public.categories enable row level security;
alter table public.subcategories enable row level security;
alter table public.trips enable row level security;
alter table public.who_options enable row level security;
alter table public.recurring_rules enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_splits enable row level security;
alter table public.user_settings enable row level security;

create policy "own rows only" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on public.subcategories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on public.trips
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on public.who_options
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on public.recurring_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on public.transaction_splits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Deliberately NOT included here: no trigger auto-seeding default categories on
-- signup. The app already seeds locally client-side (see src/db/seed.ts) — the
-- accounts migration plan keeps that pattern (seed/claim decided client-side on
-- first login) rather than duplicating seed logic in SQL.
