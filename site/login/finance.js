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
function spendChart(months){
 if(!months.length)return '<p class="meta">Sem pedidos no período.</p>';
 const compact=v=>v>=1000?(v/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})+' mil':v.toLocaleString('pt-BR',{maximumFractionDigits:0});
 const label=m=>{const [y,n]=m.split('-');return ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][+n-1]+'/'+y.slice(-2)};
 const peak=Math.max(0,...months.map(m=>m.food+m.other));
 const raw=Math.max(1,peak/4),power=10**Math.floor(Math.log10(raw)),unit=[1,2,5,10].find(x=>x*power>=raw)*power,top=unit*4;
 const width=Math.max(620,months.length*76+64),left=62,bottom=240,height=180,step=(width-left-20)/months.length,bar=Math.min(42,step*.56);
 let svg='';for(let i=0;i<=4;i++){const y=bottom-i*height/4;svg+=`<line x1="${left}" y1="${y}" x2="${width-12}" y2="${y}" stroke="#e2e7e0"/><text x="${left-10}" y="${y+4}" text-anchor="end" fill="#7a857b" font-size="12">${esc(compact(unit*i))}</text>`}
 const table=[];
 months.forEach((m,i)=>{const total=m.food+m.other,x=left+step*(i+.5),food=Math.max(0,m.food)/top*height,other=Math.max(0,m.other)/top*height;
 svg+=`<g tabindex="0" role="button" data-spend-month="${i}" aria-label="${esc(m.month+': '+money(total)+'. Restaurantes '+money(m.food)+', outros '+money(m.other))}"><rect class="month-hit" x="${x-step/2+2}" y="20" width="${step-4}" height="258" rx="6" fill="transparent"/><rect x="${x-bar/2}" y="${bottom-food}" width="${bar}" height="${food}" fill="#25332b"/><rect x="${x-bar/2}" y="${bottom-food-other}" width="${bar}" height="${other}" fill="#a7bea7"/><text x="${x}" y="${Math.max(25,bottom-food-other-10)}" text-anchor="middle" fill="#25332b" font-size="12">${esc(compact(total))}</text><text x="${x}" y="${bottom+25}" text-anchor="middle" fill="#657265" font-size="12">${label(m.month)}</text></g>`;
 table.push(`<tr><th scope="row">${label(m.month)}</th><td>${money(m.food)}</td><td>${money(m.other)}</td><td>${money(total)}</td></tr>`);
 });
 return `<div class="spend-legend"><span><i style="background:#25332b"></i>Restaurantes</span><span><i style="background:#a7bea7"></i>Mercado e outros</span><small>Valores em R$</small></div><div class="spend-scroll" tabindex="0" aria-label="Gráfico mensal; role para ver todos os meses"><svg style="min-width:${width}px" viewBox="0 0 ${width} 288" aria-label="Gasto mensal por tipo de loja">${svg}</svg></div><div id="spendDetail" class="spend-detail" role="status" aria-live="polite"></div><details class="spend-table"><summary>Ver valores exatos</summary><div><table><thead><tr><th>Mês</th><th>Restaurantes</th><th>Mercado e outros</th><th>Total</th></tr></thead><tbody>${table.join('')}</tbody></table></div></details>`;
}
function bindSpend(months){const host=document.getElementById('spendChart'),detail=document.getElementById('spendDetail');if(!host?.querySelectorAll||!detail||!months.length)return;
 const buttons=host.querySelectorAll('[data-spend-month]');const show=index=>{const m=months[index];detail.textContent=m.month+' · Total '+money(m.food+m.other)+' · Restaurantes '+money(m.food)+' · Mercado e outros '+money(m.other);buttons.forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.spendMonth===index)))};
 buttons.forEach(b=>{b.onmouseenter=b.onfocus=b.onclick=()=>show(+b.dataset.spendMonth);b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show(+b.dataset.spendMonth)}}});show(months.length-1);
}
function render(orders){const el=id=>document.getElementById(id);if(!el('financialDetails'))return;const a=analyze(orders),meals=orders.filter(o=>o.meal),m=Math.max(1,a.months.length);
 el('moneyKpis').innerHTML=[['Delivery de restaurantes',money(a.total),a.n+' pedidos'],['Média por mês observado',money(a.monthlyAverage),m+' meses no período'],['Ticket mediano',money(a.median),'Valor central dos pedidos'],['Taxas e gorjetas',money(a.fees),(a.total?(100*a.fees/a.total).toFixed(1):'0')+'% do total']].map(([t,v,d])=>`<div class="kpi"><small>${esc(t)}</small><div class="big">${esc(v)}</div><span class="pill">${esc(d)}</span></div>`).join('');
 el('financialDetails').innerHTML=`<h3>Seus hábitos de gasto</h3><div class="finance-mini"><div><strong>${a.total?(a.top3/a.total*100).toFixed(0):'0'}%</strong><span>nos três restaurantes com maior gasto</span></div><div><strong>${a.total?(a.weekend/a.total*100).toFixed(0):'0'}%</strong><span>aos sábados e domingos</span></div></div><details class="financial-audit"><summary>Conferir composição dos valores</summary><p>Produtos ${money(a.subtotal)} + taxas e gorjetas ${money(a.fees)} − descontos ${money(a.discounts)}. Total pago: ${money(a.total)}.</p><p>${Math.abs(a.residual)>.05?'Diferença de '+money(a.residual)+' entre a composição e o total importado. Confira créditos, estornos e campos ausentes.':'A composição fecha com o total pago.'}</p></details>`;
 el('platformFinance').innerHTML='<h3>Ticket por app</h3>'+a.apps.map(x=>`<div class="platform-money"><div>${esc(x.name)}<p class="meta">${x.n} pedidos</p></div><div><strong>${money(x.total/x.n)}</strong><p class="meta">por pedido</p></div></div>`).join('')+'<p class="meta" style="margin-top:14px">Médias do seu histórico; pratos e quantidades variam.</p>';
 el('spendChart').innerHTML=spendChart(a.months);bindSpend(a.months);
 const fields=['people','ingredients','energy','dish','service','transport'];
 const update=()=>{const p=Object.fromEntries(fields.map(k=>[k,el('finance-'+k).value]));const s=scenario(meals,p);const count=Math.max(1,meals.length*(+p.people||1));const rows=[['Seu delivery',meals.length?a.total/count:null],['Cozinhando em casa',s?.home==null?null:s.home/count],['Restaurante em SP',s?.out==null?null:s.out/count]],max=Math.max(1,...rows.map(x=>x[1]||0));el('moneyBars').innerHTML=rows.map(([label,value])=>`<div class="mrow"><div>${label}<small>por pessoa</small></div><div class="bar"><i style="width:${100*(value||0)/max}%"></i></div><div class="v">${value===null?'—':money(value)}</div></div>`).join('');
 el('extraMarket').textContent=s?.homeDifference==null?'—':money(s.homeDifference);el('extraMarketSub').textContent='Delivery menos preparo em casa, no período. Negativo indica casa mais cara.';
 el('saveOut').textContent=s?.outDifference==null?'—':money(s.outDifference);el('saveOutSub').textContent='Presencial menos delivery, no período. Negativo indica presencial mais barato.';
 el('cookSave').textContent='—';el('cookFoot').textContent='Preencha ingredientes, porções e energia para simular. Não pressupomos mudança de calorias.';
 if(s?.home!==null&&s?.home!==undefined&&meals.length){const groups=new Map();for(const o of meals){const date=new Date(o.date);date.setDate(date.getDate()-((date.getDay()+6)%7));const key=date.getFullYear()+'-'+date.getMonth()+'-'+date.getDate();if(!groups.has(key))groups.set(key,[]);groups.get(key).push(o)}const chosen=[...groups.values()].flatMap(xs=>xs.slice().sort((a,b)=>b.tot-a.tot).slice(0,2));const homePer=s.home/meals.length;el('cookSave').textContent=money(sum(chosen,o=>o.tot-homePer));el('cookFoot').textContent='Diferença simulada no período ao substituir até dois pedidos por semana. Mantém a quantidade de porções que você informou; não é projeção anual.';}
 };
 for(const k of fields)el('finance-'+k).oninput=update;update();
}
return {analyze,scenario,render,spendChart};
})();
