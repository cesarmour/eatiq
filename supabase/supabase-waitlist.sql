-- Retired: the application no longer uploads raw files or uses a waitlist.
-- Preserve historical rows while closing client access.
do $$ begin
  if to_regclass('public.waitlist') is not null then
    execute 'revoke all on public.waitlist from anon, authenticated';
    execute 'drop policy if exists "leitura interna" on public.waitlist';
    execute 'drop policy if exists "anon pode entrar na lista" on public.waitlist';
  end if;
end $$;
drop policy if exists "anon envia csv de pedidos" on storage.objects;
