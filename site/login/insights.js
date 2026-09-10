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
 return {popular:popular.slice(0,5),restaurants:restaurants.slice(0,5),orderCount:os.size,itemCount:rows.length};
}
let ticket=0,cacheKey='',cache=null,lastArgs=null,catalog=null,catalogFailed=false,baseReady=false;
const nutritionCache=new Map();
function reset(){ticket++;cacheKey='';cache=null;lastArgs=null;catalog=null;catalogFailed=false;baseReady=false;nutritionCache.clear()}
const ids=['dishPopularity','restaurantPopularity','dishSuggestions','restaurantSuggestions'];
function row(title,meta,value,sub='',bar=null){return `<li><div><div class="name" title="${esc(title)}">${esc(title)}</div><div class="meta">${esc(meta)}</div>${bar===null?'':`<div class="bar"><i style="width:${Math.min(100,Math.max(0,bar))}%"></i></div>`}</div><div class="right"><b>${esc(value)}</b><small>${esc(sub)}</small></div></li>`}
function show(r,goal,recs={suggestions:[],restaurants:[],reason:'Sem histórico neste filtro.'}){
 const empty='<li class="meta">Sem dados no período selecionado.</li>';
 document.getElementById(ids[0]).innerHTML=r.popular.map(d=>row(d.name,d.store+' · '+d.app,d.count+' pedidos',num(d.units)+' unidades',100*d.count/r.popular[0].count)).join('')||empty;
 document.getElementById(ids[1]).innerHTML=r.restaurants.map(s=>row(s.name,s.app+' · ticket médio '+money(s.spend/s.count),s.count+' pedidos',money(s.spend)+' no período',100*s.count/r.restaurants[0].count)).join('')||empty;
 const rating=d=>'★ '+Number(d.store.rating).toLocaleString('pt-BR')+' · '+num(d.store.reviews)+' avaliações do restaurante';
 const link=d=>{try{const u=new URL(d.store.url);return u.protocol==='https:'&&(u.hostname==='ifood.com.br'||u.hostname.endsWith('.ifood.com.br'))?`<a href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">Ver cardápio no iFood</a>`:''}catch{return ''}};
 const dish=d=>`<article class="recommendation-card"><div class="recommendation-cover" aria-hidden="true"><span>${esc(d.format==='lamen'?'Lámen':d.format==='grelhados'?'À mesa':d.store.category||'À sua escolha')}</span></div><div class="recommendation-body"><span class="function-label">${esc(d.label)}</span><p class="meta">${esc(d.store.name)} · iFood</p><h3>${esc(d.name)}</h3><p class="recommendation-reason">${esc(d.label==='Seu favorito'?d.times+' pedidos no seu histórico':d.reason)}</p><div class="recommendation-footer">${d.nutrition?`<p class="meta">Estimativa por item: ${num(d.nutrition.kcal)} kcal · ${num(d.nutrition.p)} g proteína · ${num(d.nutrition.c)} g carboidratos · ${num(d.nutrition.f)} g gordura</p>`:''}<p>${esc(rating(d))}</p><p class="meta">${esc(valid(d.price)?money(+d.price)+' na coleta':'Preço não informado')}${d.choices?' · escolhas no cardápio':''}</p>${link(d)}</div></div></article>`;
 const unavailable='<p class="meta">'+esc(catalogFailed?'Não foi possível consultar os cardápios. Tente novamente.':recs.reason)+'</p>';
 document.getElementById(ids[2]).innerHTML=recs.suggestions.map(dish).join('')||unavailable;
 document.getElementById(ids[3]).innerHTML='';
 document.getElementById('insightsStatus').textContent=r.orderCount+' pedidos de restaurantes · '+r.itemCount+' itens distintos no filtro. '+(recs.collectedAt?'Cardápios e avaliações: '+recs.collectedAt+'. ':'')+'Afinidade baseada no quiz e no histórico disponíveis. Preços, entrega e disponibilidade atuais devem ser conferidos no iFood.';
}
function recommend(orders,items,menu,goal){return window.EatIQTaste.recommend(orders,items,menu,goal,{quiz:lastArgs?.quiz,budget:document.getElementById('recommendationBudget')?.value||50,estimate:d=>{const key=d.storeId+'|'+d.id;if(!nutritionCache.has(key))nutritionCache.set(key,window.EatIQEngine.estimate(d.name,d.description,1,'restaurante',{}));return nutritionCache.get(key)}})}
async function render(args){
 if(!document.getElementById('descobertas'))return;lastArgs=args;const select=document.getElementById('recommendationGoal');if(!select.dataset.bound){select.dataset.bound='1';select.addEventListener('change',()=>lastArgs&&render(lastArgs));document.getElementById('recommendationBudget')?.addEventListener('change',()=>lastArgs&&render(lastArgs));document.getElementById('retryInsights').addEventListener('click',()=>{cacheKey='';catalog=null;if(lastArgs)render(lastArgs)})}
 const current=++ticket,goal=select.value||'curadoria',orders=args.orders.filter(o=>o.tipo==='Restaurante');
 const key=args.userId+':'+JSON.stringify(args.quiz||null)+':'+orders.map(o=>[o.id,o.kcal,o.prot,o.carb,o.gord,o.total,o.confianca].join(',')).join(';');document.getElementById('retryInsights').hidden=true;
 const budgetField=document.getElementById('budgetControl');if(budgetField)budgetField.hidden=goal!=='budget';
 if(['lowcarb','proteina'].includes(goal)&&!baseReady){try{await window.EatIQEngine.loadBase(args.api);if(current!==ticket)return;baseReady=true;nutritionCache.clear()}catch{if(current!==ticket)return;document.getElementById('dishSuggestions').textContent='Não foi possível carregar a base nutricional. Tente novamente.';document.getElementById('retryInsights').hidden=false;return}}
 if(!orders.length&&!window.EatIQQuizModel?.valid(args.quiz)){show(aggregate([],[],goal),goal);return}if(key===cacheKey&&cache){show(aggregate(orders,cache,goal),goal,recommend(orders,cache,(!orders.length||orders.some(o=>norm(o.app)==='ifood'))?catalog:null,goal));return}
 ids.forEach(id=>document.getElementById(id).textContent='Carregando seu histórico…');
 try{const items=[],orderIds=orders.map(o=>String(o.id));if(!orderIds.every(id=>/^[0-9a-f-]+$/i.test(id)))throw Error('ID inválido');
 for(let begin=0;begin<orderIds.length;begin+=60)for(let offset=0;;offset+=1000){const path='/rest/v1/itens?user_id=eq.'+encodeURIComponent(args.userId)+'&pedido_id=in.('+orderIds.slice(begin,begin+60).join(',')+')&select=id,pedido_id,nome,quantidade,preco,alimento,gramas,kcal,prot,carb,gord,confianca,prato&order=id.asc&limit=1000&offset='+offset;const response=await args.api(path);if(current!==ticket)return;if(!response.ok)throw Error('Consulta indisponível');const page=await response.json();if(!Array.isArray(page))throw Error('Resposta inválida');items.push(...page);if(page.length<1000)break}
 if(current!==ticket)return;
 if(!catalog){catalogFailed=false;try{const response=await args.api('/rest/v1/shared_menu_catalogs?source=eq.ifood&select=data');if(!response.ok)throw Error('Cardápio indisponível');const page=await response.json();if(current!==ticket)return;catalog=page[0]?.data||null}catch{if(current!==ticket)return;catalogFailed=true;document.getElementById('retryInsights').hidden=false}}
 if(current!==ticket)return;cacheKey=key;cache=items;
 const menu=(!orders.length||orders.some(o=>norm(o.app)==='ifood'))?catalog:null;
 show(aggregate(orders,items,goal),goal,recommend(orders,items,menu,goal));
 }catch{if(current!==ticket)return;ids.forEach(id=>document.getElementById(id).textContent='Não foi possível carregar esta análise.');document.getElementById('insightsStatus').textContent='Falha ao consultar itens. Seus pedidos continuam preservados.';document.getElementById('retryInsights').hidden=false}
}
return {render,aggregate,reset};
})();
