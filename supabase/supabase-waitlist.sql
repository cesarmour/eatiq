-- eatIQ: lista de espera + upload de CSVs de pedidos

create table if not exists public.waitlist (
  id          bigint generated always as identity primary key,
  email       text not null unique,
  nome        text,
  origem      text,
  user_agent  text,
  arquivos    integer not null default 0,
  consentimento boolean not null default false,
  consentido_em timestamptz,
  created_at  timestamptz not null default now()
);
-- se a tabela já existia sem a coluna:
alter table public.waitlist add column if not exists arquivos integer not null default 0;
alter table public.waitlist add column if not exists consentimento boolean not null default false;
alter table public.waitlist add column if not exists consentido_em timestamptz;

alter table public.waitlist enable row level security;

drop policy if exists "anon pode entrar na lista" on public.waitlist;
create policy "anon pode entrar na lista"
  on public.waitlist for insert
  to anon
  with check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

drop policy if exists "leitura interna" on public.waitlist;
create policy "leitura interna"
  on public.waitlist for select
  to authenticated, service_role
  using (true);

-- bucket privado para os CSVs (Storage > New bucket também funciona: nome "pedidos", privado)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pedidos', 'pedidos', false, 15728640, array['text/csv','application/json','application/vnd.ms-excel','text/plain','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do nothing;

-- o site só pode gravar no bucket; nunca listar, ler ou apagar
drop policy if exists "anon envia csv de pedidos" on storage.objects;
create policy "anon envia csv de pedidos"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'pedidos');
