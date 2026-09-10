-- Generated from the ordered SQL sources. Apply before deploying site/.
begin;

-- SOURCE: supabase-app.sql
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



-- SOURCE: supabase-health.sql
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



-- SOURCE: supabase-motor.sql
-- eatIQ: motor de análise nutricional (rode inteiro no SQL Editor; pode repetir)

-- 1) base de ingredientes: valores por 100 g ou 100 ml como consumido
-- Preserve public.nutri_ingredientes and existing data.
create table if not exists public.nutri_ingredientes (
  id bigint generated always as identity primary key,
  nome text not null unique, categoria text,
  kcal numeric not null, prot numeric not null, carb numeric not null, gord numeric not null,
  palavras text not null  -- regex de palavras-chave para casar com o nome do produto
);
alter table public.nutri_ingredientes enable row level security;
drop policy if exists "base pública" on public.nutri_ingredientes;
create policy "base pública" on public.nutri_ingredientes for select to anon, authenticated using (true);

insert into public.nutri_ingredientes (nome,categoria,kcal,prot,carb,gord,palavras) values
('arroz branco cozido','carbo',128,2.5,28,0.2,'arroz'),
('arroz sírio','carbo',150,4,26,3,'arroz sirio|arroz sírio'),
('feijão cozido','leguminosa',76,4.8,13.6,0.5,'feijao|feijão'),
('feijoada (feijão com carnes)','leguminosa',150,10,10,7,'feijoada'),
('massa cozida','carbo',158,5.8,31,0.9,'massa|macarrao|macarrão|spaghetti|espaguete|fettuccine|penne|linguini|linguine|talharim|nhoque|gnocchi|lasanha|ravioli|capeletti|capelete|tortellini|fusilli|rigatoni'),
('massa de pizza assada','carbo',275,8,52,3,'pizza'),
('pão de hambúrguer','carbo',270,9,50,4,'pao|pão'),
('pão francês','carbo',300,9,58,3,'pao frances|pão francês|pao na chapa|pão na chapa'),
('pão sírio','carbo',275,9,56,1,'pao sirio|pão sírio|pita'),
('tortilla','carbo',300,8,50,7,'tortilla|taco|burrito|quesadilla'),
('batata frita','carbo',312,3.4,41,15,'batata frita|fritas|fries|batatas'),
('batata doce','carbo',86,1.6,20,0.1,'batata doce'),
('polenta','carbo',85,2,18,0.5,'polenta'),
('farofa','carbo',400,4,60,16,'farofa'),
('quinoa cozida','carbo',120,4.4,21,1.9,'quinoa'),
('grão de bico','leguminosa',164,9,27,2.6,'grao de bico|grão de bico|homus|hummus'),
('frango grelhado','proteina',165,31,0,3.6,'frango|galeto|sobrecoxa|chicken|peito'),
('frango empanado','proteina',250,19,15,13,'frango empanado|nuggets|frango a passarinho|frango frito|crispy'),
('carne bovina grelhada','proteina',250,26,0,16,'carne|bovino|picanha|contra file|contrafile|contrafilé|alcatra|fraldinha|bife|steak|rib eye|ribeye|entrecote|ancho|chorizo|maminha'),
('filé mignon','proteina',190,29,0,8,'file mignon|filé mignon|filet mignon|mignon'),
('costela bovina','proteina',330,22,0,27,'costela|ribs'),
('carne moída','proteina',240,22,0,16,'carne moida|carne moída|bolonhesa|ragu|ragú|kafta|kibe|quibe'),
('hambúrguer de carne','proteina',250,20,0,18,'burger|hamburguer|hambúrguer|smash|cheeseburger|whopper|big mac'),
('porco assado','proteina',250,27,0,15,'porco|suino|suíno|lombo|pernil|leitao|leitão|pork'),
('bacon','proteina',540,37,1,42,'bacon'),
('linguiça','proteina',290,15,1,25,'linguica|linguiça|calabresa|toscana|chorizo|salsicha|hot dog|cachorro quente'),
('chashu (porco)','proteina',300,20,0,24,'chashu|tyashu|char siu'),
('salmão','proteina',208,20,0,13,'salmao|salmão|salmon'),
('atum','proteina',130,28,0,1,'atum|tuna'),
('peixe branco','proteina',110,23,0,2,'peixe|tilapia|tilápia|linguado|robalo|bacalhau|pescada|fish'),
('camarão','proteina',99,24,0,1,'camarao|camarão|shrimp'),
('lula e polvo','proteina',92,16,3,1,'lula|polvo'),
('ovo','proteina',155,13,1,11,'ovo|omelete|egg'),
('tofu','proteina',76,8,2,4.8,'tofu'),
('mussarela','laticinio',300,22,2,22,'mussarela|muçarela|mozzarella|queijo'),
('parmesão','laticinio',430,38,4,29,'parmesao|parmesão|parmegiana|grana'),
('catupiry / cream cheese','laticinio',250,9,3,22,'catupiry|requeijao|requeijão|cream cheese|philadelphia'),
('queijo prato / presunto','laticinio',280,22,1,20,'presunto|queijo prato|misto'),
('molho de tomate','molho',30,1.3,5,0.5,'molho de tomate|pomodoro|sugo|marinara|napolitana'),
('molho branco / creme','molho',150,3,6,13,'molho branco|creme|cream|alfredo|carbonara|4 queijos|quatro queijos'),
('maionese e molhos gordos','molho',600,1,4,66,'maionese|aioli|molho especial|molho da casa'),
('molho barbecue / shoyu','molho',120,1,25,0.3,'barbecue|bbq|shoyu|teriyaki|agridoce|ketchup'),
('guacamole','molho',150,2,8,13,'guacamole|abacate|avocado'),
('azeite','gordura',884,0,0,100,'azeite'),
('manteiga','gordura',720,0.5,0,81,'manteiga'),
('salada verde','vegetal',20,1.5,3,0.2,'salada|alface|rucula|rúcula|folhas|mix de folhas'),
('legumes cozidos ou grelhados','vegetal',60,2,8,2,'legumes|brocolis|brócolis|abobrinha|berinjela|cenoura|vegetais|couve-flor|aspargos|cogumelo|shimeji'),
('couve refogada','vegetal',90,3,8,6,'couve'),
('vinagrete','vegetal',50,1,6,3,'vinagrete'),
('tabule','vegetal',90,3,12,4,'tabule|tabbouleh'),
('arroz de sushi','carbo',130,2.7,29,0.3,'sushi|nigiri|uramaki|hossomaki|hot roll|temaki|combinado|joy|jow|peças|pecas'),
('caldo missô','molho',40,3,5,1,'lamen|lámen|ramen|misso|missô|miso'),
('caldo / sopa','molho',45,3,5,1.5,'caldo|sopa|brodo|canja|creme de'),
('açaí (polpa adoçada)','doce',110,1,20,3,'acai|açaí|açai'),
('granola','carbo',450,10,64,16,'granola'),
('banana','fruta',90,1,23,0.3,'banana'),
('frutas','fruta',55,0.8,13,0.2,'fruta|morango|manga|abacaxi|mamao|mamão|melancia|uva|laranja|salada de frutas'),
('suco natural','bebida',45,0.5,11,0,'suco|juice|limonada'),
('refrigerante','bebida',42,0,10.6,0,'refrigerante|coca|coca-cola|guarana|guaraná|pepsi|fanta|sprite|soda|tonica|tônica'),
('refrigerante zero','bebida',0,0,0,0,'zero|diet|light|sem acucar|sem açúcar'),
('água','bebida',0,0,0,0,'agua|água|water'),
('cerveja','bebida',43,0.5,3.6,0,'cerveja|chopp|chope|heineken|brahma|stella|corona|budweiser|skol|ipa|lager|pilsen|beer'),
('vinho','bebida',85,0,2.6,0,'vinho|wine|espumante|prosecco'),
('destilado / caipirinha','bebida',230,0,12,0,'caipirinha|caipiroska|whisky|whiskey|gin|vodka|rum|cachaca|cachaça|tequila|drink|cocktail|coquetel'),
('café e chá','bebida',2,0,0,0,'cafe|café|espresso|expresso|cha|chá'),
('café com leite / frappuccino','bebida',110,3,16,4,'cappuccino|latte|frappuccino|mocha|chocolate quente|milkshake'),
('sorvete / gelato','doce',210,4,24,11,'sorvete|gelato|ice cream|milk shake'),
('bolo / torta doce','doce',350,5,50,15,'bolo|torta|cheesecake|brownie|cookie|cupcake|pudim|mousse|tiramisu|petit gateau|doce|sobremesa|dessert'),
('chocolate / brigadeiro','doce',480,5,60,24,'chocolate|brigadeiro|nutella|kit kat|kinder|trufa|bombom'),
('croissant / folhado','carbo',400,8,45,21,'croissant|folhado|pao de queijo|pão de queijo|salgado|coxinha|esfiha|esfirra|empada|kibe|quibe|pastel|bolinho'),
('doces árabes','doce',420,6,55,20,'baklava|doces arabes|doces árabes|marlabie|mhalab|malabi|atayef|nata|halawa|ninho'),
('pipoca / snacks','carbo',500,7,55,28,'pipoca|chips|batata palha|salgadinho|doritos|ruffles'),
('amendoim / castanhas','gordura',580,25,18,48,'amendoim|castanha|nozes|amêndoa|amendoa|mix de'),
('leite','laticinio',60,3.2,4.8,3.2,'leite'),
('whey / suplemento proteico','proteina',380,78,8,5,'whey|proteina isolada|proteína isolada|barra de proteina|barra de proteína|suplemento'),
('arroz integral cru (pacote)','carbo',350,7,74,2.5,'arroz integral|arroz 7 graos|arroz sete graos|arroz parboilizado'),
('arroz cru (pacote)','carbo',360,7,79,0.5,'arroz (branco|tipo 1|parboilizado|agulhinha|camil|tio joao).*(kg|g)\b'),
('cerveja sem álcool','bebida',20,0.3,4.5,0,'cerveja (sem alcool|zero|0[,.]0)'),
('iogurte','laticinio',80,4,10,2.5,'iogurte|yogurt|yakult'),
('cereal / aveia','carbo',380,10,68,6,'cereal|aveia|sucrilhos|muesli'),
('azeitona / conservas','gordura',140,1,3,14,'azeitona|conserva|picles') on conflict (nome) do nothing;


-- 2) pratos: padrão (regex) -> composição em gramas por ingrediente. A ordem decide qual padrão vence.
-- Preserve public.nutri_pratos and existing data.
create table if not exists public.nutri_pratos (
  id bigint generated always as identity primary key,
  ordem int not null, padrao text not null, descricao text,
  composicao jsonb not null  -- [{"ing":"nome do ingrediente","g":150}, ...]
);
alter table public.nutri_pratos enable row level security;
drop policy if exists "base pública" on public.nutri_pratos;
create policy "base pública" on public.nutri_pratos for select to anon, authenticated using (true);

create unique index if not exists nutri_pratos_ordem_idx on public.nutri_pratos(ordem);
insert into public.nutri_pratos (ordem,padrao,descricao,composicao) values
(1,'feijoada','feijoada completa individual','[{"ing": "feijoada (feijão com carnes)", "g": 450}, {"ing": "arroz branco cozido", "g": 200}, {"ing": "farofa", "g": 50}, {"ing": "couve refogada", "g": 60}, {"ing": "linguiça", "g": 60}]'::jsonb),
(2,'combo|mcoferta|oferta .*(burger|big mac|quarterao|quarterão|mcchicken)|meal|trio','combo lanche + batata + refrigerante','[{"ing": "hambúrguer de carne", "g": 140}, {"ing": "pão de hambúrguer", "g": 65}, {"ing": "mussarela", "g": 30}, {"ing": "maionese e molhos gordos", "g": 15}, {"ing": "batata frita", "g": 110}, {"ing": "refrigerante", "g": 350}]'::jsonb),
(3,'cafe da manha|café da manhã|brunch|breakfast|cesta','café da manhã completo','[{"ing": "pão francês", "g": 150}, {"ing": "croissant / folhado", "g": 80}, {"ing": "ovo", "g": 100}, {"ing": "queijo prato / presunto", "g": 100}, {"ing": "frutas", "g": 150}, {"ing": "suco natural", "g": 400}, {"ing": "manteiga", "g": 20}, {"ing": "bolo / torta doce", "g": 120}]'::jsonb),
(4,'empanada','uma empanada','[{"ing": "croissant / folhado", "g": 55}, {"ing": "carne moída", "g": 40}]'::jsonb),
(5,'pastel|pasteis|pastéis','um pastel','[{"ing": "croissant / folhado", "g": 70}, {"ing": "mussarela", "g": 30}]'::jsonb),
(6,'coxinha|bolinha de queijo|croquete|rissole|risole|bolinho de bacalhau','um salgado frito','[{"ing": "croissant / folhado", "g": 110}]'::jsonb),
(7,'guioza|gyoza|harumaki|rolinho primavera|dumpling','uma unidade','[{"ing": "massa cozida", "g": 22}, {"ing": "carne moída", "g": 14}]'::jsonb),
(8,'sanduiche|sanduíche|sanduba|wrap|beirute|bauru|baguete|panini|toast','sanduíche','[{"ing": "pão francês", "g": 90}, {"ing": "frango grelhado", "g": 100}, {"ing": "mussarela", "g": 30}, {"ing": "maionese e molhos gordos", "g": 15}, {"ing": "salada verde", "g": 30}]'::jsonb),
(9,'tapioca|crepe|panqueca|waffle','tapioca / crepe recheado','[{"ing": "massa de pizza assada", "g": 120}, {"ing": "mussarela", "g": 50}, {"ing": "queijo prato / presunto", "g": 30}]'::jsonb),
(10,'strogonoff|estrogonofe','strogonoff com arroz e batata palha','[{"ing": "frango grelhado", "g": 180}, {"ing": "molho branco / creme", "g": 150}, {"ing": "arroz branco cozido", "g": 180}, {"ing": "batata frita", "g": 60}]'::jsonb),
(11,'escondidinho|baiao|baião|moqueca|bobó|bobo de|vatapa|vatapá|carne de sol|dadinho','prato regional','[{"ing": "carne bovina grelhada", "g": 180}, {"ing": "arroz branco cozido", "g": 150}, {"ing": "farofa", "g": 40}, {"ing": "feijão cozido", "g": 80}, {"ing": "manteiga", "g": 15}]'::jsonb),
(12,'ceviche|tiradito','ceviche','[{"ing": "peixe branco", "g": 180}, {"ing": "legumes cozidos ou grelhados", "g": 60}]'::jsonb),
(13,'sashimi','sashimi','[{"ing": "salmão", "g": 150}]'::jsonb),
(14,'yakimeshi|chahan|arroz frito','arroz frito','[{"ing": "arroz branco cozido", "g": 300}, {"ing": "ovo", "g": 50}, {"ing": "legumes cozidos ou grelhados", "g": 60}, {"ing": "azeite", "g": 10}]'::jsonb),
(15,'bolo de rolo|bolo inteiro|bolo de pote|torta inteira|bolo .*(kg|g)','bolo inteiro (peso do nome quando houver)','[{"ing": "bolo / torta doce", "g": 350}]'::jsonb),
(16,'torta (doce|de limao|de limão|holandesa|de morango|de chocolate|alema|alemã)|torta de|cheesecake|fatia de bolo|fatia de torta','fatia de torta doce','[{"ing": "bolo / torta doce", "g": 150}]'::jsonb),
(17,'agua de coco|água de coco|energetico|energético|isotonico|isotônico|gatorade|red bull','bebida 330 ml','[{"ing": "suco natural", "g": 330}]'::jsonb),
(18,'vitamina|smoothie|shake','vitamina de frutas','[{"ing": "suco natural", "g": 300}, {"ing": "banana", "g": 60}, {"ing": "leite", "g": 100}]'::jsonb),
(19,'porcao|porção|petisco|aperitivo|entrada','porção de petisco','[{"ing": "batata frita", "g": 150}, {"ing": "linguiça", "g": 80}]'::jsonb),
(20,'meia porcao|meia porção|1/2 porcao','meia porção','[{"ing": "batata frita", "g": 80}, {"ing": "linguiça", "g": 40}]'::jsonb),
(21,'pizza .*(brotinho|broto|individual|pequena)|brotinho','pizza brotinho','[{"ing": "massa de pizza assada", "g": 150}, {"ing": "mussarela", "g": 90}, {"ing": "molho de tomate", "g": 60}]'::jsonb),
(22,'(fatia|pedaço|pedaco).*pizza|pizza.*(fatia|pedaço|pedaco)','uma fatia de pizza','[{"ing": "massa de pizza assada", "g": 60}, {"ing": "mussarela", "g": 35}, {"ing": "molho de tomate", "g": 20}]'::jsonb),
(23,'fatia|pedaço|pedaco','uma fatia (doce)','[{"ing": "bolo / torta doce", "g": 150}]'::jsonb),
(24,'pizza','pizza grande inteira (8 fatias)','[{"ing": "massa de pizza assada", "g": 300}, {"ing": "mussarela", "g": 180}, {"ing": "molho de tomate", "g": 100}, {"ing": "linguiça", "g": 40}]'::jsonb),
(25,'big mac|quarterao|quarterão|mcchicken|cheddar mcmelt|whopper|double|duplo|triplo|dupla','hambúrguer duplo','[{"ing": "pão de hambúrguer", "g": 70}, {"ing": "hambúrguer de carne", "g": 140}, {"ing": "mussarela", "g": 30}, {"ing": "maionese e molhos gordos", "g": 15}, {"ing": "salada verde", "g": 30}]'::jsonb),
(26,'burger|hamburguer|hambúrguer|smash|cheese|x-|xis|bacon','hambúrguer simples','[{"ing": "pão de hambúrguer", "g": 60}, {"ing": "hambúrguer de carne", "g": 150}, {"ing": "mussarela", "g": 30}, {"ing": "maionese e molhos gordos", "g": 20}, {"ing": "salada verde", "g": 30}]'::jsonb),
(27,'hot dog|cachorro','hot dog','[{"ing": "pão francês", "g": 60}, {"ing": "linguiça", "g": 80}, {"ing": "maionese e molhos gordos", "g": 20}, {"ing": "molho de tomate", "g": 30}, {"ing": "pipoca / snacks", "g": 10}]'::jsonb),
(28,'nuggets|mcnuggets','nuggets','[{"ing": "frango empanado", "g": 200}]'::jsonb),
(29,'lamen|lámen|ramen|misso|missô|miso|tonkotsu|shoyu ramen|tyashu|tsukemen','lámen completo','[{"ing": "massa cozida", "g": 250}, {"ing": "caldo missô", "g": 400}, {"ing": "chashu (porco)", "g": 90}, {"ing": "ovo", "g": 50}, {"ing": "legumes cozidos ou grelhados", "g": 40}]'::jsonb),
(30,'poke|bowl','poke / bowl','[{"ing": "arroz branco cozido", "g": 200}, {"ing": "salmão", "g": 120}, {"ing": "legumes cozidos ou grelhados", "g": 100}, {"ing": "molho barbecue / shoyu", "g": 20}]'::jsonb),
(31,'galeto|frango|sobrecoxa|peito','frango com acompanhamentos','[{"ing": "frango grelhado", "g": 300}, {"ing": "arroz branco cozido", "g": 150}, {"ing": "feijão cozido", "g": 100}, {"ing": "salada verde", "g": 50}]'::jsonb),
(32,'esfiha|esfirra','uma esfiha','[{"ing": "croissant / folhado", "g": 80}]'::jsonb),
(33,'kibe|quibe','um kibe','[{"ing": "carne moída", "g": 60}, {"ing": "croissant / folhado", "g": 60}]'::jsonb),
(34,'temaki','temaki','[{"ing": "arroz de sushi", "g": 80}, {"ing": "salmão", "g": 50}, {"ing": "catupiry / cream cheese", "g": 20}]'::jsonb),
(35,'sushi|combinado|sashimi|nigiri|uramaki|hossomaki|hot roll|peças|pecas|joy|jow','combinado de sushi (~20 a 30 peças)','[{"ing": "arroz de sushi", "g": 300}, {"ing": "salmão", "g": 150}, {"ing": "catupiry / cream cheese", "g": 30}]'::jsonb),
(36,'yakisoba','yakisoba','[{"ing": "massa cozida", "g": 250}, {"ing": "legumes cozidos ou grelhados", "g": 150}, {"ing": "frango grelhado", "g": 100}, {"ing": "molho barbecue / shoyu", "g": 30}]'::jsonb),
(37,'parmegiana','parmegiana com arroz e fritas','[{"ing": "carne bovina grelhada", "g": 200}, {"ing": "molho de tomate", "g": 100}, {"ing": "mussarela", "g": 80}, {"ing": "arroz branco cozido", "g": 150}, {"ing": "batata frita", "g": 120}]'::jsonb),
(38,'mignon|filet|file|filé','filé com acompanhamentos','[{"ing": "filé mignon", "g": 200}, {"ing": "arroz branco cozido", "g": 150}, {"ing": "legumes cozidos ou grelhados", "g": 80}]'::jsonb),
(39,'picanha|costela|ribs|prime|rib eye|ribeye|ancho|chorizo|churrasco|rodizio|rodízio','churrasco com acompanhamentos','[{"ing": "carne bovina grelhada", "g": 300}, {"ing": "arroz branco cozido", "g": 150}, {"ing": "farofa", "g": 50}, {"ing": "vinagrete", "g": 60}]'::jsonb),
(40,'espeto|espetinho','um espeto','[{"ing": "carne bovina grelhada", "g": 90}]'::jsonb),
(41,'kafta|shawarma|kebab|beirute','prato árabe','[{"ing": "carne moída", "g": 180}, {"ing": "arroz sírio", "g": 200}, {"ing": "salada verde", "g": 60}, {"ing": "grão de bico", "g": 60}]'::jsonb),
(42,'molcajete|taco|burrito|fajita|nacho|mexican','prato mexicano','[{"ing": "tortilla", "g": 120}, {"ing": "carne bovina grelhada", "g": 150}, {"ing": "mussarela", "g": 40}, {"ing": "guacamole", "g": 80}, {"ing": "feijão cozido", "g": 100}]'::jsonb),
(43,'lasanha','lasanha','[{"ing": "massa cozida", "g": 200}, {"ing": "carne moída", "g": 120}, {"ing": "molho branco / creme", "g": 120}, {"ing": "mussarela", "g": 60}]'::jsonb),
(44,'risoto|risotto','risoto','[{"ing": "arroz branco cozido", "g": 280}, {"ing": "parmesão", "g": 40}, {"ing": "manteiga", "g": 20}, {"ing": "legumes cozidos ou grelhados", "g": 60}]'::jsonb),
(45,'nhoque|gnocchi|massa|spaghetti|espaguete|fettuccine|penne|linguini|linguine|talharim|ravioli|capeletti|capelete|tortellini|fusilli|rigatoni|carbonara|bolonhesa','massa com molho','[{"ing": "massa cozida", "g": 250}, {"ing": "molho de tomate", "g": 120}, {"ing": "parmesão", "g": 30}]'::jsonb),
(46,'brodo|caldo|sopa|canja|creme de','sopa','[{"ing": "caldo / sopa", "g": 400}, {"ing": "massa cozida", "g": 80}]'::jsonb),
(47,'polenta','polenta com ragu','[{"ing": "polenta", "g": 300}, {"ing": "linguiça", "g": 100}, {"ing": "molho de tomate", "g": 80}]'::jsonb),
(48,'camarao|camarão|shrimp','prato de camarão','[{"ing": "camarão", "g": 250}, {"ing": "arroz branco cozido", "g": 180}, {"ing": "molho branco / creme", "g": 100}, {"ing": "mussarela", "g": 30}]'::jsonb),
(49,'peixe|salmao|salmão|tilapia|tilápia|robalo|bacalhau|moqueca','peixe com acompanhamentos','[{"ing": "peixe branco", "g": 200}, {"ing": "arroz branco cozido", "g": 150}, {"ing": "legumes cozidos ou grelhados", "g": 100}, {"ing": "azeite", "g": 10}]'::jsonb),
(50,'salada|caesar','salada com proteína','[{"ing": "salada verde", "g": 150}, {"ing": "frango grelhado", "g": 120}, {"ing": "parmesão", "g": 20}, {"ing": "maionese e molhos gordos", "g": 20}]'::jsonb),
(51,'marmita|prato feito|executivo|pf|refeição|refeicao','prato feito','[{"ing": "arroz branco cozido", "g": 200}, {"ing": "feijão cozido", "g": 150}, {"ing": "carne bovina grelhada", "g": 150}, {"ing": "salada verde", "g": 60}]'::jsonb),
(52,'suco|juice|limonada','suco 400 ml','[{"ing": "suco natural", "g": 400}]'::jsonb),
(53,'acai|açaí|açai','açaí 500 ml com complementos','[{"ing": "açaí (polpa adoçada)", "g": 400}, {"ing": "granola", "g": 40}, {"ing": "banana", "g": 60}]'::jsonb),
(54,'zero|diet|light','refrigerante zero','[{"ing": "refrigerante zero", "g": 350}]'::jsonb),
(55,'refrigerante|coca|guarana|guaraná|pepsi|fanta|sprite|soda|bebida','lata 350 ml','[{"ing": "refrigerante", "g": 350}]'::jsonb),
(56,'cerveja|chopp|chope|heineken|brahma|stella|corona|budweiser|skol|ipa|lager|pilsen','cerveja 350 ml','[{"ing": "cerveja", "g": 350}]'::jsonb),
(57,'caipirinha|caipiroska|drink|cocktail|coquetel|gin|whisky|vodka','drink 250 ml','[{"ing": "destilado / caipirinha", "g": 250}]'::jsonb),
(58,'vinho|espumante|prosecco','taça de vinho','[{"ing": "vinho", "g": 150}]'::jsonb),
(59,'agua|água','água','[{"ing": "água", "g": 500}]'::jsonb),
(60,'frappuccino|milkshake|milk shake|mocha|latte|cappuccino|chocolate quente','bebida láctea 400 ml','[{"ing": "café com leite / frappuccino", "g": 400}]'::jsonb),
(61,'cafe|café|espresso|cha |chá','café ou chá','[{"ing": "café e chá", "g": 150}]'::jsonb),
(62,'pao na chapa|pão na chapa|pao com manteiga|pão com manteiga','pão na chapa','[{"ing": "pão francês", "g": 60}, {"ing": "manteiga", "g": 15}]'::jsonb),
(63,'misto|pão de queijo|pao de queijo|croissant|coxinha|pastel|empada|bolinho|salgado','salgado / folhado','[{"ing": "croissant / folhado", "g": 90}]'::jsonb),
(64,'gelato|sorvete|ice cream','sorvete ~300 g','[{"ing": "sorvete / gelato", "g": 300}]'::jsonb),
(65,'bolo','bolo pequeno inteiro','[{"ing": "bolo / torta doce", "g": 320}]'::jsonb),
(66,'torta|cheesecake|brownie|cookie|pudim|mousse|tiramisu|petit gateau|sobremesa|dessert|doce','fatia de doce','[{"ing": "bolo / torta doce", "g": 150}]'::jsonb),
(67,'brigadeiro|chocolate|bombom|trufa','doce pequeno','[{"ing": "chocolate / brigadeiro", "g": 40}]'::jsonb),
(68,'baklava|mhalab|malabi|atayef|nata|halawa|doces arabes|doces árabes','doce árabe','[{"ing": "doces árabes", "g": 120}]'::jsonb),
(69,'omelete|ovo','omelete','[{"ing": "ovo", "g": 120}, {"ing": "mussarela", "g": 30}]'::jsonb),
(70,'legumes|vegetais|grelhado','legumes','[{"ing": "legumes cozidos ou grelhados", "g": 200}]'::jsonb),
(71,'batata|fritas|mcfritas|fries','porção de fritas','[{"ing": "batata frita", "g": 150}]'::jsonb),
(72,'arroz','porção de arroz','[{"ing": "arroz branco cozido", "g": 200}]'::jsonb),
(73,'feijao|feijão','porção de feijão','[{"ing": "feijão cozido", "g": 150}]'::jsonb),
(74,'farofa','farofa','[{"ing": "farofa", "g": 60}]'::jsonb),
(75,'couve','couve','[{"ing": "couve refogada", "g": 80}]'::jsonb),
(76,'vinagrete','vinagrete','[{"ing": "vinagrete", "g": 80}]'::jsonb),
(77,'carne|bovino|alcatra|fraldinha|bife|steak|maminha','carne com acompanhamentos','[{"ing": "carne bovina grelhada", "g": 200}, {"ing": "arroz branco cozido", "g": 150}, {"ing": "farofa", "g": 40}]'::jsonb),
(78,'porco|lombo|pernil|leitao|leitão|pork','porco com acompanhamentos','[{"ing": "porco assado", "g": 200}, {"ing": "arroz branco cozido", "g": 150}, {"ing": "farofa", "g": 40}]'::jsonb),
(79,'linguica|linguiça|calabresa|toscana','linguiça','[{"ing": "linguiça", "g": 150}]'::jsonb) on conflict (ordem) do nothing;


-- 3) itens não alimentares (regex)
-- Preserve public.nutri_config and existing data.
create table if not exists public.nutri_config (chave text primary key, valor text);
alter table public.nutri_config enable row level security;
drop policy if exists "base pública" on public.nutri_config;
create policy "base pública" on public.nutri_config for select to anon, authenticated using (true);
insert into public.nutri_config values ('nao_alimento', 'racao|ração|petisco para|shampoo|condicionador|sabonete|desodorante|papel higienico|papel higiênico|detergente|amaciante|sabao|sabão|absorvente|fralda|lenco|lenço|escova|pasta de dente|creme dental|remedio|remédio|comprimido|capsula|cápsula|xarope|pomada|vitamina (c|d|b|complexo)|polivitaminico|creatina|omega|ômega|dipirona|paracetamol|ibuprofeno|omeprazol|antialergico|antialérgico|repelente|protetor solar|pilha|bateria|carregador|cabo|lampada|lâmpada|vela|isqueiro|talher|copo (descartavel|descartável|plastico|plástico|de papel)|guardanapo|saco de lixo|esponja|alcool (gel|70|etilico|etílico|liquido|líquido)|agua sanitaria|água sanitária|desinfetante|inseticida|terra vegetal|adubo|brinquedo|areia|tapete|coleira|numero de pessoas|número de pessoas|taxa|embalagem|entrega|gorjeta|cartao|cartão|presente|voucher|descartav|kit descart|copo colecion|copo ronaldinho|copo personalizado|caneca|brinde|colecionavel|colecionável|sacola|taxa de|adicional de embalagem') on conflict (chave) do nothing;

-- 4) itens de cada pedido, com a estimativa e a composição usada
alter table public.pedidos add column if not exists pedido_ref text;
alter table public.pedidos add column if not exists peso_g int;
alter table public.pedidos add column if not exists confianca int;
alter table public.pedidos add column if not exists origem_arquivo text;
create unique index if not exists pedidos_ref_idx on public.pedidos (user_id, app, pedido_ref) where pedido_ref is not null;
drop policy if exists "pedidos próprios: apagar" on public.pedidos;
drop policy if exists "pedidos próprios: apagar" on public.pedidos;
create policy "pedidos próprios: apagar" on public.pedidos for delete to authenticated using (user_id = auth.uid());
drop policy if exists "produtos próprios: apagar" on public.produtos;
drop policy if exists "produtos próprios: apagar" on public.produtos;
create policy "produtos próprios: apagar" on public.produtos for delete to authenticated using (user_id = auth.uid());
drop policy if exists "uploads próprios: editar" on public.uploads;
drop policy if exists "uploads próprios: editar" on public.uploads;
create policy "uploads próprios: editar" on public.uploads for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Preserve public.itens and existing data.
create table if not exists public.itens (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  pedido_id bigint not null references public.pedidos(id) on delete cascade,
  nome text, quantidade numeric, preco numeric,
  alimento boolean, gramas int, kcal int, prot numeric, carb numeric, gord numeric,
  confianca int, prato text, ingredientes jsonb,
  created_at timestamptz not null default now()
);
create index if not exists itens_user_idx on public.itens (user_id, pedido_id);
alter table public.itens enable row level security;
drop policy if exists "itens próprios: ler" on public.itens;
create policy "itens próprios: ler" on public.itens for select to authenticated using (user_id = auth.uid());
drop policy if exists "itens próprios: criar" on public.itens;
create policy "itens próprios: criar" on public.itens for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "itens próprios: apagar" on public.itens;
create policy "itens próprios: apagar" on public.itens for delete to authenticated using (user_id = auth.uid());



-- SOURCE: supabase-fixes.sql
-- eatIQ: correções de segurança e atomicidade (rode inteiro; pode repetir)

-- 1) lista de espera (legado): nenhum usuário do site pode ler. Só o painel (service_role).
do $$ begin
  if to_regclass('public.waitlist') is not null then
    execute 'drop policy if exists "leitura interna" on public.waitlist';
    execute 'revoke all on public.waitlist from anon, authenticated';
  end if;
end $$;
drop policy if exists "anon envia csv de pedidos" on storage.objects;

-- 2) importação atômica: pedidos + itens numa transação só, respeitando RLS (security invoker)
create or replace function public.importar_pedidos(p_pedidos jsonb)
returns table (id bigint, pedido_ref text)
language plpgsql
security invoker
set search_path = public
as $$
#variable_conflict use_column
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



-- SOURCE: migrations/202609100001_reliability.sql
-- Apply after app, health, motor and fixes. No historical orders are removed.
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
