-- eatIQ: Apple Health por usuário (rode inteiro no SQL Editor)

-- token de sincronização por usuário (usado pelo atalho do iOS)
alter table public.profiles add column if not exists sync_token uuid not null default gen_random_uuid();
create unique index if not exists profiles_sync_token_idx on public.profiles (sync_token);

-- totais diários
create table if not exists public.health_daily (
  user_id     uuid not null references auth.users(id) on delete cascade,
  dia         date not null,
  passos      int,
  kcal_ativas int,
  kcal_basal  int,
  peso        numeric,
  sono_min    int,
  treino_min  int,
  fonte       text,
  updated_at  timestamptz not null default now(),
  primary key (user_id, dia)
);
alter table public.health_daily enable row level security;

-- usuário logado lê e grava só o que é dele
drop policy if exists "health próprio: ler" on public.health_daily;
drop policy if exists "health próprio: gravar" on public.health_daily;
drop policy if exists "health próprio: editar" on public.health_daily;
create policy "health próprio: ler"   on public.health_daily for select to authenticated using (user_id = auth.uid());
create policy "health próprio: gravar" on public.health_daily for insert to authenticated with check (user_id = auth.uid());
create policy "health próprio: editar" on public.health_daily for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- atalho do iOS: sem login, identifica o usuário pelo cabeçalho x-sync-token
create or replace function public.sync_user_id() returns uuid language sql stable security definer set search_path = public as $$
  select user_id from public.profiles
  where sync_token::text = coalesce(current_setting('request.headers', true)::json->>'x-sync-token', '')
$$;
-- preenche user_id automaticamente quando vier pelo token
create or replace function public.health_fill_user() returns trigger language plpgsql as $$
begin
  if new.user_id is null then new.user_id := public.sync_user_id(); end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists health_fill_user on public.health_daily;
create trigger health_fill_user before insert or update on public.health_daily for each row execute procedure public.health_fill_user();

drop policy if exists "atalho: gravar com token" on public.health_daily;
drop policy if exists "atalho: editar com token" on public.health_daily;
create policy "atalho: gravar com token" on public.health_daily for insert to anon with check (public.sync_user_id() is not null and (user_id is null or user_id = public.sync_user_id()));
create policy "atalho: editar com token" on public.health_daily for update to anon using (user_id = public.sync_user_id()) with check (user_id = public.sync_user_id());
