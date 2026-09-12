/* Joins daily Health observations to restaurant orders; no imputed food or energy balance. */
window.EatIQHealthInsights=(()=>{
'use strict';
const DAY=86400000;
const num=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
const median=a=>{const s=a.slice().sort((x,y)=>x-y),n=s.length;return n?(s[Math.floor((n-1)/2)]+s[Math.floor(n/2)])/2:null};
const day=d=>Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/DAY;
const key=d=>new Date(d*DAY).toISOString().slice(0,10);
const fmt=n=>n.toLocaleString('pt-BR',{maximumFractionDigits:1});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const definitions=[
 ['steps-kcal','movimento','Nos dias de mais passos, o pedido muda?','kcal por pedido','passos','kcal'],
 ['steps-spend','movimento','Mais passos, outra conta no delivery?','R$ por dia com pedido','passos','spend'],
 ['steps-count','movimento','Você pede mais vezes nos dias de mais passos?','pedidos por dia com pedido','passos','count'],
 ['steps-protein','movimento','O movimento acompanha a densidade de proteína?','g de proteína por 1.000 kcal','passos','density'],
 ['steps-late','movimento','Dias de mais passos terminam com pedido tarde?','% dos dias com pedido à noite','passos','late'],
 ['workout-kcal','treino','Treinos mais longos, pedidos maiores?','kcal por pedido','treino_min','kcal'],
 ['workout-protein','treino','A proteína acompanha a duração do treino?','g de proteína por 1.000 kcal','treino_min','density'],
 ['next-steps','movimento','Como ficam os passos no dia após o pedido tarde?','passos no dia seguinte','passos','next'],
 ['next-sleep','sono','Como fica o sono após o pedido tarde?','horas de sono no dia seguinte','sono_min','next'],
 ['sleep-spend','sono','Depois de menos sono, o gasto muda?','R$ por dia com pedido','sono_min','spend']
];
function analyze(raw,health,filter='all'){
 const seen=new Set(),daily=new Map();
 for(const o of raw){if(o.tipo!=='Restaurante'||!o.criado_em)continue;const d=new Date(o.criado_em);if(!Number.isFinite(d.getTime()))continue;
 const id=String(o.app)+'|'+String(o.id);if(o.id!=null){if(seen.has(id))continue;seen.add(id)}
 const k=day(d);if(!daily.has(k))daily.set(k,[]);daily.get(k).push({...o,hour:d.getHours()});}
 const dates=[...daily.keys()].sort((a,b)=>a-b),min=dates[0],max=dates.at(-1);
 const hs=new Map();for(const h of Array.isArray(health)?health:Object.values(health||{})){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(h.dia||''))continue;const d=Date.parse(h.dia+'T00:00:00Z')/DAY;if(!Number.isFinite(d)||key(d)!==h.dia)continue;
 // Duplicate daily rows are ambiguous; never multiply an order through a join.
 if(hs.has(d)){hs.set(d,null);continue}hs.set(d,h);
 }
 const within=d=>filter==='all'||(/^\d{4}$/.test(filter)?key(d).startsWith(filter+'-'):d>=min&&d<=max);
 const rows=dates.map(d=>{const os=daily.get(d),h=hs.get(d),cal=os.map(o=>num(o.kcal)),prot=os.map(o=>num(o.prot)),tot=os.map(o=>num(o.total));
 const nutrition=os.every((o,i)=>cal[i]>0&&num(o.confianca)>=30),sum=a=>a.reduce((x,y)=>x+y,0);
 const evening=os.filter(o=>o.hour>=18);return {day:d,h,orders:os.length,
 kcal:nutrition?median(cal):null,density:nutrition&&prot.every(p=>p!==null)?sum(prot)/sum(cal)*1000:null,
 spend:tot.every(t=>t!==null)?sum(tot):null,count:os.length,
 late:evening.length?(evening.some(o=>o.hour>=22)?100:0):null};});
 const paired=rows.filter(r=>r.h);
 const cards=definitions.map(([id,category,title,unit,field,metric])=>{
 const c={id,category,title,unit,deltaUnit:metric==='late'?'pontos percentuais':unit,ready:false,groups:[],need:'',method:''};let samples=[],labels=[],cut=null;
 if(metric==='next'){
  samples=rows.filter(r=>r.late!==null&&within(r.day+1)).flatMap(r=>{const v=num(hs.get(r.day+1)?.[field]);return v===null||field==='sono_min'&&(v<=0||v>1440)?[]:[{group:r.late===100?1:0,value:field==='sono_min'?v/60:v}]});
  labels=['Último pedido à noite antes das 22h','Pedido às 22h ou depois'];
  c.method='Liga pedidos da data D ao Health da data D+1, sem usar o próximo registro disponível quando faltam dias. Compara medianas. Considera apenas datas com pedidos a partir das 18h; pedidos após meia-noite pertencem à nova data e não são classificados como jantar tardio da véspera. '+(field==='sono_min'?'No XML, sono é registrado no dia em que o intervalo termina; pode incluir cochilos. No Atalhos, depende da data enviada.':'Passos são o total registrado, não a quantidade causada pelo horário do pedido.');
 }else{
  const validRows=paired.filter(r=>{const v=num(r.h[field]);return v!==null&&(field!=='treino_min'||v>0&&v<=1440)&&(field!=='sono_min'||v>0&&v<=1440)});
  cut=median(validRows.map(r=>Number(r.h[field])));
  samples=validRows.filter(r=>r[metric]!==null).map(r=>({group:Number(r.h[field])<cut?0:1,value:r[metric]}));
  const label=field==='passos'?'passos':field==='treino_min'?'min de treino':'min de sono';
  labels=cut===null?['Abaixo da mediana','A partir da mediana']:[`Menos de ${fmt(cut)} ${label}`,`${fmt(cut)} ${label} ou mais`];
  c.method='Divide os dias com Health e pedido pela mediana pessoal de '+label+' neste filtro (empates no grupo superior). '+(metric==='late'?'Compara a proporção de dias com pedido às 22h ou depois entre os dias com pedido a partir das 18h.':'Compara medianas dos dois grupos. ')+
   (metric==='kcal'?'Primeiro calcula a mediana de kcal dos pedidos inteiros em cada dia, depois a mediana dos dias. ':metric==='density'?'Soma proteína e kcal dos pedidos de cada dia, calcula g/1.000 kcal e compara medianas diárias. ':metric==='spend'?'Soma o total pago por dia com pedido, incluindo taxas. ':metric==='count'?'Conta pedidos distintos por dia com pedido; dias sem registro de pedido não entram. ':'')+
   (['kcal','density'].includes(metric)?'Exige confiança ≥30 e kcal válidas em todos os pedidos do dia; proteína também deve estar informada para densidade. ':'')+
   (field==='treino_min'?'Só compara dias com duração de treino positiva registrada; ausência não vira “sem treino”. ':field==='sono_min'?'Usa o sono registrado no mesmo dia dos pedidos (dia do despertar no XML). ':'');
 }
 c.groups=[0,1].map((g,i)=>{const values=samples.filter(s=>s.group===g).map(s=>s.value);return {label:labels[i],n:values.length,value:values.length?(metric==='late'?values.reduce((a,b)=>a+b,0)/values.length:median(values)):null}});
 c.ready=c.groups.every(g=>g.n>=5);
 c.need=`Precisamos de 5 dias válidos em cada grupo; encontrados ${c.groups[0].n} e ${c.groups[1].n}. `+(samples.length?'Empates, estimativas incompletas ou a distribuição do histórico podem limitar a comparação.':`Faltam datas compatíveis com ${field==='sono_min'?'sono':field==='treino_min'?'duração de treino':'passos'} e pedidos no filtro.`);
 if(c.ready)c.delta=c.groups[1].value-c.groups[0].value;
 c.method+=' Cada grupo precisa de 5 dias. Os grupos podem diferir em dia da semana, número de pessoas e restaurante. Associação descritiva, sem teste de significância ou causalidade. Compras não comprovam consumo individual.';
 return c;
 });
 const fields=['passos','treino_min','sono_min','kcal_ativas'];
 const coverage=Object.fromEntries(fields.map(f=>[f,paired.filter(r=>num(r.h[f])!==null).length]));
 return {cards,ready:cards.filter(c=>c.ready).length,orderDays:rows.length,matchedDays:paired.length,coverage};
}
let last;
function paint(){const host=document.getElementById('healthInsightCards');if(!host||!last)return;const category=document.getElementById('healthInsightCategory').value;
 host.innerHTML=last.cards.filter(c=>category==='all'||category===c.category).map(c=>{const max=Math.max(1,...c.groups.map(g=>g.value||0));return `<article class="habit-card ${c.ready?'':'habit-pending'}" data-health-insight="${c.id}"><div class="habit-heading"><span>Pedidos × Apple Health</span><span class="habit-state">${c.ready?'Comparação disponível':'Faltam dados'}</span></div><h3>${esc(c.title)}</h3>${c.ready?`<div class="habit-value">${c.delta>0?'+':''}${fmt(c.delta)}</div><p class="habit-unit">${esc(c.deltaUnit)} · diferença do segundo grupo para o primeiro</p><div class="habit-bars">${c.groups.map(g=>`<div class="habit-bar"><div><span>${esc(g.label)}</span><b>${fmt(g.value)}</b></div><div class="habit-track" aria-hidden="true"><i style="width:${g.value/max*100}%"></i></div></div>`).join('')}</div><p class="habit-evidence">${c.groups[0].n} e ${c.groups[1].n} dias comparados. Associação; não indica causa.</p>`:`<p class="habit-summary">${esc(c.need)}</p>`}<details><summary>Como calculamos</summary><p>${esc(c.method)}</p></details></article>`}).join('');
 document.getElementById('healthInsightStatus').textContent=`${last.ready} de 10 análises disponíveis · ${last.matchedDays} de ${last.orderDays} dias com pedidos têm Health na mesma data. Nessas datas: passos ${last.coverage.passos}, treino ${last.coverage.treino_min}, sono ${last.coverage.sono_min}, calorias ativas ${last.coverage.kcal_ativas}.`;
}
function render(orders,health,filter){if(!document.getElementById('healthInsightCards'))return;last=analyze(orders,health,filter);const select=document.getElementById('healthInsightCategory');if(!select.dataset.bound){select.dataset.bound='1';select.addEventListener('change',paint)}paint();return last}
return {analyze,render};
})();
