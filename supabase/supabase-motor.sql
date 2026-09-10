-- eatIQ: motor de análise nutricional (rode inteiro no SQL Editor; pode repetir)

-- 1) base de ingredientes: valores por 100 g ou 100 ml como consumido
drop table if exists public.nutri_ingredientes cascade;
create table public.nutri_ingredientes (
  id bigint generated always as identity primary key,
  nome text not null unique, categoria text,
  kcal numeric not null, prot numeric not null, carb numeric not null, gord numeric not null,
  palavras text not null  -- regex de palavras-chave para casar com o nome do produto
);
alter table public.nutri_ingredientes enable row level security;
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
('azeitona / conservas','gordura',140,1,3,14,'azeitona|conserva|picles');


-- 2) pratos: padrão (regex) -> composição em gramas por ingrediente. A ordem decide qual padrão vence.
drop table if exists public.nutri_pratos cascade;
create table public.nutri_pratos (
  id bigint generated always as identity primary key,
  ordem int not null, padrao text not null, descricao text,
  composicao jsonb not null  -- [{"ing":"nome do ingrediente","g":150}, ...]
);
alter table public.nutri_pratos enable row level security;
create policy "base pública" on public.nutri_pratos for select to anon, authenticated using (true);

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
(79,'linguica|linguiça|calabresa|toscana','linguiça','[{"ing": "linguiça", "g": 150}]'::jsonb);


-- 3) itens não alimentares (regex)
drop table if exists public.nutri_config cascade;
create table public.nutri_config (chave text primary key, valor text);
alter table public.nutri_config enable row level security;
create policy "base pública" on public.nutri_config for select to anon, authenticated using (true);
insert into public.nutri_config values ('nao_alimento', 'racao|ração|petisco para|shampoo|condicionador|sabonete|desodorante|papel higienico|papel higiênico|detergente|amaciante|sabao|sabão|absorvente|fralda|lenco|lenço|escova|pasta de dente|creme dental|remedio|remédio|comprimido|capsula|cápsula|xarope|pomada|vitamina (c|d|b|complexo)|polivitaminico|creatina|omega|ômega|dipirona|paracetamol|ibuprofeno|omeprazol|antialergico|antialérgico|repelente|protetor solar|pilha|bateria|carregador|cabo|lampada|lâmpada|vela|isqueiro|talher|copo (descartavel|descartável|plastico|plástico|de papel)|guardanapo|saco de lixo|esponja|alcool (gel|70|etilico|etílico|liquido|líquido)|agua sanitaria|água sanitária|desinfetante|inseticida|terra vegetal|adubo|brinquedo|areia|tapete|coleira|numero de pessoas|número de pessoas|taxa|embalagem|entrega|gorjeta|cartao|cartão|presente|voucher|descartav|kit descart|copo colecion|copo ronaldinho|copo personalizado|caneca|brinde|colecionavel|colecionável|sacola|taxa de|adicional de embalagem');

-- 4) itens de cada pedido, com a estimativa e a composição usada
alter table public.pedidos add column if not exists pedido_ref text;
alter table public.pedidos add column if not exists peso_g int;
alter table public.pedidos add column if not exists confianca int;
alter table public.pedidos add column if not exists origem_arquivo text;
create unique index if not exists pedidos_ref_idx on public.pedidos (user_id, app, pedido_ref) where pedido_ref is not null;
drop policy if exists "pedidos próprios: apagar" on public.pedidos;
create policy "pedidos próprios: apagar" on public.pedidos for delete to authenticated using (user_id = auth.uid());
drop policy if exists "produtos próprios: apagar" on public.produtos;
create policy "produtos próprios: apagar" on public.produtos for delete to authenticated using (user_id = auth.uid());
drop policy if exists "uploads próprios: editar" on public.uploads;
create policy "uploads próprios: editar" on public.uploads for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop table if exists public.itens;
create table public.itens (
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
create policy "itens próprios: ler" on public.itens for select to authenticated using (user_id = auth.uid());
create policy "itens próprios: criar" on public.itens for insert to authenticated with check (user_id = auth.uid());
create policy "itens próprios: apagar" on public.itens for delete to authenticated using (user_id = auth.uid());
