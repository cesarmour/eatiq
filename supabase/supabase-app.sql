-- eatIQ: área logada com cadastro, perfil por usuário e dados por usuário
-- Rode inteiro no SQL Editor. Pode rodar mais de uma vez.

-- 1) perfil de cada usuário (criado automaticamente no cadastro)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text, nome text,
  peso numeric, altura numeric, idade int, sexo text, atividade numeric, meta numeric,
  ldl numeric, hdl numeric, tg numeric, gli numeric, uri numeric,
  consentimento boolean default false, consentido_em timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz
);
alter table public.profiles enable row level security;
drop policy if exists "perfil próprio: ler" on public.profiles;
drop policy if exists "perfil próprio: criar" on public.profiles;
drop policy if exists "perfil próprio: editar" on public.profiles;
create policy "perfil próprio: ler" on public.profiles for select to authenticated using (user_id = auth.uid());
create policy "perfil próprio: criar" on public.profiles for insert to authenticated with check (user_id = auth.uid());
create policy "perfil próprio: editar" on public.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, email, nome, consentimento, consentido_em)
  values (new.id, new.email, new.raw_user_meta_data->>'nome', coalesce((new.raw_user_meta_data->>'consentimento')::boolean,false), nullif(new.raw_user_meta_data->>'consentido_em','')::timestamptz)
  on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- 2) registro dos arquivos enviados por cada usuário
create table if not exists public.uploads (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  arquivo text, caminho text, app text, tamanho bigint,
  processado boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.uploads enable row level security;
drop policy if exists "uploads próprios: ler" on public.uploads;
drop policy if exists "uploads próprios: criar" on public.uploads;
create policy "uploads próprios: ler" on public.uploads for select to authenticated using (user_id = auth.uid());
create policy "uploads próprios: criar" on public.uploads for insert to authenticated with check (user_id = auth.uid());

-- storage: usuário logado grava só na própria pasta do bucket "pedidos"
drop policy if exists "logado envia na própria pasta" on storage.objects;
create policy "logado envia na própria pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'pedidos' and (storage.foldername(name))[1] = auth.uid()::text);

-- 3) pedidos e produtos por usuário
-- Preserve existing orders and products on repeated installation.
create table if not exists public.pedidos (id bigint generated always as identity primary key, user_id uuid references auth.users(id) on delete cascade, app text, criado_em timestamptz, loja text, tipo text, tipo_loja text, total numeric, produtos numeric, taxas numeric, desconto numeric, gorjeta numeric, kcal int, prot int, carb int, gord int, minutos numeric, km numeric, unidades numeric, itens text);
create table if not exists public.produtos (id bigint generated always as identity primary key, user_id uuid references auth.users(id) on delete cascade, app text, nome text, pedidos int, unidades numeric, gasto numeric, tipo text);
alter table public.pedidos enable row level security; alter table public.produtos enable row level security;
drop policy if exists "pedidos próprios" on public.pedidos;
create policy "pedidos próprios" on public.pedidos for select to authenticated using (user_id = auth.uid());
drop policy if exists "pedidos próprios: criar" on public.pedidos;
create policy "pedidos próprios: criar" on public.pedidos for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "produtos próprios" on public.produtos;
create policy "produtos próprios" on public.produtos for select to authenticated using (user_id = auth.uid());
drop policy if exists "produtos próprios: criar" on public.produtos;
create policy "produtos próprios: criar" on public.produtos for insert to authenticated with check (user_id = auth.uid());
create index if not exists pedidos_user_idx on public.pedidos (user_id, criado_em);

-- (dados de exemplo removidos do repositório: carregue os seus pela área logada)
