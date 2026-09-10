window.EatIQInsights=(()=>{
'use strict';
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),num=n=>Math.round(n).toLocaleString('pt-BR');
const valid=n=>n!==null&&n!==undefined&&n!==''&&Number.isFinite(+n)&&+n>=0;
function aggregate(orders,items,goal='economia'){
 const os=new Map(orders.filter(o=>o.tipo==='Restaurante').map(o=>[String(o.id),o])),stores=new Map(),dishes=new Map(),seen=new Set();
 for(const o of os.values()){const key=JSON.stringify([o.app,norm(o.loja)]);let s=stores.get(key);if(!s){s={key,name:o.loja,app:o.app,count:0,spend:0};stores.set(key,s)}s.count++;s.spend+=+o.total||0}
 for(const i of items){const o=os.get(String(i.pedido_id));if(!o||i.alimento!==true||!valid(i.quantidade)||+i.quantidade<=0||!i.nome)continue;if(i.id!=null){if(seen.has(String(i.id)))continue;seen.add(String(i.id))}
 const storeKey=JSON.stringify([o.app,norm(o.loja)]),key=JSON.stringify([storeKey,norm(i.nome)]);let d=dishes.get(key);
 if(!d){d={key,storeKey,name:i.nome,store:o.loja,app:o.app,orders:new Set(),units:0,spend:0,kcal:0,prot:0,carb:0,gord:0,gramas:0,confidence:0,complete:true,excluded:false};dishes.set(key,d)}
 d.orders.add(String(o.id));d.units+=+i.quantidade;d.complete&&=['preco','kcal','prot','carb','gord','gramas','confianca'].every(k=>valid(i[k]));d.spend+=valid(i.preco)?+i.preco:0;for(const k of ['kcal','prot','carb','gord','gramas'])d[k]+=valid(i[k])?+i[k]:0;d.confidence+=(+i.confianca||0)*+i.quantidade;d.excluded||=/agrupador|complemento|adicional|preferencia/.test(norm(i.prato));
 }
 const rows=[...dishes.values()].map(d=>({...d,count:d.orders.size,price:d.spend/d.units,k:d.kcal/d.units,p:d.prot/d.units,c:d.carb/d.units,f:d.gord/d.units,g:d.gramas/d.units,conf:d.confidence/d.units}));
 const popular=rows.slice().sort((a,b)=>b.count-a.count||b.units-a.units||a.name.localeCompare(b.name));
 const restaurants=[...stores.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
 const eligible=rows.filter(d=>d.complete&&!d.excluded&&d.conf>=40&&d.price>0&&d.k>=150&&d.k<=1200&&d.g>=100&&d.g<=900&&!/^(arroz|feijao|farofa|molho|maionese|refrigerante|coca|guarana|pepsi|cerveja|agua|suco|talheres)\b/.test(norm(d.name)));
 const compare=goal==='proteina'?(a,b)=>b.p/b.price-a.p/a.price||b.count-a.count:goal==='favoritos'?(a,b)=>b.count-a.count||a.price-b.price:(a,b)=>a.price-b.price||b.count-a.count;
 eligible.sort(compare);const chosen=new Set(),recommendedStores=[];for(const d of eligible){if(chosen.has(d.storeKey))continue;chosen.add(d.storeKey);recommendedStores.push({...stores.get(d.storeKey),dish:d});if(recommendedStores.length===5)break}
 return {popular:popular.slice(0,5),restaurants:restaurants.slice(0,5),suggestions:eligible.slice(0,5),recommendedStores,orderCount:os.size,itemCount:rows.length};
}
let ticket=0,cacheKey='',cache=null,lastArgs=null;
function reset(){ticket++;cacheKey='';cache=null;lastArgs=null}
const ids=['dishPopularity','restaurantPopularity','dishSuggestions','restaurantSuggestions'];
function row(title,meta,value,sub='',bar=null){return `<li><div><div class="name" title="${esc(title)}">${esc(title)}</div><div class="meta">${esc(meta)}</div>${bar===null?'':`<div class="bar"><i style="width:${Math.min(100,Math.max(0,bar))}%"></i></div>`}</div><div class="right"><b>${esc(value)}</b><small>${esc(sub)}</small></div></li>`}
function show(r,goal){
 const empty='<li class="meta">Sem dados no período selecionado.</li>';
 document.getElementById(ids[0]).innerHTML=r.popular.map(d=>row(d.name,d.store+' · '+d.app,d.count+' pedidos',num(d.units)+' unidades',100*d.count/r.popular[0].count)).join('')||empty;
 document.getElementById(ids[1]).innerHTML=r.restaurants.map(s=>row(s.name,s.app+' · ticket médio '+money(s.spend/s.count),s.count+' pedidos',money(s.spend)+' no período',100*s.count/r.restaurants[0].count)).join('')||empty;
 const reason=d=>goal==='proteina'?num(10*d.p/d.price)+' g estimados de proteína por R$ 10':goal==='favoritos'?d.count+' pedidos no período':'Entre os menores preços por unidade elegível';
 document.getElementById(ids[2]).innerHTML=r.suggestions.map(d=>row(d.name,d.store+' · '+reason(d),money(d.price),`${num(d.k)} kcal · P ${num(d.p)} g · C ${num(d.c)} g · G ${num(d.f)} g`)).join('')||'<li class="meta">Sem itens com dados suficientes para sugerir neste filtro.</li>';
 document.getElementById(ids[3]).innerHTML=r.recommendedStores.map(s=>row(s.name,s.app+' · opção: '+s.dish.name,money(s.dish.price),reason(s.dish))).join('')||empty;
 document.getElementById('insightsStatus').textContent=r.orderCount+' pedidos de restaurantes · '+r.itemCount+' itens distintos por restaurante no filtro. Preços históricos; disponibilidade atual não verificada.';
}
async function render(args){
 if(!document.getElementById('descobertas'))return;lastArgs=args;const select=document.getElementById('recommendationGoal');if(!select.dataset.bound){select.dataset.bound='1';select.addEventListener('change',()=>lastArgs&&render(lastArgs));document.getElementById('retryInsights').addEventListener('click',()=>{cacheKey='';if(lastArgs)render(lastArgs)})}
 const current=++ticket,goal=select.value||'economia',orders=args.orders.filter(o=>o.tipo==='Restaurante');
 const key=args.userId+':'+orders.map(o=>[o.id,o.kcal,o.prot,o.carb,o.gord,o.total,o.confianca].join(',')).join(';');document.getElementById('retryInsights').hidden=true;
 if(!orders.length){show(aggregate([],[],goal),goal);return}if(key===cacheKey&&cache){show(aggregate(orders,cache,goal),goal);return}
 ids.forEach(id=>document.getElementById(id).textContent='Carregando seu histórico…');
 try{const items=[],orderIds=orders.map(o=>String(o.id));if(!orderIds.every(id=>/^[0-9a-f-]+$/i.test(id)))throw Error('ID inválido');
 for(let begin=0;begin<orderIds.length;begin+=60)for(let offset=0;;offset+=1000){const path='/rest/v1/itens?user_id=eq.'+encodeURIComponent(args.userId)+'&pedido_id=in.('+orderIds.slice(begin,begin+60).join(',')+')&select=id,pedido_id,nome,quantidade,preco,alimento,gramas,kcal,prot,carb,gord,confianca,prato&order=id.asc&limit=1000&offset='+offset;const response=await args.api(path);if(current!==ticket)return;if(!response.ok)throw Error('Consulta indisponível');const page=await response.json();if(!Array.isArray(page))throw Error('Resposta inválida');items.push(...page);if(page.length<1000)break}
 if(current!==ticket)return;cacheKey=key;cache=items;show(aggregate(orders,items,goal),goal);
 }catch{if(current!==ticket)return;ids.forEach(id=>document.getElementById(id).textContent='Não foi possível carregar esta análise.');document.getElementById('insightsStatus').textContent='Falha ao consultar itens. Seus pedidos continuam preservados.';document.getElementById('retryInsights').hidden=false}
}
return {render,aggregate,reset};
})();
