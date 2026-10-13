-- Descoberta multi-fonte (Google Meu Negócio + Instagram).
-- Aplicar no Supabase (SQL Editor). Idempotente: pode rodar mais de uma vez.
--
-- O código funciona SEM esta migration: colunas ausentes são descartadas na gravação e a fila
-- técnica fica só no log. Com ela, os dados passam a ser persistidos.

-- Dados do estabelecimento vindos do Google Maps.
alter table public.leads
  add column if not exists google_place_id text,
  add column if not exists website text,
  add column if not exists rating numeric,
  add column if not exists reviews_count integer,
  add column if not exists phone text;

create index if not exists leads_google_place_id_idx
  on public.leads (google_place_id)
  where google_place_id is not null;

-- Parâmetros e desfecho da captura.
--   state             UF buscada (desambigua cidades homônimas, ex.: Santa Inês-MA × Santa Inês-BA)
--   categories        segmentos escolhidos ({Hamburgueria,Pizzaria}); `category` guarda o resumo "Hamburgueria, Pizzaria"
--   sources           fontes escolhidas: {instagram,maps}
--   completion_reason goal_reached | sources_exhausted | budget_exhausted
alter table public.campaigns
  add column if not exists state text,
  add column if not exists categories text[],
  add column if not exists sources text[],
  add column if not exists completion_reason text;

-- Fila técnica: candidatos que não viraram lead (cidade ou nicho não confirmados). Ficam fora do
-- Kanban e não geram nova consulta paga. campaign_id sem FK porque o tipo de campaigns.id não
-- está versionado no repositório: confirme o tipo (uuid/text) antes de acrescentar a FK.
create table if not exists public.discovery_candidates (
  id uuid primary key default gen_random_uuid(),
  campaign_id text not null,
  source text not null check (source in ('instagram', 'maps')),
  dedupe_key text not null,
  name text,
  instagram text,
  place_id text,
  address text,
  niche text not null,
  location text not null,
  reason text not null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (campaign_id, dedupe_key)
);

create index if not exists discovery_candidates_campaign_idx
  on public.discovery_candidates (campaign_id);
