window.EatIQAnalysis = (() => {
  const number = n => Math.round(n).toLocaleString('pt-BR');
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dateLabel = date => date.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'});
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  function quantile(values, q) {
    const sorted = values.slice().sort((a,b) => a-b);
    if (!sorted.length) return null;
    const index = (sorted.length-1)*q, lo = Math.floor(index), fraction = index-lo;
    return sorted[lo] + (sorted[Math.min(lo+1, sorted.length-1)]-sorted[lo])*fraction;
  }
  function analyze(orders) {
    const meals = orders.filter(o => o.meal && Number.isFinite(new Date(o.date).getTime()));
    const usable = meals.filter(o => finite(o.kOrder) && o.kOrder>0 && finite(o.conf) && o.conf>=30);
    const quality = {known:0, estimated:0, review:0, missing:0};
    for (const o of meals) {
      if (!finite(o.kOrder) || o.kOrder<=0 || !finite(o.conf) || o.conf<=0) quality.missing++;
      else if (o.conf>=65) quality.known++;
      else if (o.conf>=30) quality.estimated++;
      else quality.review++;
    }
    const kcal = usable.map(o => o.kOrder);
    const result = {count:meals.length, used:usable.length, quality,
      median:quantile(kcal,.5), q1:quantile(kcal,.25), q3:quantile(kcal,.75), trend:null, ranking:[]};
    if (meals.length) {
      const ordered = meals.slice().sort((a,b) => new Date(a.date)-new Date(b.date));
      const end = new Date(ordered.at(-1).date); end.setHours(0,0,0,0); end.setDate(end.getDate()+1);
      const recentStart = new Date(end); recentStart.setDate(recentStart.getDate()-28);
      const previousStart = new Date(recentStart); previousStart.setDate(previousStart.getDate()-28);
      const first = new Date(ordered[0].date); first.setHours(0,0,0,0);
      const recent = usable.filter(o => new Date(o.date)>=recentStart && new Date(o.date)<end);
      const previous = usable.filter(o => new Date(o.date)>=previousStart && new Date(o.date)<recentStart);
      const enough = first<=previousStart && recent.length>=5 && previous.length>=5;
      const now = quantile(recent.map(o => o.kOrder),.5), before = quantile(previous.map(o => o.kOrder),.5);
      const recentEnd = new Date(end); recentEnd.setDate(recentEnd.getDate()-1);
      const previousEnd = new Date(recentStart); previousEnd.setDate(previousEnd.getDate()-1);
      result.trend = {enough, now, before, recentCount:recent.length, previousCount:previous.length,
        change:enough?(now-before)/before*100:null,
        recentLabel:dateLabel(recentStart)+'–'+dateLabel(recentEnd),
        previousLabel:dateLabel(previousStart)+'–'+dateLabel(previousEnd)};
    }
    const stores = new Map();
    for (const o of usable) {
      if (!finite(o.pOrder) || o.pOrder<0 || !finite(o.tot) || o.tot<=0) continue;
      const key = JSON.stringify([o.p, o.s]);
      if (!stores.has(key)) stores.set(key, {name:o.s, app:o.p, count:0, protein:0, paid:0});
      const store = stores.get(key); store.count++; store.protein+=o.pOrder; store.paid+=o.tot;
    }
    result.ranking = [...stores.values()].filter(s => s.count>=3)
      .map(s => ({...s, value:s.protein/s.paid*10}))
      .sort((a,b) => b.value-a.value || String(a.name).localeCompare(String(b.name))).slice(0,5);
    return result;
  }
  function render(orders) {
    const result = analyze(orders), get = id => document.getElementById(id);
    if (!get('orderTypical')) return;
    get('orderTypical').innerHTML = result.median===null
      ? '<p class="analysis-empty">Importe pedidos com estimativas suficientes para conhecer sua porção típica.</p>'
      : `<div class="analysis-value">${number(result.median)} <span>kcal / pedido</span></div><p class="analysis-detail">Metade dos pedidos fica entre <b>${number(result.q1)} e ${number(result.q3)} kcal</b>.</p><p class="analysis-evidence">Mediana de ${result.used} de ${result.count} pedidos de restaurante no filtro. Pedido inteiro; pode incluir mais de uma pessoa.</p>`;
    const trend = result.trend;
    get('orderTrend').innerHTML = !trend?.enough
      ? '<p class="analysis-empty">Ainda falta histórico para comparar.</p><p class="analysis-evidence">Precisamos de um intervalo de 56 dias e ao menos 5 pedidos com estimativa suficiente em cada janela de 28 dias.</p>'
      : `<div class="analysis-value">${Math.abs(trend.change)<.5?'Estável':(trend.change>0?'+':'−')+number(Math.abs(trend.change))+'%'} <span>na mediana de kcal / pedido</span></div><div class="analysis-comparison"><div><span>${escape(trend.previousLabel)}</span><b>${number(trend.before)} kcal</b><small>${trend.previousCount} pedidos</small></div><span aria-hidden="true">→</span><div><span>${escape(trend.recentLabel)}</span><b>${number(trend.now)} kcal</b><small>${trend.recentCount} pedidos</small></div></div><p class="analysis-evidence">Janelas ancoradas no último pedido do filtro. Mudança na composição dos pedidos importados; não mede mudança no consumo diário.</p>`;
    const buckets = [['known','Base / peso identificado'],['estimated','Porção ou receita estimada'],['review','Baixa confiança'],['missing','Sem estimativa suficiente']];
    get('qualityChart').innerHTML = result.count
      ? `<div class="analysis-value">${result.used}<span> de ${result.count} pedidos</span></div><p class="analysis-detail">Com estimativa utilizável nos cards acima.</p><ul class="analysis-quality">${buckets.map(([key,label])=>`<li><span>${label}</span><b>${result.quality[key]}</b></li>`).join('')}</ul>`
      : '<p class="analysis-empty">A cobertura aparece após importar seus pedidos.</p>';
    get('qualityFoot').textContent = 'Classificação heurística, não percentual de acerto. Receitas e porções continuam estimadas. Revise os pedidos de baixa confiança na tabela.';
    const max = result.ranking[0]?.value || 1;
    get('protRank').innerHTML = result.ranking.map(s => `<li><div><div class="name">${escape(s.name)}</div><div class="meta">${escape(s.app)} · ${s.count} pedidos analisados</div><div class="bar"><i style="width:${s.value/max*100}%"></i></div></div><div class="right"><b>${s.value.toLocaleString('pt-BR',{maximumFractionDigits:1})} g</b><small>por R$ 10 pagos</small></div></li>`).join('') || '<li class="meta">São necessários 3 pedidos com estimativa suficiente por restaurante e plataforma.</li>';
    return result;
  }
  return {analyze, render};
})();
