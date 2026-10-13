-- Notificações push do PWA (lembretes de tarefas, vencimentos e metas).
-- Rodar no SQL Editor do Supabase ANTES de publicar a API que usa essas tabelas.
-- É idempotente: pode rodar mais de uma vez.

-- Um registro por dispositivo/navegador que ativou as notificações. O `endpoint` é único:
-- se o mesmo navegador trocar de usuário, a inscrição passa a pertencer ao novo.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

-- Registro do que já foi enviado, para o lembrete não repetir após um redeploy da API
-- (ex.: "today:2026-10-13:<user>"). Linhas com mais de 30 dias são limpas pela própria API.
create table if not exists public.push_notification_log (
  dedupe_key text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null,
  sent_at timestamptz not null default now()
);

create index if not exists push_notification_log_sent_at_idx
  on public.push_notification_log (sent_at);

-- Só a API (service key) acessa; sem políticas, anon/authenticated não leem nada.
alter table public.push_subscriptions enable row level security;
alter table public.push_notification_log enable row level security;

notify pgrst, 'reload schema';
