window.EatIQFinance=(()=>{
'use strict';
const sum=(xs,fn)=>xs.reduce((a,x)=>a+fn(x),0),money=n=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function analyze(orders){
 const meals=orders.filter(o=>o.meal),values=meals.map(o=>o.tot).sort((a,b)=>a-b),n=values.length;
 const median=n?(values[Math.floor((n-1)/2)]+values[Math.ceil((n-1)/2)])/2:0;
 const monthly=new Map(),stores=new Map(),apps=new Map();
 for(const o of orders){if(!monthly.has(o.m))monthly.set(o.m,{month:o.m,food:0,other:0});monthly.get(o.m)[o.meal?'food':'other']+=o.tot;if(!o.meal)continue;const sk=JSON.stringify([o.p,o.s]);stores.set(sk,(stores.get(sk)||0)+o.tot);const a=apps.get(o.p)||{name:o.p,n:0,total:0,fees:0,discounts:0};a.n++;a.total+=o.tot;a.fees+=o.fee+o.tip;a.discounts+=o.disc;apps.set(o.p,a)}
 const keys=[...monthly.keys()].sort(),months=[];if(keys.length){const [y,m]=keys[0].split('-').map(Number);const cursor=new Date(y,m-1,1);while(true){const key=cursor.getFullYear()+'-'+String(cursor.getMonth()+1).padStart(2,'0');if(key>keys.at(-1))break;months.push(monthly.get(key)||{month:key,food:0,other:0});cursor.setMonth(cursor.getMonth()+1)}}
 const total=sum(meals,o=>o.tot),fees=sum(meals,o=>o.fee+o.tip),discounts=sum(meals,o=>o.disc),subtotal=sum(meals,o=>o.sub),expected=subtotal+fees-discounts;
 return {n,total,median,fees,discounts,subtotal,expected,residual:total-expected,months,monthlyAverage:total/Math.max(1,months.length),top3:sum([...stores.values()].sort((a,b)=>b-a).slice(0,3),x=>x),weekend:sum(meals.filter(o=>o.dow===0||o.dow===6),o=>o.tot),apps:[...apps.values()],allTotal:sum(orders,o=>o.tot)};
}
function scenario(meals,p){const valid=x=>x!==''&&x!==null&&x!==undefined&&Number.isFinite(+x)&&+x>=0;
 if(!meals.length||!valid(p.people)||+p.people<=0)return null;
 const people=+p.people,n=meals.length,paid=sum(meals,o=>o.tot);
 const home=valid(p.ingredients)&&valid(p.energy)?n*(+p.ingredients*people + +p.energy):null;
 const out=valid(p.dish)&&valid(p.service)&&valid(p.transport)?n*(+p.dish*people*(1+(+p.service)/100)+ +p.transport):null;
 return {paid,home,out,homeDifference:home===null?null:paid-home,outDifference:out===null?null:out-paid,n,portions:n*people};
}
function render(orders){const el=id=>document.getElementById(id);if(!el('financialDetails'))return;const a=analyze(orders),meals=orders.filter(o=>o.meal),m=Math.max(1,a.months.length);
 el('moneyKpis').innerHTML=[['Delivery de restaurantes',money(a.total),a.n+' pedidos'],['Média por mês observado',money(a.monthlyAverage),m+' meses entre o primeiro e o último pedido; inclui meses vazios'],['Ticket mediano',money(a.median),'Metade dos pedidos fica abaixo deste valor'],['Taxas e gorjetas',money(a.fees),(a.total?(100*a.fees/a.total).toFixed(1):'0')+'% do gasto em restaurantes']].map(([t,v,d])=>`<div class="kpi"><small>${esc(t)}</small><div class="big">${esc(v)}</div><span class="pill">${esc(d)}</span></div>`).join('');
 el('financialDetails').innerHTML=`<h3>Seus hábitos de gasto</h3><div class="finance-mini"><div><strong>${a.total?(a.top3/a.total*100).toFixed(0):'0'}%</strong><span>nos três restaurantes com maior gasto</span></div><div><strong>${a.total?(a.weekend/a.total*100).toFixed(0):'0'}%</strong><span>aos sábados e domingos</span></div></div><details class="financial-audit"><summary>Conferir composição dos valores</summary><p>Produtos ${money(a.subtotal)} + taxas e gorjetas ${money(a.fees)} − descontos ${money(a.discounts)}. Total pago: ${money(a.total)}.</p><p>${Math.abs(a.residual)>.05?'Diferença de '+money(a.residual)+' entre a composição e o total importado. Confira créditos, estornos e campos ausentes.':'A composição fecha com o total pago.'}</p></details>`;
 el('platformFinance').innerHTML='<h3>Ticket por app</h3>'+a.apps.map(x=>`<div class="platform-money"><div>${esc(x.name)}<p class="meta">${x.n} pedidos</p></div><div><strong>${money(x.total/x.n)}</strong><p class="meta">por pedido</p></div></div>`).join('')+'<p class="meta" style="margin-top:14px">Médias do seu histórico; pratos e quantidades variam.</p>';
 el('spendChart').innerHTML=a.months.map(x=>`<div class="mrow"><div>${esc(x.month)}</div><div class="bar"><i style="width:${100*(x.food+x.other)/Math.max(1,...a.months.map(z=>z.food+z.other))}%"></i></div><div class="v">${money(x.food+x.other)}</div></div>`).join('')||'<p>Sem pedidos.</p>';
 const fields=['people','ingredients','energy','dish','service','transport'];
 const update=()=>{const p=Object.fromEntries(fields.map(k=>[k,el('finance-'+k).value]));const s=scenario(meals,p);const count=Math.max(1,meals.length*(+p.people||1));const rows=[['Seu delivery',meals.length?a.total/count:null],['Cozinhando em casa',s?.home==null?null:s.home/count],['Restaurante em SP',s?.out==null?null:s.out/count]],max=Math.max(1,...rows.map(x=>x[1]||0));el('moneyBars').innerHTML=rows.map(([label,value])=>`<div class="mrow"><div>${label}<small>por pessoa</small></div><div class="bar"><i style="width:${100*(value||0)/max}%"></i></div><div class="v">${value===null?'—':money(value)}</div></div>`).join('');
 el('extraMarket').textContent=s?.homeDifference==null?'—':money(s.homeDifference);el('extraMarketSub').textContent='Delivery menos preparo em casa, no período. Negativo indica casa mais cara.';
 el('saveOut').textContent=s?.outDifference==null?'—':money(s.outDifference);el('saveOutSub').textContent='Presencial menos delivery, no período. Negativo indica presencial mais barato.';
 el('cookSave').textContent='—';el('cookFoot').textContent='Preencha ingredientes, porções e energia para simular. Não pressupomos mudança de calorias.';
 if(s?.home!==null&&s?.home!==undefined&&meals.length){const groups=new Map();for(const o of meals){const date=new Date(o.date);date.setDate(date.getDate()-((date.getDay()+6)%7));const key=date.getFullYear()+'-'+date.getMonth()+'-'+date.getDate();if(!groups.has(key))groups.set(key,[]);groups.get(key).push(o)}const chosen=[...groups.values()].flatMap(xs=>xs.slice().sort((a,b)=>b.tot-a.tot).slice(0,2));const homePer=s.home/meals.length;el('cookSave').textContent=money(sum(chosen,o=>o.tot-homePer));el('cookFoot').textContent='Diferença simulada no período ao substituir até dois pedidos por semana. Mantém a quantidade de porções que você informou; não é projeção anual.';}
 };
 for(const k of fields)el('finance-'+k).oninput=update;update();
}
return {analyze,scenario,render};
})();
