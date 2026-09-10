window.EatIQDining=(()=>{
'use strict';
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const groups={italiana:/massa|pizza|carbonara|risoto|lasanha|italian/,japonesa:/sushi|sashimi|lamen|temaki|japones|atum|salmao/,carnes:/grelhad|picanha|mignon|churrasc|carne|frango/,brasileira:/brasileir|feijoad|galeto|baiao|picadinho/,mar:/camarao|peixe|frutos do mar|moqueca/,arabe:/arabe|esfiha|kibe|quibe|beirute|libanes/,mexicana:/mexican|taco|burrito/};
function family(r){const c=norm(r.cozinha);return c.includes('italian')?'italiana':c.includes('japones')?'japonesa':c.includes('carne')?'carnes':c.includes('brasileir')?'brasileira':/peixe|frutos/.test(c)?'mar':c.includes('libanes')?'arabe':c.includes('mexican')?'mexicana':c}
function select(data,args={},mode='gosto'){
 const weights={};for(const o of args.orders||[]){if(o.tipo!=='Restaurante')continue;const text=norm((o.loja||'')+' '+(o.itens||''));for(const [key,re]of Object.entries(groups))if(re.test(text))weights[key]=(weights[key]||0)+1}
 const quiz=window.EatIQQuizModel?.weights(args.quiz)||{};for(const [tag,weight]of Object.entries(quiz))for(const[key,re]of Object.entries(groups))if(re.test(norm(tag)))weights[key]=(weights[key]||0)+weight*6;
 const candidates=data.filter(r=>mode==='bib'?r.distincao==='Bib Gourmand':mode==='especial'?Number(r.estrelas)>0:true).map(r=>({...r,family:family(r),affinity:weights[family(r)]||0}));
 candidates.sort((a,b)=>b.affinity-a.affinity||Number(b.distincao==='Bib Gourmand')-Number(a.distincao==='Bib Gourmand')||a.nome.localeCompare(b.nome));
 const out=[],used=new Set();for(const r of candidates){if(used.has(r.family))continue;out.push(r);used.add(r.family);if(out.length===3)break}return out;
}
let last={};
function render(args=last){last=args;const host=document.getElementById('diningCards');if(!host)return;const mode=document.getElementById('diningMode').value;const data=window.EatIQDiningData||[];const results=select(data,args,mode);
 host.innerHTML=results.map(r=>{let url='';try{const u=new URL(r.url_michelin);if(u.protocol==='https:'&&u.hostname==='guide.michelin.com')url=u.href}catch{}
 const label=mode==='bib'?'Qualidade e preço':mode==='especial'?'Uma ocasião especial':r.affinity?'Combina com seu gosto':'Para descobrir';return `<article class="dining-card"><div class="dining-cover">${esc(r.cozinha)}</div><div class="dining-body"><span class="dining-label">${label}</span><h3>${esc(r.nome)}</h3><p class="dining-meta">${esc(r.distincao)} · Guia Michelin</p><p class="dining-price">${esc(r.preco)} <span>${esc(r.faixa_preco)}</span></p><p class="dining-address">${esc(r.endereco)} · ${esc(r.cidade)}</p>${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Ver restaurante no guia</a>`:''}</div></article>`}).join('')||'<p>Nenhuma opção para este filtro.</p>';
}
const selectEl=document.getElementById('diningMode');if(selectEl){selectEl.addEventListener('change',()=>render());render()}
// Uses only the current account's already filtered history and saved quiz.
if(window.EatIQInsights){const original=window.EatIQInsights.render;window.EatIQInsights.render=function(args){render(args);return original.call(this,args)};const reset=window.EatIQInsights.reset;window.EatIQInsights.reset=function(){last={};render();return reset.call(this)}}
return {select,render};
})();
