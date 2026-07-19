-- ValueLoop initial schema: 14 tables per blueprint §6.1
-- Applied via Supabase MCP apply_migration; saved to repo for git history.
-- RLS intentionally OFF: internal CSM tool, service-role key only, auth at API layer.

-- accounts
create table public.accounts (
  id text primary key,
  name text not null,
  initials text not null,
  owner_id text not null,
  plan text not null,
  segment text not null,
  industry text not null,
  arr_mrr numeric(12,2) not null default 0,
  start_date date not null,
  renewal_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_accounts_segment on public.accounts(segment);
create index idx_accounts_owner on public.accounts(owner_id);

-- users
create table public.users (
  id text primary key,
  account_id text not null references public.accounts(id) on delete cascade,
  role text not null,
  seat_status text not null default 'active',
  created_at timestamptz not null default now()
);
create index idx_users_account on public.users(account_id);

-- subscriptions
create table public.subscriptions (
  id text primary key,
  account_id text not null references public.accounts(id) on delete cascade,
  plan text not null,
  price numeric(12,2) not null,
  status text not null default 'active',
  renewal_date date,
  cancel_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_status_check check (status in ('active','cancelled','paused','past_due'))
);
create index idx_subscriptions_account on public.subscriptions(account_id);

-- usage_events
create table public.usage_events (
  id text primary key,
  account_id text not null references public.accounts(id) on delete cascade,
  user_id text references public.users(id) on delete set null,
  feature text not null,
  timestamp timestamptz not null,
  count int not null default 0,
  duration numeric(10,2) not null default 0
);
create index idx_usage_account_time on public.usage_events(account_id, timestamp desc);
create index idx_usage_account_feature on public.usage_events(account_id, feature, timestamp desc);

-- payment_events
create table public.payment_events (
  id text primary key,
  account_id text not null references public.accounts(id) on delete cascade,
  timestamp timestamptz not null,
  status text not null,
  amount numeric(12,2) not null,
  attempt int not null default 1,
  failure_code text,
  constraint payment_status_check check (status in ('succeeded','failed','pending','refunded'))
);
create index idx_payment_account_time on public.payment_events(account_id, timestamp desc);

-- support_tickets
create table public.support_tickets (
  id text primary key,
  account_id text not null references public.accounts(id) on delete cascade,
  severity text not null,
  category text not null,
  opened_at timestamptz not null,
  closed_at timestamptz,
  sentiment text,
  resolution text,
  constraint ticket_severity_check check (severity in ('critical','high','medium','low'))
);
create index idx_tickets_account_time on public.support_tickets(account_id, opened_at desc);
create index idx_tickets_severity on public.support_tickets(severity);

-- feedback_events
create table public.feedback_events (
  id text primary key,
  account_id text not null references public.accounts(id) on delete cascade,
  metric_type text not null,
  score numeric(5,2),
  text text,
  timestamp timestamptz not null,
  constraint feedback_metric_check check (metric_type in ('nps','csat','verbatim'))
);
create index idx_feedback_account on public.feedback_events(account_id, timestamp desc);

-- health_scores
create table public.health_scores (
  id text primary key default gen_random_uuid()::text,
  account_id text not null references public.accounts(id) on delete cascade,
  generated_at timestamptz not null default now(),
  adoption numeric(5,2) not null check (adoption between 0 and 100),
  engagement numeric(5,2) not null check (engagement between 0 and 100),
  experience numeric(5,2) not null check (experience between 0 and 100),
  financial numeric(5,2) not null check (financial between 0 and 100),
  value numeric(5,2) not null check (value between 0 and 100),
  overall numeric(5,2) not null check (overall between 0 and 100),
  version text not null default '1.0'
);
create index idx_health_account_time on public.health_scores(account_id, generated_at desc);

-- risk_predictions
create table public.risk_predictions (
  id text primary key default gen_random_uuid()::text,
  account_id text not null references public.accounts(id) on delete cascade,
  risk_type text not null,
  probability numeric(4,3) not null check (probability between 0 and 1),
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  top_features_json jsonb not null default '[]'::jsonb,
  model_version text not null default '1.0',
  generated_at timestamptz not null default now(),
  constraint risk_type_check check (risk_type in ('cancellation','downgrade','inactivity','payment_failure','expansion_readiness'))
);
create index idx_risk_account_time on public.risk_predictions(account_id, generated_at desc);

-- cause_hypotheses
create table public.cause_hypotheses (
  id text primary key default gen_random_uuid()::text,
  account_id text not null references public.accounts(id) on delete cascade,
  cause text not null,
  rank int not null,
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  evidence_json jsonb not null default '[]'::jsonb,
  contradictions_json jsonb not null default '[]'::jsonb,
  rule_version text not null default '1.0',
  generated_at timestamptz not null default now(),
  unknown_reason text,
  constraint cause_check check (cause in ('payment','technical_support','product_fit','price_plan_fit','disengagement','lifecycle','competitive','unknown'))
);
create index idx_causes_account_time_rank on public.cause_hypotheses(account_id, generated_at desc, rank);

-- action_recommendations
create table public.action_recommendations (
  id text primary key default gen_random_uuid()::text,
  account_id text not null references public.accounts(id) on delete cascade,
  action_code text not null,
  eligibility boolean not null,
  rejection_reason text,
  utility_score numeric(6,3),
  approval_required boolean not null default false,
  approval_reason text,
  benefit text,
  friction text,
  risk text,
  generated_at timestamptz not null default now()
);
create index idx_actions_account_time on public.action_recommendations(account_id, generated_at desc);

-- interventions
create table public.interventions (
  id text primary key,
  account_id text not null references public.accounts(id) on delete cascade,
  recommended_action text not null,
  final_action text,
  approver text,
  status text not null default 'pending',
  channel text,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intervention_status_check check (status in ('pending','approved','rejected','modified','executed','delivered'))
);
create index idx_interventions_account on public.interventions(account_id, created_at desc);
create index idx_interventions_status on public.interventions(status);

-- outcomes
create table public.outcomes (
  intervention_id text primary key references public.interventions(id) on delete cascade,
  renewed boolean,
  downgraded boolean,
  churned boolean,
  usage_delta numeric(8,2),
  health_delta numeric(8,2),
  response text,
  observation text,
  recorded_at timestamptz not null default now()
);

-- audit_logs
create table public.audit_logs (
  id bigserial primary key,
  actor_id text not null,
  actor_role text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_json jsonb,
  after_json jsonb,
  timestamp timestamptz not null default now(),
  reason text
);
create index idx_audit_entity on public.audit_logs(entity_type, entity_id, timestamp desc);
create index idx_audit_actor on public.audit_logs(actor_id, timestamp desc);

-- updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_accounts_updated before update on public.accounts
  for each row execute function public.set_updated_at();
create trigger trg_subscriptions_updated before update on public.subscriptions
  for each row execute function public.set_updated_at();
create trigger trg_interventions_updated before update on public.interventions
  for each row execute function public.set_updated_at();
