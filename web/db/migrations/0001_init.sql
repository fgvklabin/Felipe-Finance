-- Avermont — esquema inicial (PostgreSQL 15+ / Supabase / PGlite)
-- Convenções: uuid para entidades de usuário, text para ids de catálogo, double precision para preços,
-- timestamptz para instantes. Tabelas de mercado e de previsões são APPEND-ONLY (ver gatilhos no fim).

-- ============================================================ contas, empresas e workspaces
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email = lower(email) AND position('@' IN email) > 1),
  password_hash text NOT NULL,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  account_type text NOT NULL CHECK (account_type IN ('investor', 'business', 'supplier')),
  is_admin boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'deleted')),
  locale text NOT NULL DEFAULT 'pt' CHECK (locale IN ('pt', 'en')),
  notification_prefs jsonb NOT NULL DEFAULT '{"inApp": true, "email": false, "whatsapp": false}',
  onboarding jsonb NOT NULL DEFAULT '{}',
  lgpd_consent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE password_resets (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- "Companies" do briefing: pessoa jurídica do cliente (comprador) ou do fornecedor.
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  cnpj text CHECK (cnpj IS NULL OR cnpj ~ '^\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}$'),
  kind text NOT NULL CHECK (kind IN ('buyer', 'supplier')),
  industry text,
  city text,
  state text CHECK (state IS NULL OR length(state) = 2),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workspace_members (
  workspace_id uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'buyer', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
CREATE INDEX workspace_members_user_idx ON workspace_members (user_id);

CREATE TABLE workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  email text NOT NULL CHECK (email = lower(email)),
  role text NOT NULL CHECK (role IN ('admin', 'buyer', 'viewer')),
  invited_by uuid REFERENCES users (id) ON DELETE SET NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, email)
);

-- ============================================================ fontes e catálogo de mercado
CREATE TABLE data_sources (
  id text PRIMARY KEY,
  provider text NOT NULL,
  category text NOT NULL,
  api_available boolean NOT NULL,
  auth_required boolean NOT NULL,
  update_frequency text NOT NULL,
  coverage_geo text,
  coverage_history text,
  currency text,
  unit text,
  licensing_status text NOT NULL CHECK (licensing_status IN ('open', 'open_with_attribution', 'requires_license', 'restricted', 'derived', 'demo')),
  license text,
  integration_status text NOT NULL CHECK (integration_status IN ('integrated', 'planned', 'blocked', 'not_planned')),
  last_success_at timestamptz,
  data_quality text,
  limitations text,
  url text
);

CREATE TABLE commodity_categories (
  id text PRIMARY KEY,
  name_pt text NOT NULL,
  name_en text NOT NULL,
  color text NOT NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE TABLE commodities (
  id text PRIMARY KEY,
  category_id text NOT NULL REFERENCES commodity_categories (id),
  name_pt text NOT NULL,
  name_en text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('raw', 'processed', 'currency')),
  price_type text NOT NULL CHECK (price_type IN ('international_benchmark', 'regional_physical', 'futures', 'index', 'fx_rate')),
  data_mode text NOT NULL CHECK (data_mode IN ('real', 'demo', 'unavailable')),
  source_id text REFERENCES data_sources (id),
  unit text NOT NULL,
  currency text NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('intraday', 'daily', 'weekly', 'monthly', 'quarterly')),
  benchmark text,
  is_hidden boolean NOT NULL DEFAULT false,
  editorial_note text
);

CREATE TABLE commodity_specifications (
  id bigserial PRIMARY KEY,
  commodity_id text NOT NULL REFERENCES commodities (id) ON DELETE CASCADE,
  spec_key text NOT NULL,
  spec_value text NOT NULL,
  source text,
  UNIQUE (commodity_id, spec_key)
);

-- Preços históricos: append-only. Correções entram como nova linha com supersedes_id.
CREATE TABLE historical_prices (
  id bigserial PRIMARY KEY,
  commodity_id text NOT NULL REFERENCES commodities (id),
  source_id text NOT NULL REFERENCES data_sources (id),
  observed_at date NOT NULL,
  value double precision NOT NULL CHECK (value > 0),
  currency text NOT NULL,
  unit text NOT NULL,
  is_demo boolean NOT NULL DEFAULT false,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  supersedes_id bigint REFERENCES historical_prices (id),
  correction_reason text,
  CHECK ((supersedes_id IS NULL) = (correction_reason IS NULL))
);
CREATE UNIQUE INDEX historical_prices_original_uq ON historical_prices (commodity_id, source_id, observed_at) WHERE supersedes_id IS NULL;
CREATE INDEX historical_prices_lookup_idx ON historical_prices (commodity_id, observed_at DESC);

CREATE VIEW effective_prices AS
SELECT p.* FROM historical_prices p
WHERE NOT EXISTS (SELECT 1 FROM historical_prices c WHERE c.supersedes_id = p.id);

CREATE VIEW current_prices AS
SELECT DISTINCT ON (commodity_id) commodity_id, source_id, observed_at, value, currency, unit, is_demo, ingested_at
FROM effective_prices ORDER BY commodity_id, observed_at DESC, ingested_at DESC;

CREATE TABLE currency_prices (
  id bigserial PRIMARY KEY,
  pair text NOT NULL,
  source_id text NOT NULL REFERENCES data_sources (id),
  observed_at date NOT NULL,
  value double precision NOT NULL CHECK (value > 0),
  derived boolean NOT NULL DEFAULT false,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pair, source_id, observed_at)
);

CREATE TABLE futures_contracts (
  id bigserial PRIMARY KEY,
  commodity_id text NOT NULL REFERENCES commodities (id),
  exchange text NOT NULL,
  contract_code text NOT NULL,
  expiration date NOT NULL,
  trade_date date NOT NULL,
  settlement_price double precision CHECK (settlement_price > 0),
  volume bigint CHECK (volume >= 0),
  open_interest bigint CHECK (open_interest >= 0),
  specs jsonb,
  source_id text REFERENCES data_sources (id),
  is_demo boolean NOT NULL DEFAULT false,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exchange, contract_code, trade_date)
);

CREATE TABLE futures_curves (
  id bigserial PRIMARY KEY,
  commodity_id text NOT NULL REFERENCES commodities (id),
  curve_date date NOT NULL,
  points jsonb NOT NULL,
  source_id text REFERENCES data_sources (id),
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (commodity_id, curve_date, source_id)
);

-- ============================================================ previsões
CREATE TABLE forecast_models (
  id text PRIMARY KEY,
  label text NOT NULL,
  description text,
  version text NOT NULL
);

CREATE TABLE forecast_results (
  id bigserial PRIMARY KEY,
  commodity_id text NOT NULL,
  model_id text NOT NULL REFERENCES forecast_models (id),
  engine_version text NOT NULL,
  generated_at timestamptz NOT NULL,
  origin_date date NOT NULL,
  origin_value double precision NOT NULL,
  horizon text NOT NULL,
  target_date date,
  status text NOT NULL CHECK (status IN ('ok', 'insufficient_data', 'frequency_mismatch', 'not_justified', 'expired')),
  central double precision,
  low double precision,
  high double precision,
  interval_level double precision,
  details jsonb NOT NULL DEFAULT '{}',
  archive_sha256 text,
  UNIQUE (commodity_id, horizon, generated_at)
);
CREATE INDEX forecast_results_lookup_idx ON forecast_results (commodity_id, generated_at DESC);

CREATE TABLE forecast_evaluations (
  id bigserial PRIMARY KEY,
  commodity_id text NOT NULL,
  horizon text NOT NULL,
  model_id text NOT NULL REFERENCES forecast_models (id),
  window_kind text NOT NULL CHECK (window_kind IN ('backtest', 'live')),
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  n integer NOT NULL,
  mape double precision,
  mae double precision,
  rmse double precision,
  directional_accuracy double precision,
  interval_coverage double precision,
  skill_vs_naive double precision,
  dm_p_value double precision,
  details jsonb NOT NULL DEFAULT '{}'
);

-- ============================================================ fornecedores e compras (B2B)
CREATE TABLE suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations (id) ON DELETE SET NULL,
  -- fornecedor privado cadastrado por um comprador: visível apenas para aquele workspace
  private_to_workspace uuid REFERENCES workspaces (id) ON DELETE CASCADE,
  name text NOT NULL,
  cnpj text,
  city text,
  state text,
  commodities text[] NOT NULL DEFAULT '{}',
  contact_email text,
  contact_phone text,
  website text,
  verification_status text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
  verification_notes text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT is_demo OR (contact_email IS NULL AND contact_phone IS NULL AND verification_status = 'unverified'))
);
CREATE INDEX suppliers_workspace_idx ON suppliers (private_to_workspace);

CREATE TABLE supplier_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers (id) ON DELETE CASCADE,
  requested_by uuid REFERENCES users (id) ON DELETE SET NULL,
  evidence text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES users (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  commodity_id text,
  title text NOT NULL,
  specification text,
  quality_requirements text,
  quantity double precision NOT NULL CHECK (quantity > 0),
  unit text NOT NULL,
  delivery_location text NOT NULL,
  delivery_deadline date,
  payment_terms text,
  budget_max double precision CHECK (budget_max IS NULL OR budget_max > 0),
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'marketplace')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled')),
  created_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX purchase_requests_ws_idx ON purchase_requests (workspace_id, created_at DESC);

CREATE TABLE supplier_quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  purchase_request_id uuid REFERENCES purchase_requests (id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES suppliers (id) ON DELETE SET NULL,
  supplier_name text NOT NULL,
  commodity_id text,
  product text NOT NULL,
  specification text,
  quality text,
  unit text NOT NULL,
  quantity double precision NOT NULL CHECK (quantity > 0),
  unit_price double precision NOT NULL CHECK (unit_price > 0),
  currency text NOT NULL DEFAULT 'BRL' CHECK (currency IN ('BRL', 'USD', 'EUR')),
  freight_total double precision NOT NULL DEFAULT 0 CHECK (freight_total >= 0),
  tax_pct double precision NOT NULL DEFAULT 0 CHECK (tax_pct >= 0 AND tax_pct <= 100),
  payment_days integer NOT NULL DEFAULT 0 CHECK (payment_days >= 0 AND payment_days <= 720),
  delivery_days integer CHECK (delivery_days IS NULL OR delivery_days >= 0),
  delivery_location text,
  min_order_qty double precision CHECK (min_order_qty IS NULL OR min_order_qty >= 0),
  valid_until date,
  contact text,
  source text NOT NULL CHECK (source IN ('manual', 'csv', 'xlsx', 'pdf_ai', 'image_ai', 'supplier_portal', 'demo')),
  is_demo boolean NOT NULL DEFAULT false,
  verified_by_user boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  verified_by uuid REFERENCES users (id) ON DELETE SET NULL,
  extraction jsonb,
  notes text,
  created_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX supplier_quotations_ws_idx ON supplier_quotations (workspace_id, created_at DESC);

CREATE TABLE workspace_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  commodity_id text,
  name text NOT NULL,
  unit text NOT NULL,
  monthly_consumption double precision NOT NULL CHECK (monthly_consumption >= 0),
  current_price double precision NOT NULL CHECK (current_price >= 0),
  currency text NOT NULL DEFAULT 'BRL' CHECK (currency IN ('BRL', 'USD', 'EUR')),
  inventory_qty double precision NOT NULL DEFAULT 0 CHECK (inventory_qty >= 0),
  lead_time_days integer NOT NULL DEFAULT 15 CHECK (lead_time_days >= 0),
  storage_cost_pct_month double precision NOT NULL DEFAULT 0.5 CHECK (storage_cost_pct_month >= 0),
  usd_share double precision NOT NULL DEFAULT 0 CHECK (usd_share >= 0 AND usd_share <= 100),
  essential boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workspace_materials_ws_idx ON workspace_materials (workspace_id);

CREATE TABLE procurement_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  material_id uuid REFERENCES workspace_materials (id) ON DELETE SET NULL,
  purchased_at date NOT NULL,
  quantity double precision NOT NULL CHECK (quantity > 0),
  unit_price double precision NOT NULL CHECK (unit_price > 0),
  currency text NOT NULL DEFAULT 'BRL',
  supplier_name text,
  notes text,
  created_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX procurement_history_ws_idx ON procurement_history (workspace_id, purchased_at DESC);

-- ============================================================ companhias, ações, fundos (B2C)
CREATE TABLE listed_companies (
  cnpj text PRIMARY KEY,
  name text NOT NULL,
  cvm_code text,
  sector text,
  activity_description text,
  website text,
  registration_status text,
  fca_reference_date date,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE stocks (
  ticker text PRIMARY KEY CHECK (ticker ~ '^[A-Z0-9]{4,6}$'),
  company_cnpj text NOT NULL REFERENCES listed_companies (cnpj),
  security_type text,
  segment text,
  verified_in_fca boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE company_financial_statements (
  id bigserial PRIMARY KEY,
  company_cnpj text NOT NULL REFERENCES listed_companies (cnpj),
  fiscal_year integer NOT NULL,
  fiscal_year_end date,
  statement jsonb NOT NULL,
  source text NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_cnpj, fiscal_year, source)
);

CREATE TABLE company_commodity_exposures (
  id bigserial PRIMARY KEY,
  company_cnpj text NOT NULL REFERENCES listed_companies (cnpj),
  commodity_id text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('positive', 'negative', 'mixed')),
  channel text NOT NULL,
  explanation text NOT NULL,
  counterfactors text,
  basis text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_cnpj, commodity_id, channel)
);

CREATE TABLE investment_funds (
  cnpj text PRIMARY KEY,
  name text NOT NULL,
  vehicle text NOT NULL CHECK (vehicle IN ('etf', 'fiagro', 'multimercado', 'acoes', 'cambial')),
  classification text,
  manager text,
  administrator text,
  net_assets double precision,
  net_assets_date date,
  tags text[] NOT NULL DEFAULT '{}',
  exposure_type text NOT NULL,
  exposure_basis text NOT NULL,
  performance jsonb,
  documents jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX investment_funds_tags_idx ON investment_funds USING gin (tags);

-- ETFs são fundos de índice (vehicle = 'etf'); a tabela guarda o ticker de negociação quando verificado.
CREATE TABLE etfs (
  ticker text PRIMARY KEY,
  fund_cnpj text NOT NULL REFERENCES investment_funds (cnpj) ON DELETE CASCADE,
  index_name text,
  verified boolean NOT NULL DEFAULT false
);

CREATE TABLE fund_holdings (
  id bigserial PRIMARY KEY,
  fund_cnpj text NOT NULL REFERENCES investment_funds (cnpj) ON DELETE CASCADE,
  disclosure_date date NOT NULL,
  asset_type text NOT NULL,
  asset_code text,
  asset_name text,
  weight double precision,
  value double precision,
  source text NOT NULL,
  UNIQUE (fund_cnpj, disclosure_date, asset_type, asset_code)
);

-- ============================================================ macro, notícias e calendário
CREATE TABLE economic_indicators (
  id text PRIMARY KEY,
  name text NOT NULL,
  unit text NOT NULL,
  frequency text NOT NULL,
  source_id text REFERENCES data_sources (id),
  source_code text
);

CREATE TABLE economic_indicator_values (
  indicator_id text NOT NULL REFERENCES economic_indicators (id),
  observed_at date NOT NULL,
  value double precision NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (indicator_id, observed_at)
);

CREATE TABLE market_expectations (
  id bigserial PRIMARY KEY,
  source text NOT NULL,
  survey_date date NOT NULL,
  indicator text NOT NULL,
  reference_period text NOT NULL,
  median double precision,
  mean double precision,
  stdev double precision,
  min double precision,
  max double precision,
  respondents integer,
  UNIQUE (source, survey_date, indicator, reference_period)
);

CREATE TABLE news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL,
  source_url text NOT NULL UNIQUE,
  title text NOT NULL,
  published_at timestamptz NOT NULL,
  summary text,
  categories text[] NOT NULL DEFAULT '{}',
  related_commodities text[] NOT NULL DEFAULT '{}',
  related_companies text[] NOT NULL DEFAULT '{}',
  implications jsonb,
  license_note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX news_published_idx ON news (published_at DESC);

CREATE TABLE calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  category text NOT NULL,
  source_name text,
  source_url text,
  confirmed boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================ personalização, IA e operação
CREATE TABLE watchlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Principal',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE TABLE watchlist_items (
  watchlist_id uuid NOT NULL REFERENCES watchlists (id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('commodity', 'currency', 'company', 'fund', 'supplier', 'indicator')),
  item_ref text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (watchlist_id, item_type, item_ref)
);

CREATE TABLE alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES workspaces (id) ON DELETE CASCADE,
  alert_type text NOT NULL CHECK (alert_type IN ('price_above', 'price_below', 'pct_change_up', 'pct_change_down', 'fx_move', 'forecast_change', 'curve_change', 'new_quote', 'news', 'company_results', 'fund_exposure')),
  item_type text NOT NULL,
  item_ref text NOT NULL,
  threshold double precision,
  channels text[] NOT NULL DEFAULT '{in_app}',
  active boolean NOT NULL DEFAULT true,
  last_value double precision,
  last_state jsonb,
  last_triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX alerts_user_idx ON alerts (user_id);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  alert_id uuid REFERENCES alerts (id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);

CREATE TABLE email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL CHECK (status IN ('queued', 'sent', 'failed', 'not_configured')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE TABLE ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES workspaces (id) ON DELETE CASCADE,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_conversations_user_idx ON ai_conversations (user_id, updated_at DESC);

CREATE TABLE ai_messages (
  id bigserial PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES ai_conversations (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  sources jsonb,
  context jsonb,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id bigserial PRIMARY KEY,
  actor_user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}',
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_idx ON audit_logs (created_at DESC);

CREATE TABLE error_logs (
  id bigserial PRIMARY KEY,
  route text NOT NULL,
  message text NOT NULL,
  stack text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE feedback (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  page text,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  message text NOT NULL CHECK (length(message) <= 4000),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE usage_events (
  id bigserial PRIMARY KEY,
  user_id uuid,
  event text NOT NULL,
  path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX usage_events_created_idx ON usage_events (created_at DESC);

-- ============================================================ imutabilidade (auditoria)
CREATE FUNCTION avermont_forbid_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Tabela % é append-only: % não permitido. Registre uma correção como nova linha.', TG_TABLE_NAME, TG_OP;
END;
$$;

CREATE TRIGGER historical_prices_immutable BEFORE UPDATE OR DELETE ON historical_prices FOR EACH ROW EXECUTE FUNCTION avermont_forbid_mutation();
CREATE TRIGGER currency_prices_immutable BEFORE UPDATE OR DELETE ON currency_prices FOR EACH ROW EXECUTE FUNCTION avermont_forbid_mutation();
CREATE TRIGGER forecast_results_immutable BEFORE UPDATE OR DELETE ON forecast_results FOR EACH ROW EXECUTE FUNCTION avermont_forbid_mutation();
CREATE TRIGGER forecast_evaluations_immutable BEFORE UPDATE OR DELETE ON forecast_evaluations FOR EACH ROW EXECUTE FUNCTION avermont_forbid_mutation();
CREATE TRIGGER audit_logs_immutable BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION avermont_forbid_mutation();
