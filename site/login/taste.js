/* Taste ranking uses purchase signals and dated merchant ratings, never macros. */
window.EatIQTaste=(()=>{
'use strict';
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const formats={hamburguer:/\b(burger|burguer|hamburguer|cheeseburger|big mac|big tasty|mcchicken|mccrispy|whopper|mc.[a-z]*cheddar)\b/,pizza:/\b(pizza|calzone)\b/,massa:/\b(spaghetti|espaguete|carbonara|penne|fettuccine|lasanha|ravioli|nhoque|gnocchi|tagliatelle|talharim|macarrao)\b/,risoto:/\b(risoto|risotto)\b/,sushi:/\b(sushi|sashimi|temaki|uramaki|niguiri|nigiri|hossomaki|jyo|jo de salmao)\b/,lamen:/\b(lamen|ramen|yakissoba|yakisoba|udon)\b/,esfiha:/\b(esfiha|esfihas|esfiha|sfiha)\b/,arabe:/\b(kafta|kibe|quibe|beirute|shawarma|falafel)\b/,grelhados:/\b(picanha|parmegiana|bife|file|filet|galeto|costela|churrasco|contrafile|mignon|entrecote|ancho|grelhado|grelhada)\b/,brasileira:/\b(feijoada|moqueca|bobo|baiao|picadinho|strogonoff|stroganoff|estrogonofe|prato feito)\b/,mexicana:/\b(taco|burrito|quesadilla|enchilada)\b/,salada:/\b(salada|poke|bowl)\b/,sanduiche:/\b(sanduiche|ciabatta|baguete|panini)\b/};
const proteins={salmao:/\bsalmao\b/,atum:/\batum\b/,camarao:/\bcamarao\b/,frango:/\b(frango|chicken|galinha)\b/,carne:/\b(carne|bovino|picanha|mignon|costela|ancho)\b/,porco:/\b(bacon|porco|suino|pernil|calabresa)\b/,vegetais:/\b(vegetariano|vegetariana|vegano|vegana|cogumelo|shimeji|shitake|berinjela|falafel)\b/};
const labels={hamburguer:'hambúrgueres',pizza:'pizzas',massa:'massas',risoto:'risotos',sushi:'sushi e sashimi',lamen:'lámen e yakissoba',esfiha:'esfihas',arabe:'pratos árabes',grelhados:'carnes e grelhados',brasileira:'pratos brasileiros',mexicana:'pratos mexicanos',salada:'saladas e bowls',sanduiche:'sanduíches'};
function features(name,description=''){const n=norm(name),text=n+' '+norm(description);return {formats:Object.keys(formats).filter(k=>formats[k].test(n)),proteins:Object.keys(proteins).filter(k=>proteins[k].test(text))}}
function meal(item){const n=norm(item.name),cat=norm(item.category);return !/bebida|sobremesa|acompanhamento|entrada|aperitivo|vinho|suplement|snack|chocolate|a granel|para fazer em casa|gel pre|essential nutrition|pura vida/.test(cat)&&!/^(adicional|molho|agua|suco|refrigerante|cerveja|mcfritas|batata|fritas|mcnuggets|mega chicken mcnuggets|muffin|talher|carne$)/.test(n)&&features(item.name).formats.length>0}
function quality(s){const n=Number(s.reviews),r=Number(s.rating);return Number.isFinite(n)&&n>0&&Number.isFinite(r)&&r>=0&&r<=5?(r*n+4.3*50)/(n+50):null}
function recommend(orders,items,catalog,mode='descobrir'){
 if(!catalog?.items?.length)return {suggestions:[],restaurants:[],reason:'Sem cardápio disponível para este filtro.'};
 const os=new Map(orders.filter(o=>o.tipo==='Restaurante').map(o=>[String(o.id),o]));
 const stores=new Map(catalog.stores.map(s=>[s.id,s])),aliases=new Map();
 for(const s of stores.values())for(const a of [s.name,s.alias]){const key=norm(a);if(!key)continue;if(!aliases.has(key))aliases.set(key,s.id);else if(aliases.get(key)!==s.id)aliases.set(key,null)}
 const profile=new Map(),events=new Set(),seen=new Set(),seenAny=new Set(),visited=new Set();let total=0;
 const newest=Math.max(0,...[...os.values()].map(o=>Date.parse(o.criado_em)||0));
 for(const i of items){const o=os.get(String(i.pedido_id));if(!o||i.alimento!==true||!i.nome)continue;
 const sid=norm(o.app)==='ifood'?aliases.get(norm(o.loja)):null;if(sid)visited.add(sid);
 seen.add((sid||norm(o.loja))+'|'+norm(i.nome));seenAny.add(norm(i.nome));
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
 const affinity=profile.get('f:'+matched[0])/max;
 const protein=Math.max(0,...f.proteins.map(k=>(profile.get('p:'+k)||0)/Math.max(1,max)));
 candidates.push({...item,store:s,format:matched[0],quality:q,score:affinity*.65+Math.min(1,protein)*.1+Math.max(0,(q-4)/1)*.25,reason:'Combina com seu histórico de '+labels[matched[0]],repeated,visited:visited.has(s.id)});
 }
 candidates.sort((a,b)=>b.score-a.score||b.quality-a.quality||a.name.localeCompare(b.name));
 function diverse(maxStore){const out=[],sc=new Map(),fc=new Map();for(const d of candidates){if((sc.get(d.storeId)||0)>=maxStore||(fc.get(d.format)||0)>=2)continue;out.push(d);sc.set(d.storeId,(sc.get(d.storeId)||0)+1);fc.set(d.format,(fc.get(d.format)||0)+1);if(out.length===5)break}return out}
 return {suggestions:diverse(2),restaurants:diverse(1),reason:candidates.length?'':'Nenhuma opção com afinidade e avaliações suficientes neste cardápio.',collectedAt:catalog.collectedAt};
}
return {recommend,features,meal,quality};
})();
