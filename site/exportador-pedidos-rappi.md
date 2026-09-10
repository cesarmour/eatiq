# Fluxo: exportar histórico completo de pedidos da Rappi

Runbook do processo usado em 10/09/2026 para baixar todos os pedidos de uma conta Rappi Brasil, gerar a planilha `rappi_pedidos_completo_calorias.xlsx` e estimar calorias e macronutrientes. Tudo roda no navegador, dentro da sessão logada do próprio usuário. Nenhum dado sai da página, exceto o arquivo baixado no final.

Resultado da execução de referência: 1.775 pedidos (out/2017 a set/2026), 1.775 comprovantes, 8.853 linhas de item, 3.455 produtos distintos, arquivo de 2,6 MB.

## Visão geral

```
[1] Abrir rappi.com.br/account/orders logado
        │
[2] Capturar headers de autenticação (hook no XHR + clique em "Ver mais")
        │
[3] Listar todos os pedidos ── support-order/latest-orders/{page}
        │                      (+ history-user para recuperar faltantes)
[4] Baixar comprovante de cada pedido ── order-resume/fully/{id}
        │
[5] (opcional) Estimar nutrição por produto ── catálogo → estimativa → revisão por preço
        │
[6] Montar XLSX no navegador (writer próprio + deflate) e baixar
```

Tempo aproximado: listagem 3 min, comprovantes 20 min (2 workers), estimativa nutricional 6 a 7 min com 8 agentes em paralelo + 3 min de revisão, montagem do arquivo menos de 1 s.

## Pré-requisitos

- Chrome logado na conta Rappi, aba em `https://www.rappi.com.br/account/orders`.
- Execução de JavaScript na página: console do DevTools ou a ferramenta `javascript_tool` do Claude in Chrome.
- Não fechar nem recarregar a aba durante o processo. Os dados ficam em memória (`window.__*`); os comprovantes também são gravados no IndexedDB `rappiCrawl` e as estimativas nutricionais no `localStorage` (`rappiNut`, `rappiFix`).

## Endpoints

| Uso | Método e URL | Paginação | Observações |
| --- | --- | --- | --- |
| Histórico da página "Meus pedidos" | `GET https://v2.rappi.com.br/api/orders/history-user?page=N` | 5 por página; aceita `per_page=100` | Limitado a 40 pedidos (cerca de 6 meses). É o que o botão "Ver mais" consome. Traz `sale_type` dos itens. |
| Lista completa | `GET https://services.rappi.com.br/api/support-order/latest-orders/{page}` | Começa em 0, cerca de 10 por página, até `recent_orders` vazio | Campos: `id, status, created_at, store_type_store, calculated_store_type, store_brand`. `total_recent_orders` informa o total (1.823), mas a lista omite alguns pedidos (1.773 retornados). |
| Comprovante | `GET https://services.rappi.com.br/order-resume/fully/{id}` | 1 por pedido | Funciona para pedidos antigos e restaurantes. Campos abaixo. |
| Status em aberto | `GET https://services.rappi.com.br/user-orders/v1/status/` | | Não usado. |

Headers exigidos (capturados da própria página, nunca copiados para fora dela): `Authorization`, `Content-Type`, `accept-language`, `deviceid`, `Accept`. O `fetch` direto sem esses headers falha por CORS; usar `XMLHttpRequest` com os headers capturados.

### Estrutura do comprovante (`order-resume/fully/{id}`)

| Campo | Conteúdo |
| --- | --- |
| `order_id, created_at, state, store_type, payment_method, coupon_code, rate` | Dados do pedido |
| `address {name, tag, description, lat, lng}` | Endereço de entrega |
| `store {store_id, name, type, address, lat, lng, logo}` | Loja |
| `products[] {product_id, name, description, presentation, units, unit_price, total_price, comments, toppings[], image}` | Itens. `toppings` é lista de strings |
| `whims[] {name, price, url_image}` | Pedidos especiais (Rappi Favor) |
| `storekeeper {id, full_name, transport_media_type, rate, profile_pic}` | Entregador |
| `order_modifications[] {type, created_at}` | `type = arrive` dá o horário de chegada |
| `totals[] {description, value, index}` | `Custo dos produtos`, `Custo total` (taxas), `Descontos totais`, `Créditos utilizados`, `Gorjeta`, `Preço dos produtos adicionados`, `Desconto para o "Mesmo preço garantido"`, `Total` |
| `cc_data {card_type, last_four_digits, gateway_type}` | Cartão |

Status encontrados: `pending_review` e `finished` (entregue), `canceled`, `canceled_by_automation`, `canceled_by_fraud`, `canceled_by_early_regret`, `canceled_with_charge`.

Tipos de loja (`calculated_store_type`): `express` (Turbo), `market`, `express_picker`, `restaurant`, `restaurant_tablet`, `marketplace`, `courier`, `whim` (Rappi Favor), `rappi_prime`, `express_tablet`, `ultraservicio`, `grin`.

## Passo 1. Capturar os headers

Instala um hook no `XMLHttpRequest` e dispara uma requisição legítima da página clicando em "Ver mais". Não usar "Imprimir comprovante": ele abre o diálogo de impressão, que trava a execução de JavaScript na aba.

```js
window.__H = null;
(function(){
  const X = XMLHttpRequest.prototype, oo = X.open, sh = X.setRequestHeader, os = X.send;
  X.open = function(m,u){ this.__u = u; return oo.apply(this, arguments); };
  X.setRequestHeader = function(k,v){ (this.__hh = this.__hh || {})[k] = v; return sh.apply(this, arguments); };
  X.send = function(){
    if (/history-user/.test(this.__u) && this.__hh && this.__hh.Authorization) window.__H = this.__hh;
    return os.apply(this, arguments);
  };
})();
await new Promise(r => setTimeout(r, 2500));
[...document.querySelectorAll('button')]
  .find(e => /Ver mais/i.test(e.textContent) && e.textContent.trim().length < 15)?.click();
await new Promise(r => setTimeout(r, 2500));
!!window.__H   // deve ser true
```

Helper usado nos passos seguintes:

```js
window.__get = u => new Promise(res => {
  const x = new XMLHttpRequest(); x.open('GET', u);
  for (const k in window.__H) if (k !== 'sentry-trace') x.setRequestHeader(k, window.__H[k]);
  x.onload = () => res({ s: x.status, t: x.responseText });
  x.onerror = () => res({ s: 0, t: '' });
  x.send();
});
window.__sleep = ms => new Promise(r => setTimeout(r, ms));
```

## Passo 2. Listar todos os pedidos

```js
window.__sup = {}; window.__supDone = false;
(async () => {
  for (let p = 0; p < 500; p++) {
    let r;
    for (let i = 0; i < 4; i++) {
      r = await __get('https://services.rappi.com.br/api/support-order/latest-orders/' + p);
      if (r.s !== 429) break;
      await __sleep(4000);
    }
    window.__sup[p] = r;
    let n = 0; try { n = JSON.parse(r.t).recent_orders.length; } catch (e) {}
    if (!n) break;
    await __sleep(900);
  }
  const all = [], seen = new Set();
  Object.keys(__sup).sort((a,b) => a-b).forEach(p => {
    try { JSON.parse(__sup[p].t).recent_orders.forEach(o => { if (!seen.has(o.id)) { seen.add(o.id); all.push(o); } }); } catch (e) {}
  });
  window.__list = all;
  window.__totalReported = JSON.parse(__sup[0].t).total_recent_orders;
  window.__supDone = true;
})();
// acompanhar: ({done: __supDone, pages: Object.keys(__sup).length, n: (__list||[]).length})
```

Recuperar pedidos que a lista omite. Na execução de referência, os 2 faltantes entre os 40 do histórico da página eram `canceled_by_early_regret`:

```js
const h = JSON.parse((await __get('https://v2.rappi.com.br/api/orders/history-user?page=1&per_page=100')).t).data;
const have = new Set(__list.map(o => o.id));
window.__extraIds = [];
h.filter(o => !have.has(o.id)).forEach(o => {
  __extraIds.push(o.id);
  __list.push({ id: o.id, status: o.state, created_at: o.created_at,
    store_type_store: o.store?.store_type, calculated_store_type: o.calculated_information?.store_type,
    store_brand: o.store?.name });
});
__extraIds
```

## Passo 3. Baixar os comprovantes

Dois workers, 350 ms entre chamadas, backoff em 429. Nenhum 429 ocorreu nessa cadência (1.775 chamadas em cerca de 20 min).

```js
window.__det = window.__det || {};
window.__detStat = { ok: 0, err: 0, r429: 0, done: false };
const idbPut = (id, val) => new Promise(res => {
  const rq = indexedDB.open('rappiCrawl', 1);
  rq.onupgradeneeded = () => rq.result.createObjectStore('d');
  rq.onsuccess = () => { const tx = rq.result.transaction('d', 'readwrite'); tx.objectStore('d').put(val, id);
    tx.oncomplete = () => { rq.result.close(); res(); }; tx.onerror = () => { rq.result.close(); res(); }; };
  rq.onerror = () => res();
});
(async () => {
  const queue = __list.map(o => o.id).filter(id => !__det[id]);
  __detStat.total = queue.length;
  async function worker() {
    while (queue.length) {
      const id = queue.shift(); let r;
      for (let i = 0; i < 6; i++) {
        r = await __get('https://services.rappi.com.br/order-resume/fully/' + id);
        if (r.s === 429) { __detStat.r429++; await __sleep(5000 * (i + 1)); continue; }
        break;
      }
      if (r.s === 200) { __det[id] = r.t; __detStat.ok++; idbPut(String(id), r.t); }
      else { __detStat.err++; (window.__detErr = window.__detErr || []).push([id, r.s]); }
      await __sleep(350);
    }
  }
  await Promise.all([worker(), worker()]);
  __detStat.done = true;
})();
// acompanhar: __detStat
```

Se a aba recarregar, os comprovantes podem ser relidos do IndexedDB `rappiCrawl` (object store `d`, chave = id do pedido). A lista (passo 2) precisa ser refeita.

## Passo 3b. Remover dados pessoais dos comprovantes

Antes de qualquer validação ou planilha, apague do que foi baixado tudo que identifica você: endereço de entrega com coordenadas, cartão, entregador, cupons pessoais e qualquer campo com e-mail, CPF ou telefone. Loja, itens, valores e horários ficam.

```js
(function () {
  const proibidos = /cpf|email|e-mail|phone|telefone|document|address|lat$|lng$|storekeeper|cc_data|user|customer|token/i;
  const varrer = (o) => {
    if (!o || typeof o !== 'object') return;
    for (const k of Object.keys(o)) {
      if (proibidos.test(k)) { delete o[k]; continue; }
      if (typeof o[k] === 'string' && /\d{3}\.?\d{3}\.?\d{3}-?\d{2}|@/.test(o[k])) { o[k] = '[removido]'; continue; }
      varrer(o[k]);
    }
  };
  let n = 0;
  for (const id of Object.keys(__det)) {
    if (!__det[id]) continue;
    const d = JSON.parse(__det[id]);
    delete d.address; delete d.storekeeper; delete d.cc_data; delete d.coupon_code;
    if (d.store) { delete d.store.address; delete d.store.lat; delete d.store.lng; }
    varrer(d);
    __det[id] = JSON.stringify(d); idbPut(String(id), __det[id]); n++;
  }
  return n;
})();
```

Depois disso, na planilha as colunas de endereço, coordenadas, distância, cartão e entregador saem vazias. Sem rodar este passo, elas saem preenchidas.

## Passo 4. Validações recomendadas

```js
const D = Object.values(__det).filter(Boolean).map(t => JSON.parse(t));
let badItems = 0, badTot = 0;
for (const d of D) {
  const t = {}; (d.totals || []).forEach(x => t[x.description] = parseFloat(x.value));
  const s = (d.products || []).reduce((a, p) => a + (+p.total_price || 0), 0);
  if (Math.abs(s - (t['Custo dos produtos'] || 0)) > 0.05) badItems++;
  const calc = (t['Custo dos produtos']||0) + (t['Custo total']||0) - (t['Descontos totais']||0)
             - (t['Créditos utilizados']||0) + (t['Gorjeta']||0) + (t['Preço dos produtos adicionados']||0);
  if (Math.abs(calc - (t['Total'] || 0)) > 0.05) badTot++;
}
({ comprovantes: D.length, semComprovante: __list.filter(o => !__det[o.id]).length, badItems, badTot })
```

Referência: soma dos itens bate com `Custo dos produtos` em 100% dos casos. O `Total` diverge da conta em 488 pedidos, quase todos antigos (itens em falta, ajustes). A planilha mantém o `Total` informado e mostra a diferença numa coluna à parte.

## Passo 5 (opcional). Estimativa nutricional

### 5.1 Catálogo de produtos distintos

Chave = nome normalizado; em restaurantes, nome + 60 primeiros caracteres da descrição.

```js
const norm = s => (s || '').replace(/\s+/g, ' ').trim();
const cat = new Map();
for (const L of __list) {
  const d = __det[L.id] ? JSON.parse(__det[L.id]) : null; if (!d) continue;
  const vert = d.store_type || L.calculated_store_type || '';
  for (const p of d.products || []) {
    const isRest = /restaurant/.test(vert) || /restaurant/.test(L.store_type_store || '');
    const key = norm(p.name).toLowerCase() + (isRest ? '|' + norm(p.description).toLowerCase().slice(0, 60) : '');
    let c = cat.get(key);
    if (!c) { c = { id: cat.size + 1, name: norm(p.name), desc: norm(p.description).slice(0, isRest ? 90 : 50), rest: isRest, n: 0, tops: new Set() }; cat.set(key, c); }
    c.n++; (p.toppings || []).slice(0, 4).forEach(t => c.tops.size < 4 && c.tops.add(norm(t)));
  }
}
window.__catMap = cat; window.__cat = [...cat.values()];
```

### 5.2 Helpers de leitura e gravação

```js
window.__nut = window.__nut || {};
try { Object.assign(__nut, JSON.parse(localStorage.getItem('rappiNut') || '{}')); } catch (e) {}
window.__getCat = function (a, b) {   // ids a..b, devolve blocos de até 900 caracteres
  const clean = s => String(s || '').replace(/[=?#&|]/g, ' ').replace(/\s+/g, ' ').trim();
  const lines = __cat.filter(c => c.id >= a && c.id <= b).map(c => c.id + '|' + clean(c.name) +
    (c.rest ? ' [RESTAURANTE: ' + clean(c.desc) + (c.tops.size ? ' ; opções: ' + clean([...c.tops].join(', ')) : '') + ']' : ''));
  const out = []; let cur = '';
  for (const l of lines) { if (cur.length + l.length + 1 > 900) { out.push(cur); cur = ''; } cur += (cur ? '\n' : '') + l; }
  if (cur) out.push(cur); return out;
};
window.__setNut = function (str) {   // "id:0;id:w,g,kcal,p,c,f,conf;..."
  let n = 0; const bad = [];
  String(str).split(';').map(s => s.trim()).filter(Boolean).forEach(tok => {
    const m = /^(\d+):(.*)$/.exec(tok); if (!m) { bad.push(tok); return; }
    const v = m[2].split(',').map(Number);
    if (v.length === 1 && v[0] === 0) { __nut[m[1]] = 0; n++; }
    else if (v.length === 7 && v.every(x => isFinite(x))) { __nut[m[1]] = v; n++; }
    else bad.push(tok);
  });
  try { localStorage.setItem('rappiNut', JSON.stringify(__nut)); } catch (e) {}
  return { saved: n, bad, total: Object.keys(__nut).length };
};
window.__nutMissing = (a, b) => __cat.filter(c => c.id >= a && c.id <= b && __nut[c.id] === undefined).map(c => c.id);
```

### 5.3 Formato e regras da estimativa

Uma entrada por produto:

- Não alimento (limpeza, higiene, remédio, vitaminas, pet, utensílios, fraldas): `id:0`
- Alimento ou bebida: `id:w,g,kcal,p,c,f,conf`
  - `w` = 1 se normalmente vendido por peso (hortifruti solto, carnes de açougue, frios fatiados, pão francês), senão 0.
  - `g` = gramas ou ml de conteúdo comestível em 1 unidade vendida (pack inteiro, se for pack). Para `w=1`, uma peça ou porção típica. Para prato de restaurante, a porção inteira descrita.
  - `kcal, p, c, f` = kcal, proteína, carboidrato e gordura por 100 g ou 100 ml, como consumido. Café, chá, caldos e pós preparados com água: `g × kcal / 100` = calorias do que a unidade rende preparada. Álcool entra em `kcal`; macros podem ficar em 0.
  - `conf` (0 a 100): cerca de 85 a 95 embalado com tamanho explícito; 65 a 80 tamanho ou receita inferidos; 45 a 65 restaurante com descrição clara ou hortifruti; 20 a 45 nomes vagos.

Execução de referência: 8 subagentes em paralelo, cada um com cerca de 432 ids. Cada agente lê `__getCat(a, b)`, grava em lotes de 60 a 80 tokens com `__setNut("...")` e confere `__nutMissing(a, b)` até voltar vazio. Resultado: 2.327 alimentos e 1.128 não alimentos.

### 5.4 Revisão de tamanho pelo preço

Produtos sem tamanho no nome recebem uma segunda passada usando o preço mediano pago (itens por peso excluídos). Exemplo típico de erro corrigido: arroz de R$ 8 estimado como pacote de 5 kg.

```js
const nrm = s => (s || '').replace(/\s+/g, ' ').trim();
const sizeRe = /\d+(?:[.,]\d+)?\s*(?:g|gr|grs|gramas|kg|kilo|quilo|ml|l|lt|litro|litros|cl|oz)\b|\d+\s*(?:x|un|und|unid|unidades|c[aá]psulas|sach[eê]s|rolos|fatias|p[aã]es)\b/i;
const pr = {};
for (const L of __list) {
  const d = JSON.parse(__det[L.id]); const vert = d.store_type || L.calculated_store_type || '';
  const isRest = /restaurant/.test(vert) || /restaurant/.test(L.store_type_store || '');
  for (const p of d.products || []) {
    const key = nrm(p.name).toLowerCase() + (isRest ? '|' + nrm(p.description).toLowerCase().slice(0, 60) : '');
    const c = __catMap.get(key); const u = +p.units||0, up = +p.unit_price||0, tp = +p.total_price||0;
    if (!(u && up && tp) || tp / (u * up) < 0.9 || /Gramas/i.test(p.presentation || '')) continue;
    (pr[c.id] = pr[c.id] || []).push([up, d.created_at.slice(0, 4)]);
  }
}
window.__review = __cat.filter(c => Array.isArray(__nut[c.id]) && !c.rest && !sizeRe.test(c.name) && pr[c.id]).map(c => {
  const ps = pr[c.id].map(x => x[0]).sort((a, b) => a - b); const yrs = [...new Set(pr[c.id].map(x => x[1]))].sort();
  return { id: c.id, name: c.name, price: ps[Math.floor(ps.length / 2)], yr: yrs[0] + (yrs.length > 1 ? '-' + yrs[yrs.length - 1] : '') };
});
window.__getReview = function (a, b) {   // índices a..b de __review
  const clean = s => String(s || '').replace(/[=?#&|]/g, ' ').replace(/\s+/g, ' ').trim();
  const lines = __review.slice(a, b + 1).map(x => { const v = __nut[x.id];
    return x.id + '|' + clean(x.name) + '|g ' + v[1] + '|kcal/100 ' + v[2] + '|kcal/unid ' + Math.round(v[1] * v[2] / 100) + '|preço R$ ' + x.price + '|ano ' + x.yr; });
  const out = []; let cur = '';
  for (const l of lines) { if (cur.length + l.length + 1 > 900) { out.push(cur); cur = ''; } cur += (cur ? '\n' : '') + l; }
  if (cur) out.push(cur); return out;
};
window.__fixLog = window.__fixLog || {};
window.__fixG = function (str) {   // "id:novoG,novaConf;..."
  let n = 0; const bad = [];
  String(str).split(';').map(s => s.trim()).filter(Boolean).forEach(tok => {
    const m = /^(\d+):(\d+(?:\.\d+)?),(\d+)$/.exec(tok); const v = m && __nut[m[1]];
    if (!m || !Array.isArray(v)) { bad.push(tok); return; }
    __fixLog[m[1]] = [v[1], v[6]]; v[1] = +m[2]; v[6] = +m[3]; n++;
  });
  try { localStorage.setItem('rappiNut', JSON.stringify(__nut)); localStorage.setItem('rappiFix', JSON.stringify(__fixLog)); } catch (e) {}
  return { fixed: n, bad, totalFixed: Object.keys(__fixLog).length };
};
__review.length
```

Execução de referência: 1.216 produtos revisados por 3 agentes, 118 correções.

### 5.5 Quantidade por linha de item

Implementado em `__nutLine` (Apêndice C):

1. Se `presentation` tem "N Gramas": usa N gramas.
2. Senão, se `total_price / (units × unit_price) < 0.9`: item vendido por peso, `unit_price` é preço por kg, gramas = `total_price / unit_price × 1000`.
3. Senão: gramas = `units × g`.

Nutrientes da linha = valores por 100 g × gramas / 100. No pedido: soma das linhas; % de kcal por macro usa 4/4/9 kcal por grama; confiança = média das confianças dos itens ponderada pelas kcal.

## Passo 6. Montar e baixar a planilha

Colar no console, nesta ordem, os scripts dos apêndices A (writer XLSX), B (compressão), C (nutrição, opcional) e D (montagem). Depois:

```js
const r = buildRappi(__list, __det, new Date().toLocaleDateString('pt-BR'));
const z = await XW.deflateZip(XW.build(r.sheets));
const url = URL.createObjectURL(z);
const a = Object.assign(document.createElement('a'), { href: url, download: 'rappi_pedidos_completo_calorias.xlsx' });
document.body.appendChild(a); a.click();
setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 60000);
r.stats
```

Sem o passo 5, definir antes `window.__nutLine = () => ({food: null}); window.__aggNut = () => {}; window.__nutCols = () => [null,null,null,null,null,null,null,null,0];` para gerar a planilha sem as colunas preenchidas.

Abas geradas:

| Aba | Conteúdo |
| --- | --- |
| Resumo | Indicadores com fórmulas (e valores em cache), por ano, por tipo de loja, notas de método |
| Pedidos | 1 linha por pedido: datas, tempo de entrega, status, loja, endereços e coordenadas, distância, pagamento, totais, entregador, calorias, macros, confiança |
| Lojas | Agregado por loja (entregues, cancelados, gasto, ticket, taxas, tempo médio) |
| Produtos | Agregado por produto (pedidos, unidades, gasto, preço médio/mín/máx, primeira e última compra) |
| Itens | 1 linha por item: produto, apresentação, unidades, preços, complementos, descrição, quantidade estimada, kcal, macros, confiança |

Por que um writer próprio: a CSP da Rappi não garante carregar bibliotecas externas (SheetJS etc.). O writer gera XML SpreadsheetML com strings inline, estilos fixos e fórmulas com valor em cache (`fullCalcOnLoad=1`), empacota em ZIP e comprime com `CompressionStream('deflate-raw')`. Validado com openpyxl e recálculo no LibreOffice sem erros e sem divergência entre cache e recálculo.

## Armadilhas encontradas

- **"Ver mais" não mostra tudo.** A página usa `history-user`, que devolve no máximo 40 pedidos. Para o histórico completo, usar `support-order/latest-orders`.
- **A lista completa não é completa.** `total_recent_orders` = 1.823, mas só 1.773 vêm na paginação; algumas páginas voltam com 8 ou 9 itens em vez de 10. Cancelamentos por arrependimento não aparecem. Cruzar com `history-user`.
- **"Imprimir comprovante" trava a automação.** Abre o diálogo de impressão e bloqueia JavaScript e screenshots na aba até navegar para fora.
- **`fetch` sem headers falha.** Usar XHR com os headers capturados da própria página.
- **Buffer de Resource Timing.** `performance.getEntriesByType('resource')` para em 250 entradas; chamar `performance.setResourceTimingBufferSize(2000)` se precisar inspecionar a rede.
- **Saída do `javascript_tool` do Claude in Chrome.** Strings acima de cerca de 1.000 caracteres são truncadas; devolver arrays de blocos de até 900 caracteres. Conteúdo que parece JWT, Base64 ou query string (`a=b&c=d`, URLs com `?`) é bloqueado; limpar `= ? & #` antes de exibir.
- **Itens vendidos por peso.** `unit_price` é preço por kg e `total_price` é o valor cobrado. Detectar pela razão `total / (units × unit_price) < 0.9`. Isso também afeta mínimo e máximo de preço por produto.
- **Totais de pedidos antigos.** O `Total` pode não fechar com os componentes; não recalcular, manter o informado.
- **Datas.** `date` da lista de suporte vem 3 h antes de `created_at`. `created_at` bate com o horário local de São Paulo e é o que a planilha usa.

## Privacidade e limites

- Endpoints não oficiais; podem mudar sem aviso. Usar apenas com a própria conta.
- O token de autenticação fica só na memória da página. Não imprimir, não salvar, não enviar para fora.
- Sem o passo 3b, a planilha contém dados pessoais: endereços com coordenadas, final do cartão e nomes de entregadores. Rode o passo 3b antes de montar o arquivo, sempre.
- Calorias e macros são estimativas por nome de produto, não tabela nutricional real. Somam o pedido inteiro (a casa), não refeições individuais.

## Apêndices

### A. Writer XLSX (`XW.build`)

Gera o workbook (ZIP sem compressão) a partir de `sheets = [{name, rows, header, autoFilter, freeze, widths, colStyles}]`. Célula: valor simples ou `{v, s, f}` (valor, estilo, fórmula).

```js
// Minimal XLSX writer (stored zip, inline strings, styles, formulas with cached values)
window.XW = (function(){
  const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
  function crc32(u){let c=0xFFFFFFFF;for(let i=0;i<u.length;i++)c=CRC[(c^u[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
  const enc=new TextEncoder();
  function zip(files){
    const parts=[], central=[]; let off=0;
    for(const f of files){
      const nm=enc.encode(f.name), d=enc.encode(f.data), crc=crc32(d);
      const h=new DataView(new ArrayBuffer(30));
      h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,0,true);h.setUint16(10,0,true);h.setUint16(12,0x21,true);
      h.setUint32(14,crc,true);h.setUint32(18,d.length,true);h.setUint32(22,d.length,true);h.setUint16(26,nm.length,true);h.setUint16(28,0,true);
      parts.push(new Uint8Array(h.buffer),nm,d);
      const c=new DataView(new ArrayBuffer(46));
      c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(10,0,true);c.setUint16(12,0,true);c.setUint16(14,0x21,true);
      c.setUint32(16,crc,true);c.setUint32(20,d.length,true);c.setUint32(24,d.length,true);c.setUint16(28,nm.length,true);
      c.setUint16(30,0,true);c.setUint16(32,0,true);c.setUint16(34,0,true);c.setUint16(36,0,true);c.setUint32(38,0,true);c.setUint32(42,off,true);
      central.push(new Uint8Array(c.buffer),nm);
      off+=30+nm.length+d.length;
    }
    const csize=central.reduce((a,b)=>a+b.length,0);
    const e=new DataView(new ArrayBuffer(22));
    e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,csize,true);e.setUint32(16,off,true);
    return new Blob([...parts,...central,new Uint8Array(e.buffer)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }
  const BAD=new RegExp('[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\uFFFE\\uFFFF]','g');
  const esc=s=>String(s).replace(BAD,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  function col(n){let s='';n++;while(n>0){const m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=Math.floor((n-1)/26)}return s}
  const EPOCH=Date.UTC(1899,11,30);
  function serial(str){
    const m=/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(str||''); if(!m) return null;
    return (Date.UTC(+m[1],+m[2]-1,+m[3],+(m[4]||0),+(m[5]||0),+(m[6]||0))-EPOCH)/86400000;
  }
  const ST={def:0,head:1,dt:2,brl:3,int:4,bold:5,pct:6,date:7,title:8,note:9,dec:10,boldbrl:11,text:12,coord:13,boldint:14};
  const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
'<numFmts count="5"><numFmt numFmtId="164" formatCode="dd/mm/yyyy hh:mm"/><numFmt numFmtId="165" formatCode="&quot;R$&quot; #,##0.00;-&quot;R$&quot; #,##0.00;&quot;-&quot;"/><numFmt numFmtId="166" formatCode="dd/mm/yyyy"/><numFmt numFmtId="167" formatCode="0.0%"/><numFmt numFmtId="168" formatCode="0.000000"/></numFmts>'+
'<fonts count="5"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font><font><b/><sz val="14"/><name val="Arial"/></font><font><i/><sz val="9"/><color rgb="FF6B7280"/><name val="Arial"/></font></fonts>'+
'<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F2937"/><bgColor indexed="64"/></patternFill></fill></fills>'+
'<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'+
'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
'<cellXfs count="15">'+
'<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'+
'<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>'+
'<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'+
'<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'+
'<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'+
'<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>'+
'<xf numFmtId="167" fontId="2" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>'+
'<xf numFmtId="166" fontId="2" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>'+
'<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>'+
'<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>'+
'<xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'+
'<xf numFmtId="165" fontId="2" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>'+
'<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'+
'<xf numFmtId="168" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'+
'<xf numFmtId="1" fontId="2" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>'+
'</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  function sheetXml(sh){
    const out=[]; let nCols=1; for(const r of sh.rows) if(r.length>nCols) nCols=r.length;
    out.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">');
    out.push('<dimension ref="A1:'+col(nCols-1)+sh.rows.length+'"/>');
    out.push('<sheetViews><sheetView workbookViewId="0">');
    if(sh.freeze){ const fr=sh.freeze[0], fc=sh.freeze[1]; out.push('<pane '+(fc?'xSplit="'+fc+'" ':'')+(fr?'ySplit="'+fr+'" ':'')+'topLeftCell="'+col(fc)+(fr+1)+'" activePane="'+(fr&&fc?'bottomRight':fr?'bottomLeft':'topRight')+'" state="frozen"/>'); }
    out.push('</sheetView></sheetViews><sheetFormatPr defaultRowHeight="13"/>');
    if(sh.widths){ out.push('<cols>'); sh.widths.forEach((w,i)=>out.push('<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>')); out.push('</cols>'); }
    out.push('<sheetData>');
    sh.rows.forEach((row,ri)=>{
      const r=ri+1; const cells=[];
      row.forEach((c,ci)=>{
        if(c===null||c===undefined||c==='') return;
        let v=c,s=(sh.colStyles&&ri>0)?(sh.colStyles[ci]||0):0,f=null;
        if(typeof c==='object'){ v=c.v; if(c.s!==undefined) s=c.s; f=c.f||null; }
        if(ri===0 && sh.header) s=ST.head;
        const ref=col(ci)+r;
        if(f){ let vv=''; let t=''; if(typeof v==='number'&&isFinite(v)) vv='<v>'+v+'</v>'; else if(typeof v==='string'){ t=' t="str"'; vv='<v>'+esc(v)+'</v>'; } cells.push('<c r="'+ref+'" s="'+s+'"'+t+'><f>'+esc(f)+'</f>'+vv+'</c>'); return; }
        if(typeof v==='number' && isFinite(v)) cells.push('<c r="'+ref+'" s="'+s+'"><v>'+v+'</v></c>');
        else if(v!==null && v!==undefined && v!=='') cells.push('<c r="'+ref+'" s="'+s+'" t="inlineStr"><is><t xml:space="preserve">'+esc(v)+'</t></is></c>');
      });
      out.push('<row r="'+r+'"'+(ri===0&&sh.header?' ht="30" customHeight="1"':'')+'>'+cells.join('')+'</row>');
    });
    out.push('</sheetData>');
    if(sh.autoFilter) out.push('<autoFilter ref="A1:'+col(nCols-1)+sh.rows.length+'"/>');
    out.push('<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>');
    return out.join('');
  }
  function build(sheets){
    const files=[];
    files.push({name:'[Content_Types].xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+sheets.map((s,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>'});
    files.push({name:'_rels/.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'});
    const dn=sheets.map((s,i)=>{ if(!s.autoFilter) return ''; let nc=1; for(const r of s.rows) if(r.length>nc) nc=r.length; return '<definedName name="_xlnm._FilterDatabase" localSheetId="'+i+'" hidden="1">\''+s.name+'\'!$A$1:$'+col(nc-1)+'$'+s.rows.length+'</definedName>'; }).join('');
    files.push({name:'xl/workbook.xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>'+sheets.map((s,i)=>'<sheet name="'+esc(s.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets>'+(dn?'<definedNames>'+dn+'</definedNames>':'')+'<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>'});
    files.push({name:'xl/_rels/workbook.xml.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map((s,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'<Relationship Id="rId'+(sheets.length+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'});
    files.push({name:'xl/styles.xml',data:styles});
    sheets.forEach((s,i)=>files.push({name:'xl/worksheets/sheet'+(i+1)+'.xml',data:sheetXml(s)}));
    return zip(files);
  }
  return {build, serial, col, ST};
})();
```

### B. Compressão (`XW.deflateZip`)

Recompacta o ZIP gerado pelo writer com deflate nativo do navegador. Reduz o arquivo de cerca de 22 MB para 2,6 MB.

```js
window.XW.deflateZip = async function(storedBlob){
  const buf=new Uint8Array(await storedBlob.arrayBuffer()); const dv=new DataView(buf.buffer);
  const entries=[]; let p=0;
  while(dv.getUint32(p,true)===0x04034b50){
    const crc=dv.getUint32(p+14,true), size=dv.getUint32(p+22,true), nl=dv.getUint16(p+26,true), xl=dv.getUint16(p+28,true);
    const name=buf.slice(p+30,p+30+nl), data=buf.slice(p+30+nl+xl,p+30+nl+xl+size);
    entries.push({crc,size,name,data}); p+=30+nl+xl+size;
  }
  const parts=[], central=[]; let off=0;
  for(const e of entries){
    const cs=new Blob([e.data]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const comp=new Uint8Array(await new Response(cs).arrayBuffer());
    const h=new DataView(new ArrayBuffer(30));
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,8,true);h.setUint16(10,0,true);h.setUint16(12,0x21,true);
    h.setUint32(14,e.crc,true);h.setUint32(18,comp.length,true);h.setUint32(22,e.size,true);h.setUint16(26,e.name.length,true);h.setUint16(28,0,true);
    parts.push(new Uint8Array(h.buffer),e.name,comp);
    const c=new DataView(new ArrayBuffer(46));
    c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(10,8,true);c.setUint16(12,0,true);c.setUint16(14,0x21,true);
    c.setUint32(16,e.crc,true);c.setUint32(20,comp.length,true);c.setUint32(24,e.size,true);c.setUint16(28,e.name.length,true);
    c.setUint16(30,0,true);c.setUint16(32,0,true);c.setUint16(34,0,true);c.setUint16(36,0,true);c.setUint32(38,0,true);c.setUint32(42,off,true);
    central.push(new Uint8Array(c.buffer),e.name);
    off+=30+e.name.length+comp.length;
  }
  const csize=central.reduce((a,b)=>a+b.length,0);
  const end=new DataView(new ArrayBuffer(22));
  end.setUint32(0,0x06054b50,true);end.setUint16(8,entries.length,true);end.setUint16(10,entries.length,true);end.setUint32(12,csize,true);end.setUint32(16,off,true);
  return new Blob([...parts,...central,new Uint8Array(end.buffer)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
};
```

### C. Nutrição por linha e por pedido

Depende de `__catMap` e `__nut` (passo 5).

```js
window.__nutLine = function(L, d, p){
  const norm=s=>(s||'').replace(/\s+/g,' ').trim();
  const vert=(d.store_type||L.calculated_store_type||'');
  const isRest=/restaurant/.test(vert)||/restaurant/.test(L.store_type_store||'');
  const key=norm(p.name).toLowerCase()+(isRest?'|'+norm(p.description).toLowerCase().slice(0,60):'');
  const c=window.__catMap&&window.__catMap.get(key); const v=c?window.__nut[c.id]:undefined;
  if(v===undefined) return {food:null};
  if(!Array.isArray(v)) return {food:false};
  const g=v[1], k=v[2], pr=v[3], cb=v[4], ft=v[5], conf=v[6];
  const u=+p.units||0, up=+p.unit_price||0, tp=+p.total_price||0;
  const pg=/(\d+(?:[.,]\d+)?)\s*Gramas/i.exec(p.presentation||'');
  let grams, basis;
  if(pg){ grams=parseFloat(pg[1].replace(',','.')); basis='Peso na apresentação'; }
  else if(u&&up&&tp&&tp/(u*up)<0.9){ grams=tp/up*1000; basis='Peso cobrado (preço/kg)'; }
  else { grams=u*g; basis='Unidades × tamanho estimado'; }
  const f=grams/100;
  return {food:true, grams:Math.round(grams), kcal:k*f, p:pr*f, c:cb*f, f:ft*f, conf, basis};
};
window.__aggNut = function(o, nu){
  if(o.kcal===undefined){ o.kcal=null; o.np=null; o.nc=null; o.nf=null; o.nconfW=0; o.nconfS=0; o.nconfN=0; o.foodLines=0; }
  if(!nu||!nu.food) return;
  o.kcal=(o.kcal||0)+nu.kcal; o.np=(o.np||0)+nu.p; o.nc=(o.nc||0)+nu.c; o.nf=(o.nf||0)+nu.f;
  o.nconfW+=nu.kcal*nu.conf; o.nconfS+=nu.conf; o.nconfN++; o.foodLines++;
};
window.__nutCols = function(o){
  if(!o.foodLines) return [null,null,null,null,null,null,null,null,0];
  const mk=4*o.np+4*o.nc+9*o.nf;
  const conf = o.kcal>0 ? o.nconfW/o.kcal : o.nconfS/o.nconfN;
  const r1=x=>Math.round(x*10)/10;
  return [Math.round(o.kcal), r1(o.np), r1(o.nc), r1(o.nf), mk>0?Math.round(400*o.np/mk):null, mk>0?Math.round(400*o.nc/mk):null, mk>0?Math.round(900*o.nf/mk):null, Math.round(conf), o.foodLines];
};
```

### D. Montagem das abas (`buildRappi`)

Normaliza pedidos e itens, calcula agregados e gera as 5 abas. Usa `__totalReported` e `__extraIds` nas notas.

```js
window.buildRappi = function(list, detMap, today){
  const XW=window.XW, S=XW.ST;
  const num=v=>{ if(v===null||v===undefined||v==='') return null; const n=parseFloat(String(v).replace(',','.')); return isFinite(n)?n:null; };
  const r2=n=>Math.round(n*100)/100;
  const DOW=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const STATUS={pending_review:'Entregue',finished:'Entregue',canceled:'Cancelado',canceled_by_automation:'Cancelado (automação)',canceled_by_fraud:'Cancelado (antifraude)',canceled_by_early_regret:'Cancelado (arrependimento)'};
  const stLabel=s=>STATUS[s]||(/cancel/.test(s||'')?'Cancelado':(s||''));
  const TYPE={express:'Turbo',market:'Mercado',express_picker:'Express (lojas)',restaurant:'Restaurante',restaurant_tablet:'Restaurante',marketplace:'Restaurante (marketplace)',courier:'Rappi Entrega (courier)',whim:'Rappi Favor',rappi_prime:'Assinatura Rappi Prime',express_tablet:'Express (tablet)'};
  const VEH={motorbike:'Moto',bicycle:'Bicicleta',car:'Carro',walk:'A pé',scooter:'Patinete'};
  const hav=(a,b,c,d)=>{ if([a,b,c,d].some(x=>x===null)) return null; const R=6371,p1=a*Math.PI/180,p2=c*Math.PI/180,dp=p2-p1,dl=(d-b)*Math.PI/180; const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2; return r2(2*R*Math.asin(Math.sqrt(h))); };
  const dow=s=>{ const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(s); return DOW[new Date(Date.UTC(+m[1],+m[2]-1,+m[3])).getUTCDay()]; };

  // ---- normalize orders
  const orders=[], items=[];
  const seen=new Set();
  for(const L of list){
    if(seen.has(L.id)) continue; seen.add(L.id);
    let d=null; try{ d=detMap[L.id]?JSON.parse(detMap[L.id]):null }catch(e){ d=null }
    const tot={}; ((d&&d.totals)||[]).forEach(t=>{ const kk=/^Desconto para o/.test(t.description)?'MPG':t.description; tot[kk]=(tot[kk]||0)+(num(t.value)||0); });
    const created=(d&&d.created_at)||L.created_at;
    const arrive=((d&&d.order_modifications)||[]).filter(m=>m.type==='arrive').map(m=>m.created_at).sort()[0]||null;
    const state=(d&&d.state)||L.status;
    const cS=XW.serial(created), aS=arrive?XW.serial(arrive):null;
    const mins=(aS!==null&&cS!==null)?Math.round((aS-cS)*1440):null;
    const st=(d&&d.store)||{}, ad=(d&&d.address)||{}, sk=(d&&d.storekeeper)||{}, cc=(d&&d.cc_data)||{};
    const prods=(d&&d.products)||[];
    const units=prods.reduce((a,p)=>a+(num(p.units)||0),0);
    const vert=TYPE[L.calculated_store_type]||TYPE[(d&&d.store_type)]||TYPE[L.store_type_store]||(L.calculated_store_type||(d&&d.store_type)||'');
    const whims=((d&&d.whims)||[]).map(w=>typeof w==='object'?((w.name||'')+(w.price?` (R$ ${w.price})`:'')):String(w)).join(' | ');
    const o={
      id:L.id, created, cS, aS, mins, year:+created.slice(0,4), month:created.slice(0,7), dow:dow(created), hour:+created.slice(11,13),
      status:stLabel(state), state, storeName:st.name||'', brand:(L.store_brand||'').trim(), storeId:num(st.store_id), slug:L.store_type_store||st.type||'', vert,
      storeAddr:st.address||'', slat:num(st.lat), slng:num(st.lng), dist:hav(num(st.lat),num(st.lng),num(ad.lat),num(ad.lng)),
      addrTag:ad.tag||'', addrName:ad.name||'', addrDesc:(ad.description&&ad.description!=='Brazil')?ad.description:'', alat:num(ad.lat), alng:num(ad.lng),
      pay:(d&&d.payment_method)==='cc'?'Cartão de crédito':((d&&d.payment_method)||''), card:cc.card_type?cc.card_type.charAt(0).toUpperCase()+cc.card_type.slice(1):'', last4:cc.last_four_digits||'', gateway:cc.gateway_type||'', coupon:(d&&d.coupon_code)||'',
      prod:tot['Custo dos produtos'], fees:tot['Custo total'], disc:tot['Descontos totais'], credits:tot['Créditos utilizados'], added:tot['Preço dos produtos adicionados'], mpg:tot['MPG'], tip:tot['Gorjeta'], total:tot['Total'], diff:(d&&tot['Total']!==undefined)?r2(tot['Total']-((tot['Custo dos produtos']||0)+(tot['Custo total']||0)-(tot['Descontos totais']||0)-(tot['Créditos utilizados']||0)-(tot['MPG']||0)+(tot['Gorjeta']||0)+(tot['Preço dos produtos adicionados']||0))):null,
      nProd:prods.length, units, whims, skId:num(sk.id), sk:sk.full_name||'', veh:VEH[sk.transport_media_type]||sk.transport_media_type||'', skRate:num(sk.rate), rate:num(d&&d.rate)||null,
      hasDet: d?'Sim':'Não'
    };
    if(!o.storeName) o.storeName=o.brand;
    orders.push(o);
    for(const p of prods){
      const nu=window.__nutLine(L,d,p); window.__aggNut(o,nu); items.push({nu, id:o.id, cS:o.cS, year:o.year, month:o.month, status:o.status, store:o.storeName, vert:o.vert, pid:String(p.product_id||''), name:(p.name||'').trim(), pres:p.presentation||'', units:num(p.units), unit:num(p.unit_price), total:num(p.total_price),
        tops:(p.toppings||[]).map(t=>typeof t==='object'?(t.description||t.name||JSON.stringify(t)):String(t)).join(' | '), comm:p.comments||'', desc:(p.description||'').replace(/\s+/g,' ').trim()});
    }
  }
  orders.sort((a,b)=>b.created.localeCompare(a.created));
  const byId=new Map(orders.map((o,i)=>[o.id,i]));
  items.sort((a,b)=>byId.get(a.id)-byId.get(b.id));
  const isD=o=>o.status==='Entregue';

  // ---- Pedidos sheet
  const PH=['ID pedido','Criado em','Chegou em','Tempo entrega (min)','Ano','Mês','Dia semana','Hora','Status','Status API','Loja','Marca','Loja ID','Rede (slug)','Tipo loja','Endereço loja','Lat loja','Lng loja','Distância loja→entrega (km, linha reta)','Endereço entrega (apelido)','Endereço entrega','Complemento','Lat entrega','Lng entrega','Pagamento','Bandeira','Cartão final','Gateway','Cupom','Produtos (R$)','Taxas entrega/serviço (R$)','Descontos (R$)','Créditos Rappi (R$)','Produtos adicionados (R$)','Desconto mesmo preço garantido (R$)','Gorjeta (R$)','Total pago (R$)','Diferença não detalhada (R$)','Linhas de produto','Unidades','Pedidos especiais (whims)','Entregador ID','Entregador','Veículo','Nota entregador (API)','Avaliação dada','Comprovante disponível','Calorias estimadas (kcal)','Proteínas (g)','Carboidratos (g)','Gorduras (g)','% kcal proteínas','% kcal carboidratos','% kcal gorduras','Confiança da estimativa (%)','Linhas de alimento'];
  const prow=o=>[o.id,o.cS,o.aS,o.mins,o.year,o.month,o.dow,o.hour,o.status,o.state,o.storeName,o.brand,o.storeId,o.slug,o.vert,o.storeAddr,o.slat,o.slng,o.dist,o.addrTag,o.addrName,o.addrDesc,o.alat,o.alng,o.pay,o.card,o.last4?{v:o.last4,s:S.text}:null,o.gateway,o.coupon,o.prod,o.fees,o.disc,o.credits,o.added,o.mpg,o.tip,o.total,(o.diff&&Math.abs(o.diff)>=0.05)?o.diff:(o.diff===null?null:0),o.nProd,o.units,o.whims,o.skId,o.sk,o.veh,o.skRate,o.rate,o.hasDet,...window.__nutCols(o)];
  const pSheet={name:'Pedidos',header:true,autoFilter:true,freeze:[1,2],rows:[PH,...orders.map(prow)],
    colStyles:[S.int,S.dt,S.dt,S.int,S.int,0,0,S.int,0,0,0,0,S.int,0,0,0,S.coord,S.coord,S.dec,0,0,0,S.coord,S.coord,0,0,S.text,0,0,S.brl,S.brl,S.brl,S.brl,S.brl,S.brl,S.brl,S.brl,S.brl,S.int,S.int,0,S.int,0,0,S.int,S.int,0,S.int,S.dec,S.dec,S.dec,S.int,S.int,S.int,S.int,S.int],
    widths:[12,15,15,10,6,9,7,6,12,16,32,18,11,20,15,40,11,11,12,18,34,16,11,11,15,9,8,10,14,12,12,12,12,12,12,11,12,12,9,9,30,11,28,10,9,9,11,12,10,11,10,9,9,9,11,9]};
  const n=orders.length+1;
  const C=(letter)=>`Pedidos!$${letter}$2:$${letter}$${n}`; // column refs
  // column letters (must match PH order)
  const L=Object.fromEntries(PH.map((h,i)=>[h,XW.col(i)]));
  const cStatus=C(L['Status']), cTotal=C(L['Total pago (R$)']), cProd=C(L['Produtos (R$)']), cFees=C(L['Taxas entrega/serviço (R$)']), cDisc=C(L['Descontos (R$)']), cCred=C(L['Créditos Rappi (R$)']), cTip=C(L['Gorjeta (R$)']), cMins=C(L['Tempo entrega (min)']), cUnits=C(L['Unidades']), cYear=C(L['Ano']), cVert=C(L['Tipo loja']), cId=C(L['ID pedido']), cCreated=C(L['Criado em']);

  // ---- Itens sheet
  const IH=['ID pedido','Data pedido','Ano','Mês','Status pedido','Loja','Tipo loja','Product ID (loja_produto)','Produto','Apresentação','Unidades','Preço unitário (R$)','Total linha (R$)','Complementos / opções','Observação','Descrição do produto','Alimento?','Quantidade estimada (g ou ml)','Base da quantidade','Calorias (kcal)','Proteínas (g)','Carboidratos (g)','Gorduras (g)','Confiança (%)'];
  const iSheet={name:'Itens',header:true,autoFilter:true,freeze:[1,1],rows:[IH,...items.map(x=>[x.id,x.cS,x.year,x.month,x.status,x.store,x.vert,{v:x.pid,s:S.text},x.name,x.pres,x.units,x.unit,x.total,x.tops,x.comm,x.desc,x.nu.food===true?'Sim':(x.nu.food===false?'Não':''),x.nu.food?x.nu.grams:null,x.nu.food?x.nu.basis:null,x.nu.food?Math.round(x.nu.kcal):null,x.nu.food?Math.round(x.nu.p*10)/10:null,x.nu.food?Math.round(x.nu.c*10)/10:null,x.nu.food?Math.round(x.nu.f*10)/10:null,x.nu.food?x.nu.conf:null])],
    colStyles:[S.int,S.dt,S.int,0,0,0,0,S.text,0,0,S.int,S.brl,S.brl,0,0,0,0,S.int,0,S.int,S.dec,S.dec,S.dec,S.int], widths:[12,15,6,9,12,30,15,22,55,14,9,12,12,40,20,60,9,11,22,10,10,11,10,10]};

  // ---- Produtos (static aggregate, delivered only)
  const pm=new Map();
  for(const x of items){ if(x.status!=='Entregue') continue; const k=x.name.toLowerCase(); let a=pm.get(k); if(!a){a={name:x.name,orders:new Set(),units:0,spend:0,prices:[],first:x.cS,last:x.cS,stores:new Set(),vert:new Set()}; pm.set(k,a);} a.orders.add(x.id); a.units+=x.units||0; a.spend+=x.total||0; if(x.unit) a.prices.push(x.unit); if(x.cS<a.first)a.first=x.cS; if(x.cS>a.last)a.last=x.cS; a.stores.add(x.store); a.vert.add(x.vert); }
  const prodAgg=[...pm.values()].sort((a,b)=>b.spend-a.spend);
  const prSheet={name:'Produtos',header:true,autoFilter:true,freeze:[1,1],rows:[['Produto','Pedidos','Unidades','Gasto total (R$)','Preço unit. médio (R$)','Preço unit. mín (R$)','Preço unit. máx (R$)','Primeira compra','Última compra','Nº lojas','Tipo(s) de loja'],
    ...prodAgg.map(a=>[a.name,a.orders.size,a.units,r2(a.spend),a.prices.length?r2(a.prices.reduce((x,y)=>x+y,0)/a.prices.length):null,a.prices.length?Math.min(...a.prices):null,a.prices.length?Math.max(...a.prices):null,a.first,a.last,a.stores.size,[...a.vert].join(', ')])],
    colStyles:[0,S.int,S.int,S.brl,S.brl,S.brl,S.brl,S.dt,S.dt,S.int,0], widths:[58,9,9,14,13,13,13,15,15,8,22]};

  // ---- Lojas (static aggregate)
  const sm=new Map();
  for(const o of orders){ const k=o.storeName+'|'+(o.storeId||''); let a=sm.get(k); if(!a){a={name:o.storeName,id:o.storeId,brand:o.brand,vert:o.vert,addr:o.storeAddr,del:0,can:0,total:0,fees:0,tips:0,disc:0,mins:[],first:o.cS,last:o.cS}; sm.set(k,a);} if(isD(o)){a.del++; a.total+=o.total||0; a.fees+=o.fees||0; a.tips+=o.tip||0; a.disc+=o.disc||0; if(o.mins!==null&&o.mins>=0&&o.mins<=180) a.mins.push(o.mins);} else a.can++; if(o.cS<a.first)a.first=o.cS; if(o.cS>a.last)a.last=o.cS; }
  const storeAgg=[...sm.values()].sort((a,b)=>b.total-a.total||b.del-a.del);
  const lSheet={name:'Lojas',header:true,autoFilter:true,freeze:[1,1],rows:[['Loja','Loja ID','Marca','Tipo loja','Endereço','Pedidos entregues','Cancelados','Total pago (R$)','Ticket médio (R$)','Taxas (R$)','Descontos (R$)','Gorjetas (R$)','Tempo médio entrega (min, ≤3h)','Primeiro pedido','Último pedido'],
    ...storeAgg.map(a=>[a.name,a.id,a.brand,a.vert,a.addr,a.del,a.can,r2(a.total),a.del?r2(a.total/a.del):null,r2(a.fees),r2(a.disc),r2(a.tips),a.mins.length?Math.round(a.mins.reduce((x,y)=>x+y,0)/a.mins.length):null,a.first,a.last])],
    colStyles:[0,S.int,0,0,0,S.int,S.int,S.brl,S.brl,S.brl,S.brl,S.brl,S.int,S.dt,S.dt], widths:[34,11,18,15,40,10,10,14,13,12,12,12,12,15,15]};

  // ---- Resumo (formulas + cached values)
  const D=orders.filter(isD); const sum=(arr,k)=>r2(arr.reduce((a,o)=>a+(o[k]||0),0));
  const minsOk=D.filter(o=>o.mins!==null&&o.mins<=180&&o.mins>=0);
  const R=[]; const push=r=>R.push(r);
  push([{v:'Pedidos Rappi · histórico completo',s:S.title}]);
  push([{v:`Extraído de rappi.com.br em ${today} (API de pedidos recentes do suporte + comprovante de cada pedido). Valores de gasto consideram só pedidos entregues.`,s:S.note}]);
  push([{v:'Indicador',s:S.head},{v:'Valor',s:S.head}]);
  const kStart=R.length+1; const k=(label,f,v,s)=>{ push([label,{f,v,s}]); return 'B'+R.length; };
  const kAll=k('Pedidos no histórico',`COUNTA(${cId})`,orders.length,S.boldint);
  const kDel=k('Entregues',`COUNTIF(${cStatus},"Entregue")`,D.length,S.boldint);
  k('Cancelados',`${kAll}-${kDel}`,orders.length-D.length,S.boldint);
  k('Primeiro pedido',`MIN(${cCreated})`,Math.min(...orders.map(o=>o.cS)),S.date);
  k('Último pedido',`MAX(${cCreated})`,Math.max(...orders.map(o=>o.cS)),S.date);
  const kTot=k('Total pago (entregues)',`SUMIFS(${cTotal},${cStatus},"Entregue")`,sum(D,'total'),S.boldbrl);
  const kProd=k('Produtos',`SUMIFS(${cProd},${cStatus},"Entregue")`,sum(D,'prod'),S.boldbrl);
  const kFees=k('Taxas entrega/serviço',`SUMIFS(${cFees},${cStatus},"Entregue")`,sum(D,'fees'),S.boldbrl);
  k('Descontos',`SUMIFS(${cDisc},${cStatus},"Entregue")`,sum(D,'disc'),S.boldbrl);
  k('Créditos Rappi',`SUMIFS(${cCred},${cStatus},"Entregue")`,sum(D,'credits'),S.boldbrl);
  k('Gorjetas',`SUMIFS(${cTip},${cStatus},"Entregue")`,sum(D,'tip'),S.boldbrl);
  k('Ticket médio',`IFERROR(${kTot}/${kDel},0)`,D.length?sum(D,'total')/D.length:0,S.boldbrl);
  k('Taxas como % dos produtos',`IFERROR(${kFees}/${kProd},0)`,sum(D,'prod')?sum(D,'fees')/sum(D,'prod'):0,S.pct);
  k('Tempo médio de entrega (min, excl. >3h)',`IFERROR(AVERAGEIFS(${cMins},${cStatus},"Entregue",${cMins},"<=180",${cMins},">=0"),"")`,minsOk.length?minsOk.reduce((a,o)=>a+o.mins,0)/minsOk.length:'',S.boldint);
  k('Unidades compradas',`SUMIFS(${cUnits},${cStatus},"Entregue")`,D.reduce((a,o)=>a+(o.units||0),0),S.boldint);
  { const cK=C(L['Calorias estimadas (kcal)']), cCf=C(L['Confiança da estimativa (%)']), cPp=C(L['Proteínas (g)']), cCc=C(L['Carboidratos (g)']), cFf=C(L['Gorduras (g)']); const DK=D.filter(o=>o.foodLines); const sk=DK.reduce((a,o)=>a+Math.round(o.kcal),0); const sp=DK.reduce((a,o)=>a+Math.round(o.np*10)/10,0), sc=DK.reduce((a,o)=>a+Math.round(o.nc*10)/10,0), sf=DK.reduce((a,o)=>a+Math.round(o.nf*10)/10,0); const mk=4*sp+4*sc+9*sf;
  const kK=k('Calorias estimadas, pedidos entregues (kcal)',`SUMIFS(${cK},${cStatus},"Entregue")`,sk,S.boldint);
  k('Pedidos entregues com alimentos',`COUNTIFS(${cStatus},"Entregue",${cK},">=0")`,DK.length,S.boldint);
  k('Média de kcal por pedido com alimentos',`IFERROR(${kK}/B${R.length},0)`,DK.length?sk/DK.length:0,S.boldint);
  k('% kcal de proteínas (entregues)',`IFERROR(4*SUMIFS(${cPp},${cStatus},"Entregue")/(4*SUMIFS(${cPp},${cStatus},"Entregue")+4*SUMIFS(${cCc},${cStatus},"Entregue")+9*SUMIFS(${cFf},${cStatus},"Entregue")),0)`,mk?4*sp/mk:0,S.pct);
  k('% kcal de carboidratos (entregues)',`IFERROR(4*SUMIFS(${cCc},${cStatus},"Entregue")/(4*SUMIFS(${cPp},${cStatus},"Entregue")+4*SUMIFS(${cCc},${cStatus},"Entregue")+9*SUMIFS(${cFf},${cStatus},"Entregue")),0)`,mk?4*sc/mk:0,S.pct);
  k('% kcal de gorduras (entregues)',`IFERROR(9*SUMIFS(${cFf},${cStatus},"Entregue")/(4*SUMIFS(${cPp},${cStatus},"Entregue")+4*SUMIFS(${cCc},${cStatus},"Entregue")+9*SUMIFS(${cFf},${cStatus},"Entregue")),0)`,mk?9*sf/mk:0,S.pct);
  k('Confiança média das estimativas (%, ponderada por kcal)',`IFERROR(SUMPRODUCT((${cStatus}="Entregue")*${cK}*${cCf})/${kK},0)`,sk?DK.reduce((a,o)=>a+Math.round(o.kcal)*Math.round(o.kcal>0?o.nconfW/o.kcal:o.nconfS/o.nconfN),0)/sk:0,S.boldint); }
  push([]);
  // by year
  const yH=R.length+1; push(['Ano','Pedidos entregues','Total pago (R$)','Ticket médio (R$)','Taxas (R$)','Gorjetas (R$)','Cancelados'].map(v=>({v,s:S.head})));
  const years=[...new Set(orders.map(o=>o.year))].sort();
  const y0=R.length+1;
  for(const y of years){ const r=R.length+1; const dy=D.filter(o=>o.year===y); const cy=orders.filter(o=>o.year===y&&!isD(o)).length;
    push([{v:y,s:S.boldint},{f:`COUNTIFS(${cYear},A${r},${cStatus},"Entregue")`,v:dy.length,s:S.int},{f:`SUMIFS(${cTotal},${cYear},A${r},${cStatus},"Entregue")`,v:sum(dy,'total'),s:S.brl},{f:`IFERROR(C${r}/B${r},0)`,v:dy.length?sum(dy,'total')/dy.length:0,s:S.brl},{f:`SUMIFS(${cFees},${cYear},A${r},${cStatus},"Entregue")`,v:sum(dy,'fees'),s:S.brl},{f:`SUMIFS(${cTip},${cYear},A${r},${cStatus},"Entregue")`,v:sum(dy,'tip'),s:S.brl},{f:`COUNTIFS(${cYear},A${r})-B${r}`,v:cy,s:S.int}]); }
  { const r=R.length+1, a=y0, b=r-1; push([{v:'Total',s:S.bold},{f:`SUM(B${a}:B${b})`,v:D.length,s:S.boldint},{f:`SUM(C${a}:C${b})`,v:sum(D,'total'),s:S.boldbrl},{f:`IFERROR(C${r}/B${r},0)`,v:D.length?sum(D,'total')/D.length:0,s:S.boldbrl},{f:`SUM(E${a}:E${b})`,v:sum(D,'fees'),s:S.boldbrl},{f:`SUM(F${a}:F${b})`,v:sum(D,'tip'),s:S.boldbrl},{f:`SUM(G${a}:G${b})`,v:orders.length-D.length,s:S.boldint}]); }
  push([]);
  // by vertical
  push(['Tipo loja','Pedidos entregues','Total pago (R$)','Ticket médio (R$)','% do gasto'].map(v=>({v,s:S.head})));
  const verts=[...new Set(orders.map(o=>o.vert))].sort((a,b)=>sum(D.filter(o=>o.vert===b),'total')-sum(D.filter(o=>o.vert===a),'total'));
  for(const vt of verts){ const r=R.length+1; const dv=D.filter(o=>o.vert===vt);
    push([vt,{f:`COUNTIFS(${cVert},A${r},${cStatus},"Entregue")`,v:dv.length,s:S.int},{f:`SUMIFS(${cTotal},${cVert},A${r},${cStatus},"Entregue")`,v:sum(dv,'total'),s:S.brl},{f:`IFERROR(C${r}/B${r},0)`,v:dv.length?sum(dv,'total')/dv.length:0,s:S.brl},{f:`IFERROR(C${r}/${kTot},0)`,v:sum(D,'total')?sum(dv,'total')/sum(D,'total'):0,s:S.pct}]); }
  push([]);
  const notes=['Notas',
    '• Entregue = status API pending_review ou finished. Cancelado inclui cancelamentos pelo usuário, automação e antifraude.',
    `• A API de pedidos recentes informa ${window.__totalReported||'?'} pedidos no total, mas só retorna ${orders.filter(o=>!(window.__extraIds||[]).includes(o.id)).length} na listagem; os demais não aparecem nela. Faltantes identificados pelo histórico do site (cancelamentos por arrependimento) foram incluídos.`,
    `• Comprovante (valores, itens, entregador) obtido para ${orders.filter(o=>o.hasDet==='Sim').length} de ${orders.length} pedidos. Sem comprovante, a linha traz só data, status e loja.`,
    '• Taxas = "Custo total" do comprovante (entrega + serviço somados). Total pago = valor final informado pela Rappi. Em pedidos antigos ele pode diferir de produtos + taxas − descontos − créditos + gorjeta (itens em falta, ajustes); a diferença fica na coluna "Diferença não detalhada".',
    '• Itens vendidos por peso: preço unitário é por kg/unidade de referência; o total da linha é o valor cobrado.',
    '• Abas Produtos e Lojas são agregados calculados na extração (só pedidos entregues nos valores). Tempo de entrega >3h costuma ser pedido agendado e fica fora das médias.',
    '• Distância = linha reta entre coordenadas da loja e do endereço de entrega.',
    '• Calorias e macronutrientes são ESTIMATIVAS feitas por IA a partir do nome de cada produto (e da descrição, em restaurantes): tamanho da embalagem × composição típica por 100 g. Não usam a tabela nutricional real do produto.',
    '• Quantidade: itens vendidos por peso usam o peso cobrado (valor pago ÷ preço por kg); os demais usam unidades × tamanho estimado da embalagem. Café, chá e caldos contam as calorias da bebida preparada; água e refrigerante zero contam 0 kcal.',
    '• Calorias somam o pedido inteiro (a casa toda), não uma refeição individual. Bebidas alcoólicas entram nas calorias, mas o álcool fica fora da divisão por macronutrientes.',
    '• Confiança (%) = certeza da estimativa de cada item (≈90 embalado com tamanho explícito; 45–65 prato de restaurante ou hortifruti; <45 nomes vagos). No pedido, é a média ponderada pelas calorias de cada item. Produtos não alimentares (limpeza, farmácia, pet) ficam fora.'];
  notes.forEach((t,i)=>push([{v:t,s:i?S.note:S.bold}]));
  const rSheet={name:'Resumo',rows:R,widths:[44,16,16,16,14,14,12]};

  return {sheets:[rSheet,pSheet,lSheet,prSheet,iSheet], stats:{orders:orders.length, delivered:D.length, items:items.length, products:prodAgg.length, stores:storeAgg.length, total:sum(D,'total'), withDet:orders.filter(o=>o.hasDet==='Sim').length}};
};
```
