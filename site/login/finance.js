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
 el('financialDetails').innerHTML=`<h3>Seu dinheiro, em perspectiva</h3><p>Três restaurantes concentram <b>${a.total?(a.top3/a.total*100).toFixed(1):'0'}%</b> do gasto. Sábados e domingos representam <b>${a.total?(a.weekend/a.total*100).toFixed(1):'0'}%</b>.</p><p>Produtos: ${money(a.subtotal)} + taxas e gorjetas: ${money(a.fees)} − descontos registrados: ${money(a.discounts)} = ${money(a.expected)}. Total pago: <b>${money(a.total)}</b>.</p><p class="meta">${Math.abs(a.residual)>.05?'Diferença de '+money(a.residual)+': a composição importada não fecha com o total. Créditos, estornos ou campos ausentes precisam ser conferidos na exportação.':'A composição importada fecha com o total pago.'} Desconto registrado não comprova economia frente a outro canal.</p>`;
 el('platformFinance').innerHTML='<h3>Quanto custa cada app</h3>'+a.apps.map(x=>`<p><b>${esc(x.name)}</b> · ${x.n} pedidos · ${money(x.total/x.n)} por pedido · ${money(x.fees/x.n)} em taxas e gorjetas por pedido.</p>`).join('')+'<p class="meta">Os restaurantes, pratos e tamanhos de pedido podem ser diferentes. Esta média não prova qual app oferece o mesmo prato mais barato.</p>';
 el('spendChart').innerHTML=a.months.map(x=>`<div class="mrow"><div>${esc(x.month)}</div><div class="bar"><i style="width:${100*(x.food+x.other)/Math.max(1,...a.months.map(z=>z.food+z.other))}%"></i></div><div class="v">${money(x.food+x.other)}</div></div>`).join('')||'<p>Sem pedidos.</p>';
 const fields=['people','ingredients','energy','dish','service','transport'];
 const update=()=>{const p=Object.fromEntries(fields.map(k=>[k,el('finance-'+k).value]));const s=scenario(meals,p);const rows=[['Delivery registrado',a.total],['Em casa (simulação)',s?.home??null],['Presencial (simulação)',s?.out??null]],max=Math.max(1,...rows.map(x=>x[1]||0));el('moneyBars').innerHTML=rows.map(([label,value])=>`<div class="mrow"><div>${label}</div><div class="bar"><i style="width:${100*(value||0)/max}%"></i></div><div class="v">${value===null?'Preencha os custos':money(value)}</div></div>`).join('');
 el('extraMarket').textContent=s?.homeDifference==null?'—':money(s.homeDifference);el('extraMarketSub').textContent='Delivery menos preparo em casa, no período. Negativo indica casa mais cara.';
 el('saveOut').textContent=s?.outDifference==null?'—':money(s.outDifference);el('saveOutSub').textContent='Presencial menos delivery, no período. Negativo indica presencial mais barato.';
 el('cookSave').textContent='—';el('cookFoot').textContent='Preencha ingredientes, porções e energia para simular. Não pressupomos mudança de calorias.';
 if(s?.home!==null&&s?.home!==undefined&&meals.length){const groups=new Map();for(const o of meals){const date=new Date(o.date);date.setDate(date.getDate()-((date.getDay()+6)%7));const key=date.getFullYear()+'-'+date.getMonth()+'-'+date.getDate();if(!groups.has(key))groups.set(key,[]);groups.get(key).push(o)}const chosen=[...groups.values()].flatMap(xs=>xs.slice().sort((a,b)=>b.tot-a.tot).slice(0,2));const homePer=s.home/meals.length;el('cookSave').textContent=money(sum(chosen,o=>o.tot-homePer));el('cookFoot').textContent='Diferença simulada no período ao substituir até dois pedidos por semana. Mantém a quantidade de porções que você informou; não é projeção anual.';}
 };
 for(const k of fields)el('finance-'+k).oninput=update;update();
}
return {analyze,scenario,render};
})();
