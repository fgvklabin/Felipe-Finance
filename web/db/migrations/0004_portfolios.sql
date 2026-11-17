-- Carteiras personalizadas (educacionais/simuladas) com acompanhamento diário.
CREATE TABLE portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  base_currency text NOT NULL DEFAULT 'BRL' CHECK (base_currency = 'BRL'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX portfolios_user_idx ON portfolios (user_id);

CREATE TABLE portfolio_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolios (id) ON DELETE CASCADE,
  asset_type text NOT NULL CHECK (asset_type IN ('currency', 'commodity', 'stock', 'fund', 'cash')),
  asset_ref text NOT NULL,
  label text NOT NULL,
  quantity double precision NOT NULL CHECK (quantity > 0),
  entry_price double precision NOT NULL CHECK (entry_price > 0),
  entry_date date NOT NULL DEFAULT current_date,
  -- Ações não têm cotação licenciada: o usuário informa o preço atual (com data).
  manual_price double precision CHECK (manual_price IS NULL OR manual_price > 0),
  manual_price_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX portfolio_positions_pf_idx ON portfolio_positions (portfolio_id);

-- Um snapshot por carteira por dia (fotografia do valor e da composição).
CREATE TABLE portfolio_snapshots (
  portfolio_id uuid NOT NULL REFERENCES portfolios (id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  total_value double precision NOT NULL,
  invested_value double precision NOT NULL,
  breakdown jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (portfolio_id, snapshot_date)
);

-- Vínculo explícito do fornecedor com o usuário dono da conta (portal do fornecedor).
ALTER TABLE suppliers ADD COLUMN owner_user_id uuid REFERENCES users (id) ON DELETE SET NULL;
CREATE INDEX suppliers_owner_idx ON suppliers (owner_user_id);
