const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const sql=fs.readFileSync('supabase/supabase-motor.sql','utf8');
const ingredients=[...sql.matchAll(/^\('([^']+)','([^']+)',([\d.]+),([\d.]+),([\d.]+),([\d.]+),'([^']+)'\)/gm)].map(m=>({nome:m[1],categoria:m[2],kcal:+m[3],prot:+m[4],carb:+m[5],gord:+m[6],palavras:m[7]}));
const pratos=[...sql.matchAll(/^\((\d+),'([^']+)','([^']+)','([^']+)'::jsonb\)/gm)].map(m=>({ordem:+m[1],padrao:m[2],descricao:m[3],composicao:JSON.parse(m[4])}));
const response=(data,ok=true)=>({ok,status:ok?200:500,json:async()=>data,text:async()=>JSON.stringify(data)});
const base=async(p,scale=1)=>response(p.includes('ingredientes')?ingredients.map(x=>({...x,kcal:x.kcal*scale})):p.includes('pratos')?pratos:[{chave:'nao_alimento',valor:'shampoo|sabao'}]);
async function engine(){const c={window:{},setTimeout};vm.createContext(c);vm.runInContext(fs.readFileSync('site/login/engine.js','utf8'),c);await c.window.EatIQEngine.loadBase(base);return c.window.EatIQEngine}
test('explicit component weights sum independently without resizing the dish',async()=>{const e=await engine();const a=e.estimate('Frango 150g com arroz 100g','',1,'restaurante',{});assert.equal(a.gramas,250);assert.equal(a.kcal,376);assert.ok(Math.abs(a.p-49)<0.01);assert.equal(a.c,28)});
test('description contributes ingredients and excluded cheese is removed',async()=>{const e=await engine();const a=e.estimate('Prato executivo','Frango 150g, arroz 100g, sem queijo',1,'restaurante',{});assert.equal(a.gramas,250);assert.ok(!a.used.some(x=>x.ing==='mussarela'))});
test('names containing light do not turn food into zero-calorie soda',async()=>{const e=await engine();assert.ok(e.estimate('Iogurte light 170g','',1,'restaurante',{}).kcal>0)});
test('sashimi pieces use fish weight without rice',async()=>{const e=await engine();const a=e.estimate('Sashimi de salmão 10 peças','',1,'restaurante',{});assert.equal(a.gramas,150);assert.equal(a.kcal,312);assert.ok(a.used.every(x=>x.ing==='salmão'))});
test('paid additional cheese counts cheese rather than half a sandwich',async()=>{const e=await engine();const a=e.estimateItem({nome:'Queijo 30g',parent:'Sanduíche de frango',sub:true,qty:1},'restaurante');assert.equal(a.gramas,30);assert.equal(a.kcal,90)});
test('recipe protein substitution removes default chicken',async()=>{const e=await engine();const a=e.estimate('Sanduíche de atum','sem maionese',1,'restaurante',{});assert.ok(a.used.some(x=>x.ing==='atum'));assert.ok(!a.used.some(x=>/frango|maionese/.test(x.ing)))});
test('declared quantity scales all macros once',async()=>{const e=await engine();const a=e.estimate('Frango 150g com arroz 100g','',2,'restaurante',{});assert.equal(a.gramas,500);assert.equal(a.kcal,751);assert.equal(a.p,98)});
test('free removal options survive legacy JSON and change the parent recipe',async()=>{
 const e=await engine();const orders=e.parseIfood([{id:'sample',lastStatus:'CONCLUDED',createdAt:'2026-09-01T12:00:00Z',merchant:{type:'RESTAURANT',name:'Loja'},bag:{items:[{name:'Sanduíche',quantity:1,totalPrice:3000,subItems:[{name:'Sem queijo',quantity:1,totalPrice:0}]}]}}]);
 const expanded=e.expand(orders[0].items);const parent=e.estimateItem(expanded[0],'restaurante');
 assert.equal(expanded.length,2);assert.ok(!parent.used.some(x=>x.ing==='mussarela'));
 assert.equal(e.estimateItem(expanded[1],'restaurante').alimento,false);
});
