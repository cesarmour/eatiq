/* Taste ranking uses purchase signals and dated merchant ratings, never macros. */
window.EatIQTaste=(()=>{
'use strict';
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const formats={hamburguer:/\b(burger|burguer|hamburguer|cheeseburger|big mac|big tasty|mcchicken|mccrispy|whopper|mc.[a-z]*cheddar)\b/,pizza:/\b(pizza|calzone)\b/,massa:/\b(spaghetti|espaguete|carbonara|penne|fettuccine|lasanha|ravioli|nhoque|gnocchi|tagliatelle|talharim|macarrao)\b/,risoto:/\b(risoto|risotto)\b/,sushi:/\b(sushi|sashimi|temaki|uramaki|niguiri|nigiri|hossomaki|jyo|jo de salmao)\b/,lamen:/\b(lamen|ramen|udon)\b/,yakissoba:/\b(yakissoba|yakisoba)\b/,esfiha:/\b(esfiha|esfihas|esfiha|sfiha)\b/,arabe:/\b(kafta|kibe|quibe|beirute|shawarma|falafel)\b/,grelhados:/\b(picanha|parmegiana|bife|file|filet|galeto|costela|churrasco|contrafile|mignon|entrecote|ancho|grelhado|grelhada)\b/,brasileira:/\b(feijoada|moqueca|bobo|baiao|picadinho|strogonoff|stroganoff|estrogonofe|prato feito)\b/,mexicana:/\b(taco|burrito|quesadilla|enchilada)\b/,salada:/\b(salada|poke|bowl)\b/,sanduiche:/\b(sanduiche|ciabatta|baguete|panini)\b/};
const proteins={salmao:/\bsalmao\b/,atum:/\batum\b/,camarao:/\bcamarao\b/,frango:/\b(frango|chicken|galinha)\b/,carne:/\b(carne|bovino|picanha|mignon|costela|ancho)\b/,porco:/\b(bacon|porco|suino|pernil|calabresa)\b/,vegetais:/\b(vegetariano|vegetariana|vegano|vegana|cogumelo|shimeji|shitake|berinjela|falafel)\b/};
const labels={hamburguer:'hambúrgueres',pizza:'pizzas',massa:'massas',risoto:'risotos',sushi:'sushi e sashimi',lamen:'lámen',yakissoba:'yakissoba',esfiha:'esfihas',arabe:'pratos árabes',grelhados:'carnes e grelhados',brasileira:'pratos brasileiros',mexicana:'pratos mexicanos',salada:'saladas e bowls',sanduiche:'sanduíches'};
function features(name,description=''){const n=norm(name),text=n+' '+norm(description);return {formats:Object.keys(formats).filter(k=>formats[k].test(n)),proteins:Object.keys(proteins).filter(k=>proteins[k].test(text))}}
function meal(item){const n=norm(item.name),cat=norm(item.category);return !/bebida|sobremesa|acompanhamento|entrada|aperitivo|vinho|suplement|snack|chocolate|a granel|para fazer em casa|gel pre|essential nutrition|pura vida/.test(cat)&&!/^(adicional|molho|agua|suco|refrigerante|cerveja|mcfritas|batata|fritas|mcnuggets|mega chicken mcnuggets|muffin|talher|carne$)/.test(n)&&features(item.name).formats.length>0}
function quality(s){const n=Number(s.reviews),r=Number(s.rating);return Number.isFinite(n)&&n>0&&Number.isFinite(r)&&r>=0&&r<=5?(r*n+4.3*50)/(n+50):null}
function recommend(orders,items,catalog,mode='curadoria',options={}){
 if(!catalog?.items?.length)return {suggestions:[],restaurants:[],reason:'Sem cardápio disponível para este filtro.'};
 const os=new Map(orders.filter(o=>o.tipo==='Restaurante').map(o=>[String(o.id),o]));
 const stores=new Map(catalog.stores.map(s=>[s.id,s])),aliases=new Map();
 for(const s of stores.values())for(const a of [s.name,s.alias]){const key=norm(a);if(!key)continue;if(!aliases.has(key))aliases.set(key,s.id);else if(aliases.get(key)!==s.id)aliases.set(key,null)}
 const profile=new Map(),events=new Set(),seen=new Set(),seenAny=new Set(),visited=new Set(),dishOrders=new Map();let total=0;
 const newest=Math.max(0,...[...os.values()].map(o=>Date.parse(o.criado_em)||0));
 for(const i of items){const o=os.get(String(i.pedido_id));if(!o||i.alimento!==true||!i.nome)continue;
 const sid=norm(o.app)==='ifood'?aliases.get(norm(o.loja)):null;if(sid)visited.add(sid);
 const dk=(sid||norm(o.loja))+'|'+norm(i.nome);if(!dishOrders.has(dk))dishOrders.set(dk,new Set());dishOrders.get(dk).add(String(o.id));seen.add(dk);seenAny.add(norm(i.nome));
 const f=features(i.nome);const weight=Math.pow(.5,Math.max(0,newest-(Date.parse(o.criado_em)||newest))/86400000/120);
 for(const token of [...f.formats.map(x=>'f:'+x),...f.proteins.map(x=>'p:'+x)]){const key=o.id+'|'+token;if(events.has(key))continue;events.add(key);profile.set(token,(profile.get(token)||0)+weight);if(token.startsWith('f:'))total+=weight}
 }
 if(!total)return {suggestions:[],restaurants:[],reason:'Ainda faltam pratos identificáveis no histórico para personalizar suas sugestões.'};
 const max=Math.max(...[...profile].filter(([k])=>k.startsWith('f:')).map(([,v])=>v));
 const candidates=[],dedup=new Set();
 for(const item of catalog.items){const s=stores.get(item.storeId);if(!s||!meal(item))continue;const key=s.id+'|'+norm(item.name);if(dedup.has(key))continue;dedup.add(key);
 const repeated=seen.has(key)||seenAny.has(norm(item.name));if(mode==='descobrir'&&repeated||mode==='favoritos'&&!repeated)continue;
 const f=features(item.name,item.description),matched=f.formats.filter(k=>profile.has('f:'+k)).sort((a,b)=>profile.get('f:'+b)-profile.get('f:'+a));if(!matched.length)continue;
 const q=quality(s);if(q===null||+s.rating<4||+s.reviews<10)continue;
 const affinity=Math.sqrt(profile.get('f:'+matched[0])/max);
 const protein=Math.max(0,...f.proteins.map(k=>(profile.get('p:'+k)||0)/Math.max(1,max)));
 candidates.push({...item,store:s,format:matched[0],quality:q,score:affinity*.65+Math.min(1,protein)*.1+Math.max(0,(q-4)/1)*.25,reason:'Combina com seu histórico de '+labels[matched[0]],repeated,exactRepeat:seen.has(key),times:dishOrders.get(key)?.size||0,visited:visited.has(s.id)});
 }
 candidates.sort((a,b)=>b.score-a.score||b.quality-a.quality||a.name.localeCompare(b.name));
 const family=d=>['lamen','yakissoba','sushi'].includes(d.format)?'japonesa':['arabe','esfiha'].includes(d.format)?'arabe':d.format;
 const selected=[],usedStores=new Set(),usedFamilies=new Set();
 const eligible=d=>!usedStores.has(d.storeId)&&!usedFamilies.has(family(d));
 const pick=(pool,label,purpose)=>{const d=pool.find(eligible);if(!d)return;selected.push({...d,label,purpose});usedStores.add(d.storeId);usedFamilies.add(family(d));};
 if(['budget','lowcarb','proteina','variar'].includes(mode)){
  const budget=Number(options.budget??50);
  let pool=candidates;
  if(mode==='budget')pool=pool.filter(d=>Number.isFinite(+d.price)&&+d.price>0&&+d.price<=budget&&!['esfiha'].includes(d.format)&&!/[0-9]+\s*(pecas|unidades)|dupla|unidade/.test(norm(d.name)));
  if(mode==='variar')pool=pool.filter(d=>!d.repeated);
  if(mode==='lowcarb'||mode==='proteina')pool=pool.flatMap(d=>{
   if(d.choices||/combo|para [2-9]|serve [2-9]|familia/.test(norm(d.name)))return [];
   let n;try{n=options.estimate?.(d)}catch{return []}
   if(!n||!n.alimento||n.conf<40||!n.used?.length||![n.kcal,n.p,n.c,n.f,n.gramas].every(Number.isFinite)||n.gramas<100||n.gramas>700||n.kcal<100||n.kcal>1200||n.p<0||n.c<0||n.f<0)return [];
   if(mode==='lowcarb'&&(n.c>20||n.c*4/n.kcal>.25))return [];
   if(mode==='proteina'&&(n.p<25||n.p*4/n.kcal<.2))return [];
   return [{...d,nutrition:n}];
  });
  const titles={budget:'No budget',lowcarb:'Low-carb · estimado',proteina:'Mais proteína · estimado',variar:'Para variar'};
  const purposes={budget:'Até R$ '+budget.toFixed(2).replace('.',',')+' pelo item na coleta, sem entrega. Boa avaliação e afinidade continuam obrigatórias.',lowcarb:'Até 20 g de carboidratos e 25% da energia estimada do item. Confira porção e acompanhamentos.',proteina:'Pelo menos 25 g de proteína e 20% da energia estimada do item. Confira porção e composição.',variar:'Um nome que ainda não aparece nos seus pedidos do filtro.'};
  for(const d of pool){if(!eligible(d))continue;pick([d],titles[mode],purposes[mode]);if(selected.length===3)break}
  return {suggestions:selected,restaurants:[],collectedAt:catalog.collectedAt,reason:selected.length?'':'Não há três opções distintas com dados suficientes para este objetivo. Amplie o orçamento ou escolha outra categoria.'};
 }
 // Reserve an occasion dish with concrete menu evidence; price is never a proxy for quality.
 const special=candidates.filter(d=>+d.store.rating>=4.5&&+d.store.reviews>=50&&/\b(picanha|ancho|entrecote|mignon|risoto|risotto|carbonara|ravioli|bacalhau|polvo|camarao|cordeiro)\b/.test(norm(d.name))&&!['yakissoba','sanduiche','hamburguer'].includes(d.format));
 const favorites=candidates.filter(d=>d.exactRepeat&&d.times>=2).sort((a,b)=>b.times-a.times||b.score-a.score);
 pick(favorites,'Seu favorito','Um prato que você já escolheu '+(favorites[0]?.times||0)+' vezes, em um restaurante bem avaliado.');
 pick(special,'Para uma ocasião especial','Uma opção para mudar o ritmo, dentro dos sabores que você costuma escolher.');
 pick(candidates.filter(d=>!d.repeated),'Para variar','Um prato que ainda não aparece com este nome no seu histórico do filtro.');
 if(selected.length<3)pick(candidates,'Seu estilo','Uma opção alinhada aos tipos de prato que aparecem nos seus pedidos.');
 const priority={'Seu favorito':0,'Seu estilo':0,'Para variar':1,'Para uma ocasião especial':2};selected.sort((a,b)=>priority[a.label]-priority[b.label]);
 return {suggestions:selected,restaurants:[],reason:selected.length?'':'Não há opções suficientemente distintas e bem avaliadas neste cardápio.',collectedAt:catalog.collectedAt};
}
return {recommend,features,meal,quality};
})();
