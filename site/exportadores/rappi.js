/* eatIQ exportador 2.0.0 — GET apenas, sem dependências ou envio ao eatIQ.
   Cole na plataforma indicada. A sessão permanece somente na memória da aba. */
(() => {
  'use strict';
  const PLATFORM = 'rappi';
  const VERSION = '2.0.0';
  const host = PLATFORM === 'ifood' ? 'www.ifood.com.br' : 'www.rappi.com.br';
  if(location.hostname !== host) { alert('Abra https://' + host + (PLATFORM==='ifood'?'/pedidos':'/account/orders') + ' antes de executar.'); return; }
  if(window.__eatIQExporter) { window.__eatIQExporter.show(); return; }
  const sleep = ms => new Promise(r=>setTimeout(r,ms));
  const plain = x => x && typeof x === 'object' && !Array.isArray(x);
  const str = (x,max=1000) => typeof x==='string' ? x.slice(0,max) : '';
  const id = x => {if((typeof x!=='string'&&typeof x!=='number')||!String(x).trim())throw Error('Pedido sem identificador válido.');return String(x)};
  const number = (x,label) => { if(x===null||x===undefined||x==='')throw Error('Campo ausente: '+label);const n=Number(x);if(!Number.isFinite(n)||n<0)throw Error('Valor inválido: '+label);return n; };
  const date = x => {if(typeof x!=='string'||!Number.isFinite(Date.parse(x)))throw Error('Data de pedido inválida.');return x};
  const optional = x => x===null||x===undefined?null:Number.isFinite(Number(x))?Number(x):null;
  // IDs nunca passam por filtros de CPF. Observações livres de entrega não são exportadas.
  const product = (p,ifood=true,parentQty=1,sub=false) => {
    const qty=number(ifood?p.quantity:p.units,'quantidade')*parentQty;if(qty<=0)throw Error('Quantidade deve ser positiva.');
    const price=number(ifood?(p.totalPriceWithDiscount??p.totalPrice):p.total_price,'preço do item')/(ifood?100:1)*parentQty;
    return {nome:str(ifood?p.name:p.name,300),desc:str(p.description,2000),qty,preco:price,
      ...(sub?{sub:true}:{}),pres:ifood?'':str(p.presentation,200),
      weight:ifood&&plain(p.weight)?{value:optional(p.weight.value),unit:str(p.weight.unit,16)}:null,
      unitPrice:optional(ifood?(p.unitPriceWithDiscount??p.unitPrice):p.unit_price),
      options:ifood?[]:(p.toppings||[]).map(t=>str(typeof t==='string'?t:t?.description||t?.name,300)).filter(Boolean)};
  };
  function ifoodOrder(o){
    const ref=id(o.id),status=str(o.lastStatus,60),completed=status==='CONCLUDED';
    if(!completed)return {ref,status,criado_em:date(o.createdAt),loja:str(o.merchant?.name,200),complete:true};
    if(!Array.isArray(o.bag?.items)||!o.bag.items.length)throw Error('Pedido concluído sem itens.');
    const items=[];for(const p of o.bag.items){items.push(product(p));for(const s of p.subItems||[])items.push(product(s,true,number(p.quantity,'quantidade pai'),true))}
    const cents=x=>number(x,'valor monetário')/100;const bag=o.bag;
    const subtotal=cents(bag.subTotal?.value),discounted=cents(bag.subTotal?.valueWithDiscount??bag.subTotal?.value);
    const fee=cents(bag.deliveryFee?.valueWithDiscount??bag.deliveryFee?.value??0);
    const types={RESTAURANT:'Restaurante',MARKET:'Mercado',BEVERAGE:'Mercado',PHARMACY:'Farmácia',PET:'Pet'};
    const events=(o.deliveryOperation?.executions||[]).flatMap(e=>(e.timeline||[]).flatMap(t=>t.events||[])).filter(e=>e.value==='DELIVERY_COMPLETED'&&Number.isFinite(Date.parse(e.timestamp))).sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp));
    return {ref,status,complete:true,app:'iFood',criado_em:date(o.createdAt),loja:str(o.merchant?.name,200),tipo:types[o.merchant?.type]||'Outros',tipo_loja:str(o.merchant?.type,80),
      total:cents(o.payments?.total?.value??bag.total?.valueWithDiscount??bag.total?.value),produtos:subtotal,
      taxas:fee+(o.fees||[]).reduce((a,f)=>a+cents(f.amount?.value),0),desconto:Math.max(0,subtotal-discounted+cents(bag.deliveryFee?.value??0)-fee),gorjeta:0,
      minutos:events.length?Math.round((Date.parse(events.at(-1).timestamp)-Date.parse(o.createdAt))/60000):null,items};
  }
  function rappiOrder(d,L){
    if(id(d.order_id)!==id(L.id))throw Error('Comprovante não corresponde ao pedido solicitado.');
    const status=str(d.state||L.status,60),completed=['finished','pending_review'].includes(status);
    if(!completed)return {ref:id(L.id),status,criado_em:date(d.created_at||L.created_at),loja:str(d.store?.name||L.store_brand,200),complete:true};
    if(!Array.isArray(d.products)||!d.products.length)throw Error('Pedido entregue sem produtos.');
    const totals=new Map();for(const t of d.totals||[])totals.set(t.description,(totals.get(t.description)||0)+number(t.value,'total do comprovante'));
    const get=(k,required=false)=>totals.has(k)?totals.get(k):required?number(null,k):0;
    const type=L.calculated_store_type||d.store_type||L.store_type_store||'';
    return {ref:id(L.id),status,complete:true,app:'Rappi',criado_em:date(d.created_at||L.created_at),loja:str(d.store?.name||L.store_brand,200),tipo:/restaurant|marketplace/.test(type)?'Restaurante':/market|express/.test(type)?'Mercado':'Outros',tipo_loja:str(type,80),total:get('Total',true),produtos:get('Custo dos produtos',true),taxas:get('Custo total'),desconto:get('Descontos totais')+get('Créditos utilizados'),gorjeta:get('Gorjeta'),minutos:null,items:d.products.map(p=>product(p,false))};
  }
  const panel=document.createElement('div');panel.id='eatiq-export-panel';
  Object.assign(panel.style,{position:'fixed',right:'16px',bottom:'16px',width:'min(420px,calc(100vw - 32px))',zIndex:'2147483647',background:'#fff',color:'#182320',padding:'22px',border:'1px solid #ced9d2',borderRadius:'18px',boxShadow:'0 12px 50px #0003',font:'14px/1.5 system-ui'});
  const title=document.createElement('strong');title.textContent='eatIQ · Exportar '+(PLATFORM==='ifood'?'iFood':'Rappi');panel.append(title);
  const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');panel.append(status);
  const counters=document.createElement('p');panel.append(counters);
  const buttons=document.createElement('div');Object.assign(buttons.style,{display:'flex',gap:'8px',flexWrap:'wrap'});panel.append(buttons);
  function button(label,fn){const b=document.createElement('button');b.textContent=label;Object.assign(b.style,{padding:'8px 12px',border:'1px solid #bccbc1',borderRadius:'8px',background:'#f3f7f4',color:'#182320',cursor:'pointer'});b.onclick=fn;buttons.append(b);return b}
  let headers=null,path=null,account=null,busy=false,paused=false,controller=null,disposed=false;
  let state={schema:'eatiq-export',version:2,exporter:VERSION,platform:PLATFORM,account:null,page:0,list:[],orders:[],listingDone:false,supplementDone:PLATFORM==='ifood',reported:null,errors:[],exportedAt:null};
  const say=t=>{status.textContent=t; counters.textContent=state.list.length+' encontrados · '+state.orders.length+' processados · '+state.errors.length+' pendências';};
  const originalFetch=window.fetch,proto=XMLHttpRequest.prototype,originalOpen=proto.open,originalHeader=proto.setRequestHeader,originalSend=proto.send;
  const meta=new WeakMap();
  async function capture(url,h,method='GET'){
    if(disposed||method.toUpperCase()!=='GET')return;let u;try{u=new URL(url,location.href)}catch{return}
    const accepted=PLATFORM==='ifood'?u.origin===location.origin&&/^\/site-api\/v\d+\/customers\/me\/orders$/.test(u.pathname):u.origin==='https://v2.rappi.com.br'&&u.pathname==='/api/orders/history-user';
    if(!accepted)return;
    const hs=new Headers(h||{});const token=hs.get('authorization');if(!token)return;
    let identity=hs.get('x-ifood-user-id')||hs.get('account_id');
    if(!identity){try{const payload=token.replace(/^Bearer\s+/i,'').split('.')[1];const claims=JSON.parse(atob(payload.replace(/-/g,'+').replace(/_/g,'/')));identity=claims.sub||claims.user_id||claims.id}catch{}}
    if(!identity){say('Não foi possível identificar a conta para uma coleta segura. Nenhum pedido foi baixado.');return}
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(PLATFORM+':'+identity)))).map(x=>x.toString(16).padStart(2,'0')).join('');
    if(disposed)return;
    if(state.account&&state.account!==hash){paused=true;controller?.abort();headers=null;say('A conta mudou. Feche o exportador e comece novamente.');return}
    account=hash;state.account=hash;headers={};for(const [k,v] of hs)if(!/^(cookie|host|origin|referer|user-agent|connection|content-length|accept-encoding|sec-|sentry-|baggage)/i.test(k))headers[k]=v;
    path=u.pathname;if(!busy)say('Sessão identificada. Clique em Iniciar / continuar.');
  }
  function hookedFetch(input,init){let url=typeof input==='string'||input instanceof URL?String(input):input.url;capture(url,init?.headers||(typeof input==='object'?input.headers:null),init?.method||input?.method||'GET').catch(()=>{});return originalFetch.apply(this,arguments)}
  function hookedOpen(method,url){meta.set(this,{method,url,headers:{}});return originalOpen.apply(this,arguments)}
  function hookedHeader(k,v){const m=meta.get(this);if(m)m.headers[k]=v;return originalHeader.apply(this,arguments)}
  function hookedSend(){const m=meta.get(this);if(m)capture(m.url,m.headers,m.method).catch(()=>{});return originalSend.apply(this,arguments)}
  window.fetch=hookedFetch;proto.open=hookedOpen;proto.setRequestHeader=hookedHeader;proto.send=hookedSend;
  async function request(url){
    if(!headers)throw Error('Sessão não capturada. Abra a lista de pedidos nesta aba.');
    for(let attempt=0;attempt<4;attempt++){
      if(paused)throw Error('Pausado. Clique em Iniciar / continuar para retomar.');
      controller=new AbortController();const timer=setTimeout(()=>controller.abort(),25000);
      let r;try{r=await new Promise((resolve,reject)=>{const x=new XMLHttpRequest();originalOpen.call(x,'GET',url);x.withCredentials=PLATFORM==='ifood';for(const [k,v] of Object.entries(headers))originalHeader.call(x,k,v);const cancel=()=>x.abort();controller.signal.addEventListener('abort',cancel,{once:true});const clean=()=>controller?.signal.removeEventListener('abort',cancel);x.onload=()=>{clean();resolve({status:x.status,ok:x.status>=200&&x.status<300,headers:{get:k=>x.getResponseHeader(k)},json:async()=>JSON.parse(x.responseText)})};x.onerror=x.onabort=()=>{clean();reject(Error('Rede interrompida'))};originalSend.call(x);})}catch(e){if(paused)throw Error('Pausado.');if(attempt===3)throw Error('Falha de rede ou tempo esgotado. Retome para tentar novamente.');await sleep(1000*2**attempt);continue}finally{clearTimeout(timer)}
      if(r.status===401||r.status===403){headers=null;throw Error('Sessão recusada. Salve a retomada, faça login novamente e execute o exportador de novo.');}
      if(r.status===429||r.status>=500){if(attempt===3)throw Error('Servidor indisponível ou limite de chamadas. Retome mais tarde.');const retry=Number(r.headers.get('retry-after'));await sleep(Math.min(30000,Math.max(1000*2**attempt,Number.isFinite(retry)?retry*1000:0)));continue}
      if(!r.ok)throw Error('Resposta HTTP '+r.status+'. A coleta não foi marcada como concluída.');
      try{return await r.json()}catch{throw Error('Resposta inesperada: não é JSON. A coleta foi interrompida.')}
    }
  }
  function addList(lot){const seen=new Set(state.list.map(x=>x.id));let fresh=0;for(const x of lot){const ref=id(x.id);if(seen.has(ref))continue;seen.add(ref);state.list.push({id:ref,status:str(x.status||x.lastStatus,60),created_at:date(x.created_at||x.createdAt),store_brand:str(x.store_brand||x.merchant?.name,200),calculated_store_type:str(x.calculated_store_type,80),store_type_store:str(x.store_type_store,80)});fresh++}return fresh}
  async function collect(){
    if(busy)return;if(!headers){say('Abra Meus pedidos ou clique em Ver mais na plataforma. Sem esse botão, navegue para outra seção e volte sem recarregar a aba.');return}
    busy=true;paused=false;start.disabled=true;state.errors=[];
    try{
      while(!state.listingDone){
        if(state.page>=500)throw Error('Limite de 500 páginas atingido. Salve o resultado como parcial.');
        say('Buscando página '+(state.page+1)+'…');
        const url=PLATFORM==='ifood'?location.origin+path+'?page='+state.page+'&size=25':'https://services.rappi.com.br/api/support-order/latest-orders/'+state.page;
        const response=await request(url);const lot=PLATFORM==='ifood'?response:response?.recent_orders;
        if(!Array.isArray(lot))throw Error('Formato da lista mudou. Nenhuma conclusão foi presumida.');
        if(PLATFORM==='rappi'&&response.total_recent_orders!=null)state.reported=number(response.total_recent_orders,'total informado');
        if(!lot.length){state.listingDone=true;break}if(state.list.length+lot.length>10000)throw Error('Limite de 10.000 pedidos atingido. Salve os pedidos já coletados como parcial.');
        // Normalize an entire page before advancing its checkpoint.
        const normalized=PLATFORM==='ifood'?lot.map(ifoodOrder):null;
        if(!addList(lot))throw Error('O servidor repetiu uma página. Resultado parcial preservado.');
        if(normalized){const known=new Set(state.orders.map(x=>x.ref));for(const x of normalized)if(!known.has(x.ref))state.orders.push(x)}
        state.page++;await sleep(PLATFORM==='ifood'?500:900);
      }
      if(!state.supplementDone){say('Conferindo pedidos recentes da Rappi…');const extra=await request('https://v2.rappi.com.br/api/orders/history-user?page=1&per_page=100');if(!Array.isArray(extra?.data))throw Error('Formato inesperado do histórico recente.');addList(extra.data.map(x=>({...x,status:x.state,calculated_store_type:x.calculated_information?.store_type,store_brand:x.store?.name})));state.supplementDone=true}
      if(PLATFORM==='rappi'){
        const known=new Set(state.orders.map(x=>x.ref));for(const order of state.list){if(known.has(order.id))continue;say('Baixando comprovantes…');try{const raw=await request('https://services.rappi.com.br/order-resume/fully/'+encodeURIComponent(order.id));state.orders.push(rappiOrder(raw,order));known.add(order.id)}catch(e){state.errors.push({ref:order.id,message:e.message});throw e}await sleep(500)}
      }
      say(state.reported&&state.reported!==state.list.length?'Coleta encerrada, mas o total informado pela plataforma difere. O arquivo será identificado como parcial.':'Coleta encerrada. Confira o resumo e baixe o arquivo.');const summary=manifest();if(summary.from)counters.textContent+=' · Período: '+new Date(summary.from).toLocaleDateString('pt-BR')+' a '+new Date(summary.to).toLocaleDateString('pt-BR');
    }catch(e){if(!state.errors.length)state.errors.push({ref:null,message:e.message});say(e.message)}finally{busy=false;start.disabled=false;controller=null}
  }
  function manifest(){const complete=state.listingDone&&state.supplementDone&&state.list.length===state.orders.length&&!state.errors.length&&(!state.reported||state.reported===state.list.length);const dates=state.orders.map(x=>x.criado_em).sort((a,b)=>Date.parse(a)-Date.parse(b));return {complete,found:state.list.length,processed:state.orders.length,pending:state.list.length-state.orders.length,reported:state.reported,from:dates[0]||null,to:dates.at(-1)||null,scope:'Histórico retornado pelas APIs nesta coleta; não garante pedidos que a plataforma omite.',errors:state.errors}}
  function download(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}
  const start=button('Iniciar / continuar',collect);
  button('Pausar',()=>{paused=true;controller?.abort();say('Pausa solicitada. Os pedidos já processados ficam nesta aba.');});
  button('Baixar pedidos',()=>{if(busy){say('Pause e aguarde a requisição terminar antes de baixar.');return}const m=manifest();if(!state.orders.length){say('Nenhum pedido processado para exportar.');return}if(!m.complete&&!confirm('A coleta está parcial: '+m.processed+' de '+m.found+' pedidos processados. Baixar apenas estes pedidos?'))return;download({schema:'eatiq-export',version:2,exporter:VERSION,platform:PLATFORM,exportedAt:new Date().toISOString(),manifest:m,orders:state.orders},PLATFORM+'_eatiq_'+new Date().toISOString().slice(0,10)+(m.complete?'':'_PARCIAL')+'.json');say(m.processed+' pedidos no arquivo. '+(m.complete?'Coleta sem pendências detectadas.':'Arquivo PARCIAL: reimporte após completar a coleta.'));});
  button('Salvar retomada',()=>{if(busy){say('Pause e aguarde antes de salvar a retomada.');return}download({...state,checkpoint:true},PLATFORM+'_retomada.json')});
  const input=document.createElement('input');input.type='file';input.accept='.json';input.hidden=true;panel.append(input);
  button('Abrir retomada',()=>{if(busy||!account){say('Identifique a sessão e pause a coleta antes de abrir uma retomada.');return}input.click()});
  input.onchange=async()=>{try{const f=input.files[0];if(!f)return;if(f.size>30*1024*1024)throw Error('Arquivo maior que 30 MB.');const c=JSON.parse(await f.text());if(c.schema!=='eatiq-export'||c.version!==2||!c.checkpoint||c.platform!==PLATFORM||c.account!==account||!Array.isArray(c.orders)||!Array.isArray(c.list)||!Number.isInteger(c.page)||c.page<0||c.page>500)throw Error('Retomada inválida ou de outra conta/plataforma.');state=c;state.errors=[];say('Retomada carregada. Clique em Iniciar / continuar.')}catch(e){say(e.message)}finally{input.value=''}};
  button('Fechar',()=>{if(busy||state.orders.length){if(!confirm('Fechar descarta a coleta desta aba. Baixe os pedidos ou salve a retomada antes. Fechar?'))return}disposed=true;paused=true;controller?.abort();if(window.fetch===hookedFetch)window.fetch=originalFetch;if(proto.open===hookedOpen)proto.open=originalOpen;if(proto.setRequestHeader===hookedHeader)proto.setRequestHeader=originalHeader;if(proto.send===hookedSend)proto.send=originalSend;headers=null;account=null;panel.remove();delete window.__eatIQExporter});
  document.body.append(panel);window.__eatIQExporter={show:()=>{panel.style.display='block'}};
  say('Abra a lista de pedidos ou clique em Ver mais para identificar a sessão. Não recarregue esta aba durante a coleta.');
})();
