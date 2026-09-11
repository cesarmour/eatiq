'use strict';
const steps=[...document.querySelectorAll('.steps > li')];
const progress=document.getElementById('stepProgress');
const navigation=document.getElementById('stepNavigation');
const previous=document.getElementById('previousStep');
const next=document.getElementById('nextStep');
const labels=['Já entrei na minha conta','O painel eatIQ apareceu','A coleta começou','Já baixei o arquivo'];
let current=0;
function showStep(index,focus=false){
 current=index;
 steps.forEach((step,i)=>{step.hidden=i!==index});
 progress.textContent=`Etapa ${index+1} de ${steps.length}`;
 previous.hidden=index===0;
 next.hidden=index===steps.length-1;
 next.textContent=labels[index]||'';
 if(focus){const heading=steps[index].querySelector('h2');heading.tabIndex=-1;heading.focus()}
}
previous.addEventListener('click',()=>showStep(Math.max(0,current-1),true));
next.addEventListener('click',()=>showStep(Math.min(steps.length-1,current+1),true));
progress.hidden=false;navigation.hidden=false;showStep(0);
const platform=navigator.userAgentData?.platform||navigator.platform||'';
const shortcut=document.getElementById('consoleShortcut');
if(/Mac/i.test(platform))shortcut.textContent='⌘ + Option + J';
else if(/Win|Linux/i.test(platform))shortcut.textContent='Ctrl + Shift + J';
document.getElementById('copy').addEventListener('click',async()=>{
 const source=document.getElementById('source'),status=document.getElementById('copyStatus');
 try{await navigator.clipboard.writeText(source.value);status.textContent='Copiado. Volte à aba da plataforma, cole no console e pressione Enter.'}
 catch{source.closest('details').open=true;source.focus();source.select();status.textContent='Cópia automática indisponível. O código está selecionado: use ⌘ + C ou Ctrl + C.'}
});
