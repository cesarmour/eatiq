'use strict';
document.getElementById('copy').addEventListener('click',async()=>{
 const source=document.getElementById('source'),status=document.getElementById('copyStatus');
 try{await navigator.clipboard.writeText(source.value);status.textContent='Copiado. Volte à aba da plataforma, cole no console e pressione Enter.'}
 catch{source.closest('details').open=true;source.focus();source.select();status.textContent='Cópia automática indisponível. O código está selecionado: use ⌘ + C ou Ctrl + C.'}
});
