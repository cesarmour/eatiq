// eatIQ · motor de análise de pedidos. Roda no navegador do usuário.
// Entrada: arquivo exportado (JSON do iFood ou XLSX da Rappi). Saída: linhas em pedidos, itens e produtos, na conta do usuário.
window.EatIQEngine=(function(){
  let ING=[],PRATOS=[],NONFOOD=null;
  const MODEL_VERSION='2026-09-10.3';
  const ingByName=new Map();
  const norm=s=>(s||'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\blentinha\b/g,'lentilha').replace(/\s+/g,' ').trim();
  async function loadBase(api){const [i,p,c]=await Promise.all([api('/rest/v1/nutri_ingredientes?select=*'),api('/rest/v1/nutri_pratos?select=*&order=ordem.asc'),api('/rest/v1/nutri_config?select=*')]);
    if(!i.ok||!p.ok||!c.ok)throw new Error('base nutricional não encontrada. Rode o supabase-motor.sql');
    ingByName.clear();ING=(await i.json()).map(x=>({...x,re:new RegExp('\\b('+norm(x.palavras)+')','i')}));PRATOS=(await p.json()).map(x=>({...x,re:new RegExp('\\b(?:'+norm(x.padrao)+')','i')}));const cfg=await c.json();const nf=cfg.find(x=>x.chave==='nao_alimento');NONFOOD=new RegExp('\\b(?:'+norm(nf?nf.valor:'racao|shampoo')+')','i');return {ingredientes:ING.length,pratos:PRATOS.length}}
  const ing=n=>{if(!ingByName.has(n))ingByName.set(n,ING.find(x=>x.nome===n));return ingByName.get(n)};
  // Match complete words and discard overlapping, less-specific aliases.
  function mentions(text){
    const found=[];
    for(const x of ING){
      if(x.nome==='refrigerante zero'&&!/\b(refrigerante|coca|pepsi|guarana|fanta|sprite|soda)\b/.test(text))continue;
      const re=new RegExp('\\b(?:'+norm(x.palavras)+')(?=$|[^a-z0-9])','gi');let m;
      while((m=re.exec(text))){if(!m[0]){re.lastIndex++;continue}found.push({it:x,start:m.index,end:re.lastIndex,length:m[0].length})}
    }
    found.sort((a,b)=>b.length-a.length||Number(!!b.it.versao_base)-Number(!!a.it.versao_base));const selected=[];
    for(const m of found)if(!selected.some(x=>m.start<x.end&&m.end>x.start))selected.push(m);
    const zero=selected.some(x=>x.it.nome==='refrigerante zero');return selected.filter(x=>!zero||x.it.nome!=='refrigerante').sort((a,b)=>a.start-b.start);
  }
  function bestIng(text){const all=mentions(text);const zero=all.find(x=>x.it.nome==='refrigerante zero');if(zero)return zero.it;return all.sort((a,b)=>b.length-a.length)[0]?.it||null}
  const DEFAULT_G={molho:25,gordura:10,bebida:350,doce:100,laticinio:30,vegetal:80,fruta:120,carbo:150,proteina:150,leguminosa:100};
  function evidence(text){
    const excluded=new Set();
    const positive=text.replace(/\b(?:sem|retirar|retire|nao incluir)\s+([^,;.]+?)(?=\s+(?:com|mais|e com)\b|[,;.]|$)/g,(_,part)=>{mentions(part).forEach(x=>excluded.add(x.it.nome));return ' '});
    const seen=new Set();const parts=[];
    for(const m of mentions(positive)){
      if(excluded.has(m.it.nome)||seen.has(m.it.nome))continue;seen.add(m.it.nome);
      // A weight belongs to the adjacent ingredient, never to the entire dish.
      const after=positive.slice(m.end).match(/^\s*(?:de\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g|gr|grs|gramas)\b/);
      const before=positive.slice(0,m.start).match(/(\d+(?:[.,]\d+)?)\s*(kg|g|gr|grs|gramas)\s*(?:de\s*)?$/);
      const w=after||before;
      parts.push({ing:m.it.nome,g:w?+w[1].replace(',','.')*(w[2]==='kg'?1000:1):(DEFAULT_G[m.it.categoria]||150),explicit:!!w});
    }
    return {parts,excluded};
  }
  function nutrition(comp,qty,prato,conf,nivel){
    const t=sumComp(comp,qty);
    return {alimento:true,gramas:Math.round(t.g),kcal:Math.round(t.kcal),p:t.p,c:t.c,f:t.f,conf,nivel,prato,used:t.used};
  }
  // tamanho declarado no nome: "500ml", "2L", "1kg", "350 g", "6x350ml"
  function sizeFrom(name){const n=norm(name);const pk=n.match(/(\d+)\s*(?:x|un|unidades)\s*(?:de\s*)?\d/);const mul=pk?+pk[1]:1;let m=n.match(/(\d+(?:[.,]\d+)?)\s*(kg|quilo|quilos)\b/);if(m)return +m[1].replace(',','.')*1000*mul;m=n.match(/(\d+(?:[.,]\d+)?)\s*(l|lt|litro|litros)\b/);if(m)return +m[1].replace(',','.')*1000*mul;m=n.match(/(\d+(?:[.,]\d+)?)\s*(g|gr|gramas|ml)\b/);if(m)return +m[1].replace(',','.')*mul;return null}
  function mult(name){const n=norm(name);let k=1;if(/\b(meia|metade|1\/2|half)\b/.test(n))k*=0.5;if(/\b(grande|big|gg)\b/.test(n))k*=1.25;if(/\b(family|familia|para 4|4 pessoas|serve 4)\b/.test(n))k*=3;else if(/\b(para 2|2 pessoas|serve 2|casal|dupla)\b/.test(n))k*=2;if(/\b(pequen[oa]|mini|kids|junior|p\b)/.test(n))k*=0.7;const lv=n.match(/leve\s*(\d)/);if(lv)k*=+lv[1];const pc=n.match(/(\d+)\s*(pecas|peca|pcs|unidades|unid|un|uni|x)\b/)||n.match(/\b(\d+)\s*(esfihas|kibes|pasteis|empanadas|coxinhas|espetos|guiozas|brigadeiros|salgados|fatias|pedacos)\b/);return {k,pecas:pc?+pc[1]:null}}
  function sumComp(comp,scale){let g=0,kcal=0,p=0,c=0,f=0;const used=[];for(const x of comp){const it=ing(x.ing);if(!it)continue;const gr=x.g*scale;g+=gr;kcal+=it.kcal*gr/100;p+=it.prot*gr/100;c+=it.carb*gr/100;f+=it.gord*gr/100;used.push({ing:x.ing,g:Math.round(gr*10)/10,fonte:it.fonte||'base aproximada anterior',fonte_id:it.fonte_id||null,evidencia:x.explicit?'peso informado':x.named?'ingrediente informado':'composição presumida'})}return {g,kcal,p,c,f,used}}
  // estima um item. tipo: 'restaurante' | 'mercado'
  function estimate(name,desc,qty,tipo,ctx){qty=+qty||1;
    // nomes compostos: "2 fatias + suco (300ml)" -> soma das partes
    if(/\s\+\s|\s&\s/.test(name||'')&&!(ctx&&ctx.noSplit)){const parts=String(name).split(/\s\+\s|\s&\s/).map(x=>x.trim()).filter(Boolean);if(parts.length>1){let es=parts.map(pn=>estimate(pn,'',qty,tipo,{...(ctx||{}),noSplit:true}));const sum=(k)=>es.reduce((a,e)=>a+e[k],0);const kc=sum('kcal')||1;return {alimento:es.some(e=>e.alimento),gramas:sum('gramas'),kcal:sum('kcal'),p:sum('p'),c:sum('c'),f:sum('f'),conf:Math.round(es.reduce((a,e)=>a+e.conf*e.kcal,0)/kc),prato:es.map(e=>e.prato).join(' + '),used:es.flatMap(e=>e.used)}}}
    const n=norm(name+' '+(desc||''));const nn=norm(name);
    if(!nn||NONFOOD.test(nn))return {alimento:false,gramas:0,kcal:0,p:0,c:0,f:0,conf:90,prato:'não alimento',nivel:'não alimento',used:[]};
    if(tipo==='mercado'){const size=sizeFrom(name);const it=bestIng(evidence(nn).parts.map(x=>x.ing).join(' '))||bestIng(nn)||bestIng(n);if(!it)return {alimento:true,gramas:Math.round((size||300)*qty),kcal:Math.round(200*(size||300)/100*qty),p:5*(size||300)/100*qty,c:27*(size||300)/100*qty,f:8*(size||300)/100*qty,conf:15,prato:'mercado: sem correspondência',nivel:'sem correspondência',used:[]};
      const g=(size||300)*qty;return {alimento:true,gramas:Math.round(g),kcal:Math.round(it.kcal*g/100),p:it.prot*g/100,c:it.carb*g/100,f:it.gord*g/100,conf:size?70:35,nivel:size?'base conhecida (embalagem)':'porção estimada',prato:'mercado: '+it.nome+(size?'':' (tamanho estimado)'),used:[{ing:it.nome,g:Math.round(g)}]}}
    // Curated complete dishes precede individual ingredient matches.
    const recipe=PRATOS.find(x=>x.versao_base&&x.re.test(nn));
    if(recipe&&tipo!=='mercado'){
      const evr=evidence(n);const excluded=evr.excluded;
      const forbidden=new Set([...excluded].map(x=>norm(x).replace(/^taco: /,'')));
      let comp=recipe.composicao.filter(x=>!excluded.has(x.ing)&&![...forbidden].some(z=>norm(x.ing).includes(z)));
      const baseG=comp.reduce((a,x)=>a+x.g,0);const declared=sizeFrom(name);
      const scale=declared&&baseG?declared/baseG:mult(name).k;
      const result=nutrition(comp,qty*scale,recipe.descricao,declared?55:40,declared?'receita estimada; peso informado':'receita e porção estimadas');
      return result;
    }
    const ev=evidence(n);if(/\b(refrigerante|coca|pepsi|guarana|fanta|sprite|soda)\b/.test(nn)&&/\b(zero|diet|sem acucar)\b/.test(nn)){const z=ing('refrigerante zero');if(z)return nutrition([{ing:z.nome,g:sizeFrom(name)||350,explicit:!!sizeFrom(name),named:true}],qty,'Refrigerante sem açúcar',60,'bebida identificada')}if(/\bsashimi\b/.test(nn))ev.parts=ev.parts.filter(x=>x.ing!=='arroz de sushi');if(tipo!=='mercado')for(const x of ev.parts)if(/cru \(pacote\)/.test(x.ing))x.ing='arroz branco cozido';
    // Plain ingredient lists have stronger evidence than a broad recipe match.
    const complex=/\b(pizza|sanduiche|burger|hamburguer|combo|sushi|temaki|uramaki|risoto|lasanha|strogonoff|estrogonofe|bolo|torta|pastel|coxinha|empanada|crepe|tapioca|feijoada|ramen|lamen|sopa)\b/.test(nn);
    if(!complex&&ev.parts.length){
      let comp=ev.parts.map(x=>({...x,named:true}));
      const weights=comp.filter(x=>x.explicit);
      if(comp.length===1&&!weights.length){const size=sizeFrom(name);if(size)comp[0]={...comp[0],g:size,explicit:true}}
      // Sushi-free sashimi portions are fish only, with a distinct piece size.
      if(/\bsashimi\b/.test(nn)&&comp.length===1){const count=mult(name).pecas;if(count&&!comp[0].explicit)comp[0].g=count*15}
      return nutrition(comp,qty,'Ingredientes identificados; preparo e porções estimados',comp.every(x=>x.explicit)?65:40,comp.every(x=>x.explicit)?'pesos informados':'porções estimadas');
    }
    const {k,pecas}=mult(name);const loja=norm(ctx&&ctx.loja||'');let pr=null;if(/espeto|espetinho/.test(loja)&&/carne|frango|file|filé|mignon|picanha|queijo|coalho|linguica|linguiça|morango|bovino|suino|suíno|cupim|pao de alho|pão de alho/.test(nn)&&!/combo/.test(nn))pr=PRATOS.find(x=>/espeto/.test(x.padrao));if(!pr)pr=PRATOS.find(x=>x.re.test(nn))||PRATOS.find(x=>x.re.test(n));
    if(pr){let scale=k*qty;const unit=/^(um|uma)\b/.test(norm(pr.descricao||''));const baseG=pr.composicao.reduce((a,x)=>a+x.g,0);if(pecas){if(/sushi|combinado|peca/.test(norm(pr.padrao)))scale=pecas/25*qty;else if(unit)scale=pecas*k*qty}const sz=sizeFrom(name);if(sz&&(sz>=0.6*baseG||/bolo|bebida|ml|sorvete|gelato|acai|suco|refrigerante|cerveja|vinho|drink/.test(norm(pr.padrao+' '+pr.descricao)))){scale=sz/baseG*qty}
      let composition=pr.composicao.filter(x=>!ev.excluded.has(x.ing)).map(x=>({...x}));
      // Named proteins replace the recipe's default protein instead of adding both.
      const proteins=ev.parts.filter(x=>ing(x.ing)?.categoria==='proteina'&&!/hambúrguer/.test(x.ing));
      if(proteins.length){const proteinG=composition.filter(x=>ing(x.ing)?.categoria==='proteina').reduce((a,x)=>a+x.g,0)||150;composition=composition.filter(x=>ing(x.ing)?.categoria!=='proteina');proteins.forEach(x=>composition.push({...x,g:x.explicit?x.g:proteinG/proteins.length,named:true}))}
      for(const x of ev.parts){if(proteins.includes(x))continue;const old=composition.find(y=>y.ing===x.ing);if(old){old.named=true;if(x.explicit){old.g=x.g;old.explicit=true}}else if(!/carbo/.test(ing(x.ing)?.categoria||''))composition.push({...x,named:true})}
      // An ingredient's stated weight must not resize all the other components.
      if(ev.parts.some(x=>x.explicit))scale=k*qty;
      const s=sumComp(composition,scale);const conf=ev.parts.length?45:30;return {alimento:true,gramas:Math.round(s.g),kcal:Math.round(s.kcal),p:s.p,c:s.c,f:s.f,conf,nivel:'prato da base (porção padrão)',prato:pr.descricao,used:s.used}}
    const it=bestIng(nn)||bestIng(n);if(it){const DG={molho:25,gordura:15,bebida:350,doce:60,laticinio:40,vegetal:100,fruta:120,carbo:150,proteina:150,leguminosa:120};const g=(DG[it.categoria]||150)*k*qty;return {alimento:true,gramas:Math.round(g),kcal:Math.round(it.kcal*g/100),p:it.prot*g/100,c:it.carb*g/100,f:it.gord*g/100,conf:30,nivel:'porção estimada',prato:'ingrediente: '+it.nome+' (porção estimada)',used:[{ing:it.nome,g:Math.round(g)}]}}
    return {alimento:true,gramas:Math.round(400*k*qty),kcal:Math.round(520*k*qty),p:25*k*qty,c:55*k*qty,f:(200/9)*k*qty,conf:15,nivel:'sem correspondência',prato:'prato genérico (sem correspondência)',used:[]}}
  // pai + complementos: se os complementos somam o preço do pai, o pai é só um agrupador (combo, "esfihas fechadas")
  const SIDE=/refri|coca|guaran|pepsi|fanta|sprite|suco|agua|água|cerveja|chopp|batata|fritas|arroz|farofa|feij|salada|molho|vinagrete|couve|sobremesa|bebida|zero|lata|garrafa/i;
  function expand(items){const out=[];let i=0;while(i<items.length){const it=items[i];if(it.sub){out.push(it);i++;continue}const subs=[];let j=i+1;while(j<items.length&&items[j].sub){subs.push(items[j]);j++}
      const subSum=subs.reduce((a,s)=>a+(+s.preco||0),0);const container=subs.length&&(+it.preco||0)>0&&subSum>=0.8*(+it.preco||0)&&subs.some(s=>(+s.preco||0)>0);
      if(!container)out.push({...it,subs});else out.push({...it,container:true});
      subs.forEach(sb=>out.push({...sb,parent:it.nome,parentContainer:container}));i=j}return out}
  function estimateItem(it,tipo){if(it.container)return {alimento:false,gramas:0,kcal:0,p:0,c:0,f:0,conf:80,prato:'agrupador (valor nos complementos)',used:[]};
    if(it.sub&&it.parent){const alone=estimate(it.nome,'',it.qty,tipo,{loja:it.loja});const n=norm(it.nome);if(SIDE.test(n)&&alone.conf>=45)return alone;
      if(/^(?:sem|retirar|retire|nao|normal|tradicional|simples|grande|media|pequena)\b/.test(n))return {alimento:false,gramas:0,kcal:0,p:0,c:0,f:0,conf:30,prato:'opção do prato; não é uma porção adicional',used:[]};
      if(it.parentContainer)return estimate(it.parent+' '+it.nome,it.desc||'',it.qty,tipo,{loja:it.loja});
      return {...alone,prato:'complemento: '+alone.prato}}

    return estimate(it.nome,[it.desc,...(it.subs||[]).filter(x=>/^(sem|retirar|retire)\b/.test(norm(x.nome))).map(x=>x.nome)].filter(Boolean).join('; '),it.qty,tipo,{desc:it.desc,loja:it.loja})}
  // ---------- iFood JSON ----------
  const TYPE_I={RESTAURANT:'Restaurante',MARKET:'Mercado',PHARMACY:'Farmácia',PET:'Pet',BEVERAGE:'Mercado',SHOPPING:'Outros'};
  function parseIfood(arr){const out=[];for(const o of arr){if(!o||o.lastStatus!=='CONCLUDED')continue;const cents=v=>(v||0)/100;const bag=o.bag||{};const m=o.merchant||{};const tipo=TYPE_I[m.type]||'Outros';
      const sub=cents(bag.subTotal?.value),subD=cents(bag.subTotal?.valueWithDiscount??bag.subTotal?.value),fee=cents(bag.deliveryFee?.valueWithDiscount??bag.deliveryFee?.value),fees=(o.fees||[]).reduce((a,f)=>a+cents(f.amount?.value),0),total=cents(o.payments?.total?.value??bag.total?.valueWithDiscount);
      const disc=Math.max(0,sub-subD+(cents(bag.deliveryFee?.value)-fee));let minutos=null;const ev=(o.deliveryOperation?.executions||[]).flatMap(e=>(e.timeline||[]).flatMap(t=>t.events||[])).filter(e=>e.value==='DELIVERY_COMPLETED').pop();if(ev)minutos=Math.round((new Date(ev.timestamp)-new Date(o.createdAt))/60000);
      const items=[];for(const it of bag.items||[]){items.push({nome:it.name,desc:it.description,qty:+it.quantity||1,preco:cents(it.totalPriceWithDiscount??it.totalPrice)});for(const s of it.subItems||[]){if(cents(s.totalPrice)>0||SIDE.test(s.name||''))items.push({nome:s.name,desc:'',qty:(+s.quantity||1)*(+it.quantity||1),preco:cents(s.totalPriceWithDiscount??s.totalPrice)*(+it.quantity||1),sub:true})}}
      out.push({app:'iFood',ref:o.id||o.shortId,criado_em:o.createdAt,loja:(m.name||'').replace(/\s*[-|(\[].*$/,'').trim().slice(0,40)||m.name,tipo,tipo_loja:m.type||'',total,produtos:sub,taxas:fee+fees,desconto:disc,gorjeta:0,minutos,km:0,unidades:items.reduce((a,x)=>a+x.qty,0),items})}
    return out}
  // ---------- Rappi XLSX ----------
  function parseRappi(wb){const P=XLSX.utils.sheet_to_json(wb.Sheets['Pedidos'],{defval:null});const I=XLSX.utils.sheet_to_json(wb.Sheets['Itens']||{},{defval:null});const byId={};I.forEach(r=>{(byId[r['ID pedido']]=byId[r['ID pedido']]||[]).push(r)});
    const TYPE_R=t=>{t=t||'';if(/Restaurante/.test(t))return 'Restaurante';if(/Turbo|Express|Mercado/.test(t))return 'Mercado';if(/Favor|courier/.test(t))return 'Favor/Entrega';if(/Prime/.test(t))return 'Assinatura';return 'Outros'};
    const toIso=v=>{if(v instanceof Date)return v.toISOString();if(typeof v==='number'){const d=new Date(Math.round((v-25569)*864e5));return d.toISOString()}return new Date(v).toISOString()};
    return P.filter(r=>r['Status']==='Entregue').map(r=>{const its=(byId[r['ID pedido']]||[]).map(x=>({nome:x['Produto'],desc:x['Descrição do produto']||'',qty:+x['Unidades']||1,preco:+x['Total linha (R$)']||0,pres:x['Apresentação']||''}));
      return {app:'Rappi',ref:String(r['ID pedido']),criado_em:toIso(r['Criado em']),loja:(r['Marca']||r['Loja']||'').replace(/\s*[-|(\[].*$/,'').trim().slice(0,40),tipo:TYPE_R(r['Tipo loja']),tipo_loja:r['Tipo loja']||'',total:+r['Total pago (R$)']||0,produtos:+r['Produtos (R$)']||0,taxas:+r['Taxas entrega/serviço (R$)']||0,desconto:(+r['Descontos (R$)']||0)+(+r['Créditos Rappi (R$)']||0),gorjeta:+r['Gorjeta (R$)']||0,minutos:+r['Tempo entrega (min)']||null,km:0,unidades:+r['Unidades']||its.reduce((a,x)=>a+x.qty,0),items:its}})}
  // Detect spreadsheets by their columns, never by their filename.
  function parseWorkbook(wb){
    if(!wb.Sheets['Pedidos']||!wb.Sheets['Itens'])throw new Error('Planilha sem as abas Pedidos e Itens.');
    const orders=XLSX.utils.sheet_to_json(wb.Sheets['Pedidos'],{defval:null});
    const items=XLSX.utils.sheet_to_json(wb.Sheets['Itens'],{defval:null});
    const has=(rows,keys)=>rows.length&&keys.every(k=>Object.prototype.hasOwnProperty.call(rows[0],k));
    if(has(orders,['ID pedido','Subtotal c/ desconto (R$)','Taxa entrega c/ desconto (R$)'])&&has(items,['ID pedido','Nome','Quantidade','Nível']))return parseIfoodSheet(orders,items);
    if(has(orders,['ID pedido','Total pago (R$)','Produtos (R$)'])&&has(items,['ID pedido','Produto','Unidades']))return parseRappi(wb);
    throw new Error('Formato de planilha não reconhecido. Use a exportação completa do iFood ou da Rappi.');
  }
  function parseIfoodSheet(orders,items){
    const number=(v,label,fallback=0,signed=false)=>{if(v===null||v===undefined||v==='')return fallback;const n=Number(v);if(!Number.isFinite(n)||(!signed&&n<0))throw new Error('Valor inválido na coluna '+label);return n};
    const iso=v=>{if(v===null||v===undefined||v==='')throw new Error('Pedido sem data de criação.');const d=v instanceof Date?v:new Date(v);if(!Number.isFinite(d.getTime()))throw new Error('Data de criação inválida na planilha.');return d.toISOString()};
    const groups=new Map();for(const r of items){const id=String(r['ID pedido']??'');if(!id)throw new Error('Item sem ID pedido.');if(!groups.has(id))groups.set(id,[]);groups.get(id).push(r)}
    return orders.filter(r=>norm(r.Status)==='concluded').map(r=>{
      const ref=String(r['ID pedido']??'');if(!ref)throw new Error('Pedido sem ID completo.');
      const detail=groups.get(ref);if(!detail?.length)throw new Error('Pedido concluído sem itens na planilha.');
      const normalized=[];let parent=null;
      for(const x of detail){
        const sub=norm(x['Nível'])==='complemento';if(!sub&&norm(x['Nível'])!=='item')throw new Error('Nível de item desconhecido na planilha.');
        if(sub&&(!parent||String(x['Item pai'])!==parent.name))throw new Error('Complemento sem item pai correspondente.');
        const q=number(x.Quantidade,'Quantidade',1);if(q<=0)throw new Error('Quantidade deve ser positiva.');
        const price=number(x['Total c/ desc. (R$)']??x['Total (R$)'],'Total do item');
        if(!sub)parent={name:String(x.Nome??''),qty:q};
        // Exported complements are per parent unit, matching the original iFood JSON.
        if(!sub||price>0||SIDE.test(x.Nome||''))normalized.push({nome:String(x.Nome??''),desc:String(x.Descrição??''),qty:q*(sub?parent.qty:1),preco:price*(sub?parent.qty:1),...(sub?{sub:true}:{})});
      }
      const delivery=number(r['Taxa entrega c/ desconto (R$)']??r['Taxa entrega (R$)'],'Taxa entrega');
      const minutes=r['Min. pedido→entrega'];
      return {app:'iFood',ref,criado_em:iso(r['Criado em']),loja:String(r.Loja??''),tipo:TYPE_I[r['Tipo loja']]||'Outros',tipo_loja:r['Tipo loja']||'',
        total:number(r['Total pago (R$)'],'Total pago'),produtos:number(r['Subtotal (R$)'],'Subtotal'),taxas:delivery+number(r['Taxas (R$)'],'Taxas'),desconto:Math.max(0,number(r['Desconto total (R$)'],'Desconto total',0,true)),gorjeta:0,
        minutos:minutes===null||minutes===undefined?null:number(minutes,'Min. pedido→entrega'),km:0,unidades:normalized.reduce((n,x)=>n+x.qty,0),items:normalized};
    });
  }

  // ---------- pipeline ----------
  async function run(file,{api,userId,onStatus,reprocess=false}){const say=t=>onStatus&&onStatus(t);if(file.size>30*1024*1024)throw new Error('Arquivo maior que 30 MB. Divida a exportação.');say('Carregando base nutricional...');await loadBase(api);
    say('Lendo '+file.name+'...');let orders;
    if(/\.json$/i.test(file.name)){const j=JSON.parse(await file.text());orders=parseIfood(Array.isArray(j)?j:(j.orders||j.pedidos||[]))}
    else if(/\.xlsx$/i.test(file.name)){const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});orders=parseWorkbook(wb)}
    else throw new Error('formato não suportado: use o JSON do iFood ou o XLSX da Rappi');
    if(!orders.length)throw new Error('nenhum pedido concluído no arquivo');
    say(`${orders.length} pedidos no arquivo. Verificando duplicados...`);
    const app=orders[0].app;
    const unique=new Map();
    for(const o of orders){
      if(!o.ref||!Number.isFinite(Date.parse(o.criado_em))||!Number.isFinite(o.total)||o.total<0)
        throw new Error('Pedido com identificação, data ou total inválido. Nenhum dado foi gravado.');
      if(!Array.isArray(o.items)||o.items.length>500)throw new Error('Pedido com itens inválidos ou mais de 500 itens.');
      for(const it of o.items)if(!Number.isFinite(it.qty)||it.qty<=0||!Number.isFinite(it.preco)||it.preco<0)
        throw new Error('Item com quantidade ou preço inválido. Nenhum dado foi gravado.');
      unique.set(String(o.ref),o);
    }
    if(unique.size>10000)throw new Error('Máximo de 10.000 pedidos por arquivo.');
    const seen=new Set();
    if(!reprocess){for(let offset=0;;offset+=1000){
      const r=await api(`/rest/v1/pedidos?user_id=eq.${userId}&app=eq.${encodeURIComponent(app)}&select=pedido_ref&order=id.asc&limit=1000&offset=${offset}`);
      if(!r.ok)throw new Error('Não foi possível verificar pedidos existentes.');
      const page=await r.json();page.forEach(x=>seen.add(String(x.pedido_ref)));if(page.length<1000)break;
    }}
    const novos=[...unique.values()].filter(o=>!seen.has(String(o.ref)));
    if(!novos.length){
      const r=await api('/rest/v1/rpc/recalcular_produtos',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
      if(!r.ok)throw new Error('Pedidos preservados; falha ao atualizar produtos. Reenvie o arquivo para tentar novamente.');
      say('Todos os pedidos já estavam importados. Produtos atualizados.');return {novos:0,app};
    }
    say(`Estimando nutrição de ${novos.length} pedidos...`);
    const rows=[],itemRows=[];for(const [index,o] of novos.entries()){if(index%25===0)await new Promise(resolve=>setTimeout(resolve,0));const tipo=o.tipo==='Restaurante'?'restaurante':'mercado';let k=0,p=0,c=0,f=0,g=0,cw=0,ck=0;const its=[];
      for(const it of expand(o.items.map(x=>({...x,loja:o.loja})))){const e=estimateItem(it,tipo);its.push({...it,e});if(e.alimento){k+=e.kcal;p+=e.p;c+=e.c;f+=e.f;g+=e.gramas;cw+=e.conf*e.kcal;ck+=e.kcal}}
      rows.push({user_id:userId,app:o.app,pedido_ref:o.ref,criado_em:o.criado_em,loja:o.loja,tipo:o.tipo,tipo_loja:o.tipo_loja,total:o.total,produtos:o.produtos,taxas:o.taxas,desconto:o.desconto,gorjeta:o.gorjeta,minutos:o.minutos,km:0,unidades:o.unidades,itens:o.items.slice(0,3).map(x=>(x.nome||'').slice(0,50)).join(' | '),kcal:Math.round(k),prot:Math.round(p),carb:Math.round(c),gord:Math.round(f),peso_g:Math.round(g),confianca:ck?Math.round(cw/ck):0,origem_arquivo:file.name,versao_motor:MODEL_VERSION,_items:its})}
    say('Gravando em lotes de até 100 pedidos; cada lote é atômico...');
    const payload=rows.map(({_items,...r})=>({...r,itens_detalhe:_items.map(it=>{const e=it.e;return {nome:(it.nome||'').slice(0,120),quantidade:it.qty,preco:it.preco,alimento:e.alimento,gramas:e.gramas,kcal:e.kcal,prot:Math.round(e.p*10)/10,carb:Math.round(e.c*10)/10,gord:Math.round(e.f*10)/10,confianca:e.conf,prato:(e.nivel?'['+e.nivel+'] ':'')+e.prato,ingredientes:e.used}})}));
    let inserted=0;for(let i=0;i<payload.length;i+=100){const r=await api('/rest/v1/rpc/importar_pedidos_v2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_pedidos:payload.slice(i,i+100),p_reprocessar:reprocess})});if(!r.ok)throw new Error('importar_pedidos_v2 '+r.status+' '+(await r.text()).slice(0,140)+(inserted?` (${inserted} pedidos já gravados; reenvie o arquivo para continuar)`:''));inserted+=+(await r.json()).gravados;say(`Gravados ${inserted} de ${payload.length} pedidos...`)}
    itemRows.length=payload.reduce((a,p)=>a+p.itens_detalhe.length,0);
    say('Recalculando produtos...');const rp=await api('/rest/v1/rpc/recalcular_produtos',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!rp.ok)throw new Error('recalcular_produtos '+rp.status);
    say(`Pronto: ${inserted} pedidos e ${itemRows.length} itens importados.`);return {novos:inserted,itens:itemRows.length,app}}
  return {run,estimate,estimateItem,expand,loadBase,parseIfood,parseRappi,parseWorkbook,parseIfoodSheet}})();
