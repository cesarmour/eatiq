-- eatIQ: correções de segurança e atomicidade (rode inteiro; pode repetir)

-- 1) lista de espera (legado): nenhum usuário do site pode ler. Só o painel (service_role).
drop policy if exists "leitura interna" on public.waitlist;
create policy "leitura só pelo painel" on public.waitlist for select to service_role using (true);

-- 2) importação atômica: pedidos + itens numa transação só, respeitando RLS (security invoker)
create or replace function public.importar_pedidos(p_pedidos jsonb)
returns table (id bigint, pedido_ref text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  ped jsonb;
  new_id bigint;
begin
  for ped in select * from jsonb_array_elements(p_pedidos) loop
    insert into public.pedidos (user_id, app, pedido_ref, criado_em, loja, tipo, tipo_loja, total, produtos, taxas, desconto, gorjeta, minutos, km, unidades, itens, kcal, prot, carb, gord, peso_g, confianca, origem_arquivo)
    values (auth.uid(), ped->>'app', ped->>'pedido_ref', (ped->>'criado_em')::timestamptz, ped->>'loja', ped->>'tipo', ped->>'tipo_loja',
      (ped->>'total')::numeric, (ped->>'produtos')::numeric, (ped->>'taxas')::numeric, (ped->>'desconto')::numeric, (ped->>'gorjeta')::numeric,
      nullif(ped->>'minutos','')::numeric, 0, (ped->>'unidades')::numeric, ped->>'itens',
      (ped->>'kcal')::int, (ped->>'prot')::int, (ped->>'carb')::int, (ped->>'gord')::int, (ped->>'peso_g')::int, (ped->>'confianca')::int, ped->>'origem_arquivo')
    on conflict (user_id, app, pedido_ref) where pedido_ref is not null do nothing
    returning pedidos.id into new_id;

    if new_id is null then continue; end if;

    insert into public.itens (user_id, pedido_id, nome, quantidade, preco, alimento, gramas, kcal, prot, carb, gord, confianca, prato, ingredientes)
    select auth.uid(), new_id, i->>'nome', (i->>'quantidade')::numeric, (i->>'preco')::numeric, (i->>'alimento')::boolean,
           (i->>'gramas')::int, (i->>'kcal')::int, (i->>'prot')::numeric, (i->>'carb')::numeric, (i->>'gord')::numeric,
           (i->>'confianca')::int, i->>'prato', coalesce(i->'ingredientes','[]'::jsonb)
    from jsonb_array_elements(coalesce(ped->'itens_detalhe','[]'::jsonb)) as i;

    id := new_id; pedido_ref := ped->>'pedido_ref';
    return next;
  end loop;
end $$;
grant execute on function public.importar_pedidos(jsonb) to authenticated;

-- 3) produtos recalculados numa transação (apaga e recria sem janela vazia)
create or replace function public.recalcular_produtos()
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare n int;
begin
  delete from public.produtos where user_id = auth.uid();
  insert into public.produtos (user_id, app, nome, pedidos, unidades, gasto, tipo)
  select auth.uid(), p.app, i.nome, count(distinct i.pedido_id), sum(coalesce(i.quantidade,0)), round(sum(coalesce(i.preco,0))::numeric,2), max(p.tipo_loja)
  from public.itens i join public.pedidos p on p.id = i.pedido_id
  where i.user_id = auth.uid()
  group by p.app, i.nome
  having sum(coalesce(i.preco,0)) >= 50 or count(distinct i.pedido_id) >= 3;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.recalcular_produtos() to authenticated;

-- 4) pedidos importados sem itens (de importações antigas interrompidas) podem ser reimportados:
--    apaga pedidos do usuário que não têm nenhum item e vieram de arquivo
create or replace function public.limpar_importacoes_incompletas()
returns int language sql security invoker set search_path = public as $$
  with d as (
    delete from public.pedidos p
    where p.user_id = auth.uid() and p.origem_arquivo is not null
      and not exists (select 1 from public.itens i where i.pedido_id = p.id)
    returning 1
  ) select count(*)::int from d;
$$;
grant execute on function public.limpar_importacoes_incompletas() to authenticated;

-- 5) premissas do modelo diário, editáveis pelo usuário
alter table public.profiles add column if not exists kcal_fora_delivery numeric;   -- kcal/dia fora do delivery em dia sem pedido
alter table public.profiles add column if not exists porcao_grande_pct numeric;    -- % do excedente acima de 900 kcal que conta como porção pessoal
alter table public.profiles add column if not exists corte_cenario numeric;        -- kcal/dia do cenário "com mudanças"

-- 6) reprocessar: apaga tudo que veio de arquivo (pedidos, itens em cascata, produtos) para reimportar com a base atual
create or replace function public.apagar_importacoes(p_app text default null)
returns int language sql security invoker set search_path = public as $$
  with d as (
    delete from public.pedidos p where p.user_id = auth.uid() and p.origem_arquivo is not null and (p_app is null or p.app = p_app) returning 1
  ), pr as (
    delete from public.produtos where user_id = auth.uid() returning 1
  ) select count(*)::int from d;
$$;
grant execute on function public.apagar_importacoes(text) to authenticated;
