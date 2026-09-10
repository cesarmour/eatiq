window.EatIQQuizModel=(()=>{
'use strict';
const questions=[
 {title:'Qual prato te chama primeiro?',hint:'Pense no que você pediria por vontade.',options:[{name:'Uma boa massa',note:'Conforto no prato',art:'pasta',tags:{massa:3}},{name:'Frango grelhado',note:'Direto ao ponto',art:'grill',tags:{grelhados:2,frango:2}}]},
 {title:'E no centro do prato?',hint:'Não existe escolha certa.',options:[{name:'Camarão',note:'Sabor do mar',art:'sea',tags:{camarao:3}},{name:'Carne bem preparada',note:'Sabor de brasa',art:'grill',tags:{grelhados:2,carne:3}}]},
 {title:'Para mudar de cozinha…',hint:'Escolha o convite mais interessante.',options:[{name:'Sushi e sashimi',note:'Uma noite japonesa',art:'sushi',tags:{sushi:3,salmao:1,atum:1}},{name:'Kibe e pratos árabes',note:'Temperos que abraçam',art:'arabe',tags:{arabe:3,esfiha:1}}]},
 {title:'Um pedido sem complicar.',hint:'Qual combina mais com seu momento?',options:[{name:'Pizza para a mesa',note:'Clássica e aconchegante',art:'pizza',tags:{pizza:3}},{name:'Um bowl caprichado',note:'Frescor e variedade',art:'bowl',tags:{salada:3,vegetais:1}}]},
 {title:'E para fechar?',hint:'O lado doce também conta.',options:[{name:'Pudim',note:'Um clássico cremoso',art:'pudding',tags:{pudim:3}},{name:'Chocolate',note:'Intenso, do seu jeito',art:'chocolate',tags:{chocolate:3}}]}
];
function valid(p){return p?.version===1&&Array.isArray(p.answers)&&p.answers.length===5&&p.answers.every(x=>Number.isInteger(x)&&x>=0&&x<=3)}
function profile(answers){const p={version:1,answers:[...answers]};if(!valid(p))return null;return p}
function weights(p){const w={};if(!valid(p))return w;questions.forEach((q,i)=>{const a=p.answers[i];for(const [j,o]of q.options.entries()){if(a!==j&&a!==2)continue;for(const[k,v]of Object.entries(o.tags))w[k]=(w[k]||0)+v*(a===2?.5:1)}});return w}
const dishes=[
 {name:'Spaghetti ao pomodoro',family:'massa',tags:{massa:3,vegetais:1}},
 {name:'Frango grelhado com legumes',family:'grelhados',tags:{grelhados:2,frango:3,vegetais:1}},
 {name:'Risoto de camarão',family:'risoto',tags:{camarao:3,massa:1}},
 {name:'Filé mignon com purê',family:'grelhados',tags:{grelhados:2,carne:3}},
 {name:'Sashimi de atum e salmão',family:'sushi',tags:{sushi:3,atum:1,salmao:1}},
 {name:'Kibe cru com salada',family:'arabe',tags:{arabe:3,carne:1}},
 {name:'Pizza margherita',family:'pizza',tags:{pizza:3}},
 {name:'Bowl de legumes assados',family:'salada',tags:{salada:3,vegetais:2}},
 {name:'Pudim de leite',family:'doce',tags:{pudim:3}},
 {name:'Mousse de chocolate',family:'doce',tags:{chocolate:3}}
];
function suggest(p){const w=weights(p),rank=dishes.map(d=>({...d,score:Object.entries(d.tags).reduce((s,[k,v])=>s+(w[k]||0)*v,0)})).filter(d=>d.score>0).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));const main=[],seen=new Set();for(const d of rank.filter(d=>d.family!=='doce')){if(seen.has(d.family))continue;main.push(d);seen.add(d.family);if(main.length===2)break}const dessert=rank.find(d=>d.family==='doce');if(dessert)main.push(dessert);else{const extra=rank.find(d=>!seen.has(d.family));if(extra)main.push(extra)}return main.map((d,i)=>({...d,label:d.family==='doce'?'Para fechar':i===0?'Seu estilo':'Outra boa pedida'}))}
return {questions,valid,profile,weights,suggest};
})();
