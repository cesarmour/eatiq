window.EatIQHabits = (() => {
  const DAY = 86400000;
  const numeric = value => !['number','string'].includes(typeof value) || String(value).trim() === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
  const valid = n => n !== null && Number.isFinite(n) && n >= 0;
  const sum = values => values.reduce((a,b) => a+b,0);
  const median = values => {
    const a = values.slice().sort((x,y) => x-y), n = a.length;
    return n ? (a[Math.floor((n-1)/2)]+a[Math.floor(n/2)])/2 : null;
  };
  const quantile = (values,q) => {
    const a=values.slice().sort((x,y)=>x-y), i=(a.length-1)*q, lo=Math.floor(i);
    return a.length ? a[lo]+(a[Math.ceil(i)]-a[lo])*(i-lo) : null;
  };
  const fmt = n => n.toLocaleString('pt-BR',{maximumFractionDigits:1});
  const money = n => n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const signed = n => (Math.abs(n)<.05?'':n>0?'+':'−')+fmt(Math.abs(n));
  const escape = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dayOf = d => Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/DAY;
  const weekday = day => new Date(day*DAY).getUTCDay();
  const definitions = [
    ['repeat','escolhas','Você volta ao mesmo lugar?','Precisamos de 10 pedidos identificados e pelo menos 2 restaurantes.','Compara cada pedido ao imediatamente anterior, na ordem de data e ID. Restaurante é nome + plataforma; nomes iguais de filiais podem estar agrupados na origem.'],
    ['discovery','escolhas','A novidade vira favorita?','Precisamos de 5 restaurantes novos no recorte, com 30 dias para observar o retorno.','Primeira aparição no filtro não significa primeira visita da vida. Exclui descobertas nos primeiros 14 dias do recorte e nos últimos 30. Retorno é outro pedido em um dia posterior, até 30 dias depois.'],
    ['momentum','ritmo','Os pedidos vêm em sequência?','Precisamos de 28 dias e 10 oportunidades em cada grupo de dia anterior.','Conta dias com pedido após um dia com pedido e após um dia sem registro. Usa datas locais, uma ocorrência por dia e ignora o primeiro dia do recorte. Ausência de registro não prova ausência de delivery.'],
    ['weekend','ritmo','O fim de semana muda a conta?','Precisamos de 4 semanas inteiras no recorte e 5 pedidos em cada grupo.','Soma o gasto em sábados e domingos e divide por todos esses dias; faz o mesmo para segunda a sexta. Exclui semanas das bordas que não cabem no recorte. Dias sem pedidos importados entram com zero.'],
    ['late','nutricao','O pedido muda depois das 22h?','Precisamos de 5 pedidos entre 18h e 22h e 5 entre 22h e 5h, com estimativas suficientes.','Compara a mediana de kcal por pedido inteiro no jantar (18h–21h59) e à noite (22h–4h59), pelo horário local. Não controla tamanho do grupo ou tipo de prato; é associação, não efeito do horário.'],
    ['discount','bolso','Desconto deixa a conta menor?','Precisamos de uma mesma loja com 3 pedidos com desconto e 3 sem desconto informado como zero.','Escolhe a loja/plataforma com mais pedidos nos dois grupos, nunca a maior diferença. Compara medianas do total pago. Pratos, quantidades e datas podem variar: não mede economia causada pela promoção.'],
    ['fees','bolso','Pedidos pequenos carregam mais taxas?','Precisamos de 5 pedidos abaixo e 5 a partir do subtotal mediano, com taxas e gorjeta informadas.','Separa pelo subtotal dos produtos. Em cada grupo, divide a soma de taxas + gorjetas pela soma do total pago; não faz média de percentuais. Diferença em pontos percentuais.'],
    ['spikes','bolso','Poucos pedidos concentram seu gasto?','Precisamos de 10 pedidos com total informado e gasto positivo no conjunto.','Ordena pelo total pago e seleciona os 20% de pedidos mais caros, arredondando a quantidade para cima. Mostra a participação deles no gasto; não presume que sejam desperdício.'],
    ['protein','nutricao','Pagar mais traz mais proteína?','Precisamos de 5 pedidos em cada faixa extrema de preço, com estimativa de proteína e calorias.','Compara o quarto inferior e superior de preços. Exclui empates que fariam as faixas se sobrepor. Mede mediana de gramas de proteína por 1.000 kcal do pedido, sem presumir consumo individual ou qualidade nutricional total.'],
    ['clock','ritmo','Seu pedido tem hora marcada?','Precisamos de 20 pedidos distribuídos em um intervalo de pelo menos 14 dias.','Busca, entre 24 inícios de hora, a janela de duas horas com mais pedidos. Considera a passagem pela meia-noite. É concentração observada, não previsão do próximo pedido.']
  ];
  function analyze(raw) {
    const seen=new Set();
    const rows=raw.filter(r=>r.tipo==='Restaurante'&&r.criado_em!==null&&r.criado_em!==undefined&&r.criado_em!=='').map(r=>{
      const date=new Date(r.criado_em), platform=String(r.app||''), name=String(r.loja||'').trim();
      return {id:r.id,date,day:dayOf(date),hour:date.getHours(),name,platform,key:name&&platform?JSON.stringify([platform,name]):null,
        paid:numeric(r.total),subtotal:numeric(r.produtos),fees:numeric(r.taxas),tip:numeric(r.gorjeta),discount:numeric(r.desconto),
        kcal:numeric(r.kcal),protein:numeric(r.prot),confidence:numeric(r.confianca)};
    }).filter(r=>{
      if(!Number.isFinite(r.date.getTime()))return false;
      if(r.id===null||r.id===undefined)return true;
      const key=JSON.stringify([r.platform,String(r.id)]);if(seen.has(key))return false;seen.add(key);return true;
    }).sort((a,b)=>a.date-b.date||String(a.id??'').localeCompare(String(b.id??'')));
    const cards=definitions.map(([id,category,title,need,method])=>({id,category,title,need,method,ready:false,bars:[]}));
    const set=(id,data)=>Object.assign(cards.find(c=>c.id===id),{ready:true},data);
    const first=rows[0]?.day,last=rows.at(-1)?.day,span=rows.length?last-first+1:0;
    const nutrition=rows.filter(r=>r.kcal>0&&r.confidence>=30);
    const paid=rows.filter(r=>valid(r.paid));
    const identified=rows.filter(r=>r.key);

    // 1. Consecutive choices, rather than simply the most popular restaurant.
    const transitions=rows.slice(1).map((r,i)=>[rows[i],r]).filter(([a,b])=>a.key&&b.key);
    if(transitions.length>=9&&new Set(identified.map(r=>r.key)).size>=2){
      const repeats=transitions.filter(([a,b])=>a.key===b.key).length;
      const total=transitions.length,rate=repeats/total*100;
      set('repeat',{value:fmt(rate)+'%',unit:'dos pedidos repetem a loja anterior',
        summary:rate>=50?'A repetição imediata aparece em pelo menos metade das transições.':'Trocar de restaurante é mais frequente que repetir imediatamente.',
        evidence:`${repeats} repetições em ${total} transições entre pedidos identificados.`,
        bars:[{label:'Mesma loja',value:repeats,text:repeats+' transições'},{label:'Outra loja',value:total-repeats,text:(total-repeats)+' transições'}]});
    }
    // 2. Mature discovery cohort with a full, equal observation window.
    const stores=new Map();for(const r of identified){if(!stores.has(r.key))stores.set(r.key,[]);stores.get(r.key).push(r);}
    const cohort=[...stores.values()].filter(rs=>rs[0].day>=first+14&&rs[0].day<=last-30);
    if(cohort.length>=5){
      const returned=cohort.filter(rs=>rs.some(r=>r.day>rs[0].day&&r.day<=rs[0].day+30)).length;
      set('discovery',{value:`${returned} de ${cohort.length}`,unit:'novidades receberam outro pedido em até 30 dias',
        summary:'O retorno separa uma experiência pontual de um lugar que começa a entrar na rotina.',
        evidence:`${cohort.length} primeiras aparições elegíveis no recorte, todas com a mesma janela de acompanhamento.`,
        bars:[{label:'Com retorno',value:returned,text:returned+' lojas'},{label:'Sem retorno registrado',value:cohort.length-returned,text:(cohort.length-returned)+' lojas'}]});
    }
    // 3. Calendar-day denominators, not number of orders on each day.
    if(span>=28&&span<=20000){
      const active=new Set(rows.map(r=>r.day)),groups=[{n:0,yes:0},{n:0,yes:0}];
      for(let day=first+1;day<=last;day++){const g=groups[active.has(day-1)?1:0];g.n++;if(active.has(day))g.yes++;}
      if(groups.every(g=>g.n>=10)){
        const without=groups[0].yes/groups[0].n*100,withOrder=groups[1].yes/groups[1].n*100;
        set('momentum',{value:signed(withOrder-without)+' p.p.',unit:'na presença de pedido no dia seguinte',
          summary:Math.abs(withOrder-without)<5?'As duas situações têm frequências próximas neste recorte.':withOrder>without?'Dias com pedido são seguidos por outro dia com pedido com mais frequência.':'Depois de um dia com pedido, outro pedido aparece com menos frequência.',
          evidence:`Com pedido anterior: ${groups[1].yes}/${groups[1].n} dias; sem registro anterior: ${groups[0].yes}/${groups[0].n}.`,
          bars:[{label:'Após dia com pedido',value:withOrder,text:fmt(withOrder)+'%'},{label:'Após dia sem registro',value:without,text:fmt(without)+'%'}]});
      }
    }
    // 4. Only whole Monday–Sunday weeks, with per-calendar-day normalization.
    if(rows.length){
      const start=first+(8-weekday(first))%7,end=last-weekday(last),weeks=Math.floor((end-start+1)/7);
      const complete=rows.filter(r=>r.day>=start&&r.day<=end);
      const weekend=complete.filter(r=>[0,6].includes(weekday(r.day))),workday=complete.filter(r=>![0,6].includes(weekday(r.day)));
      if(weeks>=4&&weekend.length>=5&&workday.length>=5&&complete.every(r=>valid(r.paid))){
        const a=sum(weekend.map(r=>r.paid))/(weeks*2),b=sum(workday.map(r=>r.paid))/(weeks*5);
        set('weekend',{value:(a>=b?'+':'−')+money(Math.abs(a-b)),unit:'por dia de fim de semana, em comparação aos dias úteis',
          summary:'A comparação corrige o fato de existirem cinco dias úteis e apenas dois dias de fim de semana.',
          evidence:`${weeks} semanas inteiras no recorte; ${weekend.length} pedidos no fim de semana e ${workday.length} nos dias úteis.`,
          bars:[{label:'Sábado e domingo',value:a,text:money(a)+'/dia'},{label:'Segunda a sexta',value:b,text:money(b)+'/dia'}]});
      }
    }
    // 5. Evening versus late-night, excluding breakfast/lunch and weak estimates.
    const evening=nutrition.filter(r=>r.hour>=18&&r.hour<22),late=nutrition.filter(r=>r.hour>=22||r.hour<5);
    if(evening.length>=5&&late.length>=5){
      const a=median(late.map(r=>r.kcal)),b=median(evening.map(r=>r.kcal));
      set('late',{value:signed((a-b)/b*100)+'%',unit:'na mediana de kcal dos pedidos noturnos',
        summary:'Compara pedidos inteiros em dois horários próximos; porções compartilhadas também podem explicar a diferença.',
        evidence:`${late.length} pedidos entre 22h e 5h; ${evening.length} entre 18h e 22h. Estimativas com confiança heurística ≥30.`,
        bars:[{label:'18h–21h59',value:b,text:fmt(b)+' kcal'},{label:'22h–4h59',value:a,text:fmt(a)+' kcal'}]});
    }
    // 6. Choose by sample size, not by the largest discount association.
    const matched=[...stores.values()].map(rs=>({name:rs[0].name,platform:rs[0].platform,
      yes:rs.filter(r=>valid(r.paid)&&r.discount>0),no:rs.filter(r=>valid(r.paid)&&r.discount===0)}))
      .filter(g=>g.yes.length>=3&&g.no.length>=3).sort((a,b)=>(b.yes.length+b.no.length)-(a.yes.length+a.no.length)||a.name.localeCompare(b.name)||a.platform.localeCompare(b.platform));
    if(matched.length){
      const g=matched[0],a=median(g.yes.map(r=>r.paid)),b=median(g.no.map(r=>r.paid));
      set('discount',{value:(a>=b?'+':'−')+money(Math.abs(a-b)),unit:'no total mediano dos pedidos com desconto',
        summary:`${g.name} · ${g.platform}. ${a>b?'Mesmo com desconto, esses pedidos terminaram com uma conta maior.':a<b?'Os pedidos com desconto terminaram com uma conta menor.':'Os dois grupos tiveram a mesma conta mediana.'}`,
        evidence:`${g.yes.length} pedidos com desconto e ${g.no.length} sem; loja com a maior amostra comparável no filtro.`,
        bars:[{label:'Com desconto',value:a,text:money(a)},{label:'Sem desconto',value:b,text:money(b)}]});
    }
    // 7. Ratios of sums preserve the weight of the money actually paid.
    const feeRows=paid.filter(r=>r.paid>0&&valid(r.subtotal)&&valid(r.fees)&&valid(r.tip));
    const middle=median(feeRows.map(r=>r.subtotal)),small=feeRows.filter(r=>r.subtotal<middle),large=feeRows.filter(r=>r.subtotal>=middle);
    if(small.length>=5&&large.length>=5){
      const rate=rs=>sum(rs.map(r=>r.fees+r.tip))/sum(rs.map(r=>r.paid))*100,a=rate(small),b=rate(large);
      set('fees',{value:signed(a-b)+' p.p.',unit:'de participação de taxas nos pedidos menores',
        summary:`Corte pelo subtotal de ${money(middle)}. A conta inclui entrega, serviço e gorjeta quando registrados nesses campos.`,
        evidence:`${small.length} pedidos menores e ${large.length} maiores. Percentuais sobre o total pago de cada grupo.`,
        bars:[{label:'Abaixo do corte',value:a,text:fmt(a)+'%'},{label:'A partir do corte',value:b,text:fmt(b)+'%'}]});
    }
    // 8. Concentration of spend, with an explicit rounded order count.
    if(paid.length>=10&&sum(paid.map(r=>r.paid))>0){
      const sorted=paid.slice().sort((a,b)=>b.paid-a.paid),n=Math.ceil(sorted.length*.2),top=sum(sorted.slice(0,n).map(r=>r.paid)),total=sum(sorted.map(r=>r.paid));
      set('spikes',{value:fmt(top/total*100)+'%',unit:`do gasto vem dos ${n} pedidos mais caros`,
        summary:`São ${fmt(n/paid.length*100)}% dos pedidos com total conhecido. O peso desses pedidos mostra onde uma revisão da conta teria mais alcance.`,
        evidence:`${paid.length} pedidos; gasto conhecido de ${money(total)}.`,
        bars:[{label:`${n} maiores contas`,value:top,text:money(top)},{label:'Demais pedidos',value:total-top,text:money(total-top)}]});
    }
    // 9. Energy-normalized protein avoids simply rewarding larger orders.
    const proteinRows=nutrition.filter(r=>valid(r.protein)&&r.paid>0),q1=quantile(proteinRows.map(r=>r.paid),.25),q3=quantile(proteinRows.map(r=>r.paid),.75);
    const cheap=proteinRows.filter(r=>r.paid<=q1),expensive=proteinRows.filter(r=>r.paid>=q3);
    if(q1<q3&&cheap.length>=5&&expensive.length>=5){
      const density=rs=>median(rs.map(r=>r.protein/r.kcal*1000)),a=density(expensive),b=density(cheap);
      set('protein',{value:signed(a-b)+' g',unit:'de proteína por 1.000 kcal nos pedidos mais caros',
        summary:'Compara densidade proteica, para que um pedido grande não ganhe apenas por ter mais comida.',
        evidence:`${expensive.length} pedidos a partir de ${money(q3)} e ${cheap.length} até ${money(q1)}; estimativas com confiança heurística ≥30.`,
        bars:[{label:'Faixa mais barata',value:b,text:fmt(b)+' g / 1.000 kcal'},{label:'Faixa mais cara',value:a,text:fmt(a)+' g / 1.000 kcal'}]});
    }
    // 10. Circular two-hour windows include 23h–1h correctly.
    if(rows.length>=20&&span>=14){
      const hours=Array(24).fill(0);rows.forEach(r=>hours[r.hour]++);
      let start=0,best=0;for(let h=0;h<24;h++){const n=hours[h]+hours[(h+1)%24];if(n>best){best=n;start=h;}}
      set('clock',{value:`${start}h–${(start+2)%24}h`,unit:'é sua janela de duas horas mais frequente',
        summary:`${fmt(best/rows.length*100)}% dos pedidos caem nessa janela. ${best/rows.length>=.5?'Pelo menos metade das escolhas se concentra nesse horário.':'A maior parte dos pedidos ainda acontece fora dessa janela.'}`,
        evidence:`${best} de ${rows.length} pedidos, em um intervalo de ${span} dias. Horário local do navegador.`,
        bars:[{label:'Dentro da janela',value:best,text:best+' pedidos'},{label:'Outros horários',value:rows.length-best,text:(rows.length-best)+' pedidos'}]});
    }
    return {cards,count:rows.length,ready:cards.filter(c=>c.ready).length};
  }
  let lastResult=null;
  function paint(){
    const host=document.getElementById('habitCards');if(!host||!lastResult)return;
    const category=document.getElementById('habitCategory')?.value||'all';
    const labels={escolhas:'Escolhas',ritmo:'Ritmo',bolso:'Bolso',nutricao:'Nutrição'};
    const shown=lastResult.cards.filter(c=>category==='all'||c.category===category);
    host.innerHTML=shown.map(c=>{
      const index=definitions.findIndex(d=>d[0]===c.id)+1,max=Math.max(1,...c.bars.map(b=>b.value));
      const bars=c.bars.map(b=>`<div class="habit-bar"><div><span>${escape(b.label)}</span><b>${escape(b.text)}</b></div><div class="habit-track" aria-hidden="true"><i style="width:${Math.max(0,b.value/max*100)}%"></i></div></div>`).join('');
      return `<article class="habit-card ${c.ready?'':'habit-pending'}" data-habit="${c.id}"><div class="habit-heading"><span>${String(index).padStart(2,'0')} · ${labels[c.category]}</span><span class="habit-state">${c.ready?'No seu histórico':'Faltam dados'}</span></div><h3>${escape(c.title)}</h3>${c.ready?`<div class="habit-value">${escape(c.value)}</div><p class="habit-unit">${escape(c.unit)}</p><p class="habit-summary">${escape(c.summary)}</p><div class="habit-bars">${bars}</div><p class="habit-evidence">${escape(c.evidence)}</p>`:`<p class="habit-summary">${escape(c.need)}</p>`}<details><summary>Como calculamos</summary><p>${escape(c.method)}</p></details></article>`;
    }).join('');
    document.getElementById('habitStatus').textContent=`${lastResult.ready} de 10 análises com dados suficientes · ${lastResult.count} pedidos de restaurante no filtro · ${shown.length} cards exibidos.`;
  }
  function render(rows){
    if(!document.getElementById('habitCards'))return;
    lastResult=analyze(rows);
    const select=document.getElementById('habitCategory');
    if(select&&!select.dataset.bound){select.dataset.bound='1';select.addEventListener('change',paint);}
    paint();return lastResult;
  }
  return {analyze,render};
})();
