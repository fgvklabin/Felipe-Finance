-- Base para RAG com pgvector (Supabase e Postgres com a extensão disponível).
-- Se a extensão não existir no servidor, a migração registra aviso e segue (a busca usa texto).
DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pgvector indisponível neste servidor; documentos serão buscados por texto.';
  END;
END $$;

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id bigserial PRIMARY KEY,
  doc_key text NOT NULL UNIQUE,
  title text NOT NULL,
  body text NOT NULL,
  source_name text NOT NULL,
  source_url text,
  as_of date,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'workspace')),
  workspace_id uuid REFERENCES workspaces (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((visibility = 'workspace') = (workspace_id IS NOT NULL))
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    EXECUTE 'ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS embedding vector(1024)';
  END IF;
END $$;
