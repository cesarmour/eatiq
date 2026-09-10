-- Shared merchant information only; no user history, address or delivery context.
create table if not exists public.shared_menu_catalogs (
 source text primary key,
 data jsonb not null check(jsonb_typeof(data) = 'object'),
 updated_at timestamptz not null default now()
);
alter table public.shared_menu_catalogs enable row level security;
revoke all on public.shared_menu_catalogs from public,anon,authenticated;
grant select on public.shared_menu_catalogs to authenticated;
drop policy if exists shared_menus_read on public.shared_menu_catalogs;
create policy shared_menus_read on public.shared_menu_catalogs for select to authenticated using (true);
