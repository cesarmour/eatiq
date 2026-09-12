/* Dietary curation, not diagnosis. See docs/personalizacao-exames.md for sources and limits. */
window.EatIQClinical=(()=>{
'use strict';
const valid=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>0;
const definitions=[['ldl','LDL',v=>v>=100],['hdl','HDL',v=>v<=40],['tg','Triglicérides',v=>v>=150],['gli','Glicemia de jejum',v=>v>=100],['uri','Ácido úrico',v=>v>=7]];
function active(profile={}){return definitions.filter(([key,,trigger])=>valid(profile[key])&&trigger(Number(profile[key]))).map(([key,label])=>({key,label}))}
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function evidence(item){
 // A menu option or removal request is not proof of the final composition.
 const raw=norm((item.name||'')+'. '+(item.description||''));
 const text=raw.replace(/\bsem\s+(?:adicao de\s+)?(?:bacon|manteiga|creme de leite|calabresa|acucar|refrigerante|cerveja|azeite|abacate|nozes|castanhas|legumes|vegetais|feijao|lentilha|grao de bico|arroz integral|aveia)\b/g,'');
 return {uncertain:!!item.choices||/\b(escolha|opcional|opcionais|a escolher|ao vinho|molho de vinho|ou)\b/.test(raw),
 saturated:/\b(bacon|calabresa|linguica|salsicha|manteiga|creme de leite|cheddar|quatro queijos|4 queijos|costela|picanha)\b/.test(text),
 sweet:/\b(refrigerante|coca cola|milk ?shake|leite condensado|calda de chocolate)\b/.test(text)&&! /\b(zero|diet|sem acucar)\b/.test(raw),
 alcohol:/\b(cerveja|chopp|vinho|caipirinha)\b/.test(text),
 purine:/\b(figado|miudos|rim|rins|sardinha|anchova|camarao|mariscos|mexilhao|carne bovina|picanha|costela|mignon)\b/.test(text),
 fiber:/\b(feijao|lentilha|grao de bico|arroz integral|aveia|legumes|vegetais)\b/.test(text),
 unsaturated:/\b(azeite|abacate|nozes|castanhas)\b/.test(text)};
}
function assess(item,profile={}){
 const markers=active(profile),e=evidence(item),concerns=[],benefits=[];
 if(!markers.length)return {adjustment:0,reasons:[],concerns:[],active:false};
 if(e.uncertain)return {adjustment:0,reasons:['Composição depende de escolhas: confira os ingredientes. Sem ajuste pelos exames para este item.'],concerns:[],active:true};
 for(const {key,label} of markers){
  if((key==='ldl'||key==='hdl')&&e.saturated)concerns.push(label+': a descrição inclui ingredientes que podem fornecer gordura saturada.');
  if((key==='tg'||key==='gli')&&e.sweet)concerns.push(label+': a descrição inclui bebida açucarada ou ingrediente doce.');
  if((key==='tg'||key==='uri')&&e.alcohol)concerns.push(label+': há bebida alcoólica na descrição.');
  if(key==='uri'&&e.purine)concerns.push(label+': há fonte animal de purinas na descrição.');
  if(['ldl','hdl','gli','tg'].includes(key)&&e.fiber)benefits.push(label+': legumes, leguminosas ou integrais identificados na descrição.');
  if(['ldl','hdl'].includes(key)&&e.unsaturated)benefits.push(label+': fonte de gordura insaturada identificada na descrição.');
 }
 const reasons=concerns.length?concerns:benefits.length?benefits:['Sem evidência suficiente na descrição para ajustar este prato pelos exames.'];
 return {adjustment:concerns.length?-.45:benefits.length?.15:0,reasons,concerns,active:true};
}
function summary(profile={}){const a=active(profile);return a.length?'Critérios de curadoria ativos: '+a.map(x=>x.label).join(', ')+'. A prioridade considera ingredientes descritos; não prevê o efeito do prato no exame.':'Sem critério de curadoria acionado pelos valores informados. Isso não significa que os exames estejam clinicamente normais.'}
return {active,assess,summary,valid,definitions};
})();
