-- 0001_init.sql was written straight from BUILD_PLAN.md's original data model doc,
-- which predates the app actually being built — the real recurring_rules table (see
-- db/types.ts's RecurringRule) grew a whoId and a note field along the way that
-- never made it back into that doc or the first migration. Adding them now, ahead
-- of wiring up sync, which needs every local field to have somewhere to go.
alter table public.recurring_rules
  add column who_id uuid references public.who_options(id) on delete set null,
  add column note text;
