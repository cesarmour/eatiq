-- Apply after app, health, motor and fixes. No historical orders are removed.
begin;
alter table public.pedidos add column if not exists versao_motor text;
create unique index if not exists pedidos_owner_idx on public.pedidos(id,user_id);
do $$ begin
 if not exists(select 1 from pg_constraint where conname='itens_owner_fk' and conrelid='public.itens'::regclass) then
  alter table public.itens add constraint itens_owner_fk foreign key(pedido_id,user_id) references public.pedidos(id,user_id) on delete cascade not valid;
 end if;
 if not exists(select 1 from public.itens i left join public.pedidos p on p.id=i.pedido_id and p.user_id=i.user_id where p.id is null) then
  alter table public.itens validate constraint itens_owner_fk;
 else
  raise warning 'Historical items with mismatched ownership require review; no rows were deleted.';
 end if;
end $$;
create index if not exists itens_pedido_idx on public.itens(pedido_id);
create index if not exists produtos_user_gasto_idx on public.produtos(user_id,gasto desc);
create index if not exists uploads_user_date_idx on public.uploads(user_id,created_at desc);
drop policy if exists "pedidos próprios: editar" on public.pedidos;
create policy "pedidos próprios: editar" on public.pedidos for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
-- Also reject references to another user's order before checking the FK.
drop policy if exists "itens próprios: criar" on public.itens;
create policy "itens próprios: criar" on public.itens for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.pedidos p where p.id=pedido_id and p.user_id=auth.uid()));
grant select,insert,update,delete on public.pedidos to authenticated;
grant select,insert,delete on public.itens,public.produtos to authenticated;
grant select,insert,update on public.uploads,public.profiles to authenticated;
grant usage,select on sequence public.pedidos_id_seq,public.itens_id_seq,public.produtos_id_seq,public.uploads_id_seq to authenticated;

-- Complete order replacement in a transaction; reprocessing never clears history first.
create or replace function public.importar_pedidos_v2(p_pedidos jsonb,p_reprocessar boolean default false)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare ped jsonb; item jsonb; pid bigint; n int:=0; u uuid:=auth.uid();
begin
 if u is null then raise exception 'Authentication required'; end if;
 if jsonb_typeof(p_pedidos) is distinct from 'array' then raise exception 'Expected orders array'; end if;
 if jsonb_array_length(p_pedidos)>100 then raise exception 'Maximum 100 orders per batch'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 for ped in select value from jsonb_array_elements(p_pedidos) loop
  if coalesce(ped->>'app','') not in ('iFood','Rappi') or coalesce(length(ped->>'pedido_ref'),0) not between 1 and 120 or nullif(ped->>'criado_em','') is null then raise exception 'Invalid order identity'; end if;
  if coalesce((ped->>'total')::numeric,-1) not between 0 and 10000000 then raise exception 'Invalid order total'; end if;
  if jsonb_typeof(ped->'itens_detalhe') is distinct from 'array' then raise exception 'Expected items array'; end if;
  if jsonb_array_length(ped->'itens_detalhe')>500 then raise exception 'Maximum 500 items per order'; end if;
  select p.id into pid from public.pedidos p where p.user_id=u and p.app=ped->>'app' and p.pedido_ref=ped->>'pedido_ref' for update;
  if pid is not null and not coalesce(p_reprocessar,false) then continue; end if;
  if pid is null then
   insert into public.pedidos(user_id,app,pedido_ref) values(u,ped->>'app',ped->>'pedido_ref') returning id into pid;
  end if;
  update public.pedidos set criado_em=(ped->>'criado_em')::timestamptz,loja=left(ped->>'loja',120),tipo=ped->>'tipo',tipo_loja=ped->>'tipo_loja',
   total=(ped->>'total')::numeric,produtos=(ped->>'produtos')::numeric,taxas=(ped->>'taxas')::numeric,desconto=(ped->>'desconto')::numeric,gorjeta=(ped->>'gorjeta')::numeric,
   minutos=(ped->>'minutos')::numeric,km=0,unidades=(ped->>'unidades')::numeric,itens=left(ped->>'itens',1000),origem_arquivo=left(ped->>'origem_arquivo',120),versao_motor=left(ped->>'versao_motor',40)
   where id=pid and user_id=u;
  delete from public.itens where pedido_id=pid and user_id=u;
  for item in select value from jsonb_array_elements(ped->'itens_detalhe') loop
   if coalesce((item->>'quantidade')::numeric,0) not between 0.001 and 10000 or coalesce((item->>'preco')::numeric,-1) not between 0 and 10000000 then raise exception 'Invalid item quantity or price'; end if;
   if coalesce((item->>'kcal')::numeric,-1) not between 0 and 10000000 or coalesce((item->>'gramas')::numeric,-1) not between 0 and 10000000 then raise exception 'Invalid nutrition'; end if;
   if coalesce((item->>'prot')::numeric,-1) not between 0 and 10000000 or coalesce((item->>'carb')::numeric,-1) not between 0 and 10000000 or coalesce((item->>'gord')::numeric,-1) not between 0 and 10000000 then raise exception 'Invalid macros'; end if;
   if coalesce((item->>'confianca')::int,-1) not between 0 and 100 then raise exception 'Invalid confidence'; end if;
   insert into public.itens(user_id,pedido_id,nome,quantidade,preco,alimento,gramas,kcal,prot,carb,gord,confianca,prato,ingredientes)
   values(u,pid,left(item->>'nome',120),(item->>'quantidade')::numeric,(item->>'preco')::numeric,coalesce((item->>'alimento')::boolean,false),
    (item->>'gramas')::int,(item->>'kcal')::int,(item->>'prot')::numeric,(item->>'carb')::numeric,(item->>'gord')::numeric,(item->>'confianca')::int,left(item->>'prato',300),coalesce(item->'ingredientes','[]'::jsonb));
  end loop;
  update public.pedidos p set kcal=a.k,prot=a.pr,carb=a.c,gord=a.f,peso_g=a.g,confianca=a.conf from (
   select coalesce(sum(kcal),0)::int k,round(coalesce(sum(prot),0))::int pr,round(coalesce(sum(carb),0))::int c,round(coalesce(sum(gord),0))::int f,coalesce(sum(gramas),0)::int g,
    coalesce(round(sum(confianca::numeric*kcal)/nullif(sum(kcal),0)),0)::int conf from public.itens where pedido_id=pid and user_id=u and alimento
  ) a where p.id=pid and p.user_id=u;
  n:=n+1;
 end loop;
 perform public.recalcular_produtos();
 return jsonb_build_object('gravados',n);
end $$;
revoke all on function public.importar_pedidos_v2(jsonb,boolean) from public,anon;
grant execute on function public.importar_pedidos_v2(jsonb,boolean) to authenticated;
-- Legacy client compatibility, with no anonymous execution.
revoke all on function public.importar_pedidos(jsonb),public.recalcular_produtos(),public.limpar_importacoes_incompletas(),public.apagar_importacoes(text) from public,anon;
grant execute on function public.importar_pedidos(jsonb),public.recalcular_produtos(),public.limpar_importacoes_incompletas(),public.apagar_importacoes(text) to authenticated;

-- Token-scoped SELECT is needed for repeat upserts; never exposes another account.
drop policy if exists "atalho: ler com token" on public.health_daily;
create policy "atalho: ler com token" on public.health_daily for select to anon using(user_id=public.sync_user_id());
grant select,insert,update on public.health_daily to anon,authenticated;
-- Clean legacy permissions whether or not waitlist exists.
do $$ begin
 if to_regclass('public.waitlist') is not null then execute 'revoke all on public.waitlist from anon,authenticated'; end if;
end $$;
drop policy if exists "anon envia csv de pedidos" on storage.objects;
create or replace function public.produtos_periodo(p_app text default null,p_inicio timestamptz default null,p_fim timestamptz default null)
returns table(app text,nome text,pedidos bigint,unidades numeric,gasto numeric)
language sql stable security invoker set search_path=public as $$
 select p.app,i.nome,count(distinct p.id),sum(i.quantidade),round(sum(i.preco),2)
 from public.itens i join public.pedidos p on p.id=i.pedido_id and p.user_id=i.user_id
 where p.user_id=auth.uid() and p.tipo='Mercado'
 and (p_app is null or p.app=p_app) and (p_inicio is null or p.criado_em>=p_inicio) and (p_fim is null or p.criado_em<p_fim)
 group by p.app,i.nome order by sum(i.preco) desc,p.app,i.nome limit 10;
$$;
revoke all on function public.produtos_periodo(text,timestamptz,timestamptz) from public,anon;
grant execute on function public.produtos_periodo(text,timestamptz,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;
