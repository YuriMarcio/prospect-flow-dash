-- Objetivos: área, prioridade e código sequencial ("OBJ-003").
-- Rodar no SQL Editor do Supabase ANTES de publicar a API que usa esses campos.
-- É idempotente: pode rodar mais de uma vez.

alter table public.objectives
  add column if not exists area text,
  add column if not exists priority text,
  add column if not exists code_number integer;

-- Valores aceitos (a API também valida).
alter table public.objectives drop constraint if exists objectives_area_check;
alter table public.objectives
  add constraint objectives_area_check
  check (area is null or area in ('vendas', 'marketing', 'administrativo', 'desenvolvimento'));

alter table public.objectives drop constraint if exists objectives_priority_check;
alter table public.objectives
  add constraint objectives_priority_check
  check (priority is null or priority in ('critica', 'alta', 'media', 'baixa'));

-- Numera os itens de topo que já existem, na ordem de criação (marcos/issues/subissues não têm código).
with numbered as (
  select id, row_number() over (order by created_at, id) + coalesce((select max(code_number) from public.objectives), 0) as n
  from public.objectives
  where parent_objective_id is null and code_number is null
)
update public.objectives o
set code_number = numbered.n
from numbered
where o.id = numbered.id;
