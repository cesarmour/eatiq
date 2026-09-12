const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c={window:{}};vm.createContext(c);vm.runInContext(fs.readFileSync('site/login/health-insights.js','utf8'),c);const analyze=c.window.EatIQHealthInsights.analyze;
const date=i=>new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10);
function fixture(){const orders=[],health=[];for(let i=0;i<60;i++){orders.push({id:i,app:'iFood',tipo:'Restaurante',criado_em:date(i)+(i%2?'T22:00:00':'T19:00:00'),kcal:i%2?400:200,prot:i%2?40:10,total:i%2?40:20,confianca:60});health.push({dia:date(i),passos:i%2?9000:1000,treino_min:i%2?60:10,sono_min:i%2?500:300})}health.push({dia:date(60),passos:1000,sono_min:300});return {orders,health}}
const card=(r,id)=>r.cards.find(c=>c.id===id);
test('ten comparisons work without active calories, with independently known deltas',()=>{
 const {orders,health}=fixture(),r=analyze(orders,health);assert.equal(r.cards.length,10);assert.equal(r.ready,10);assert.equal(r.coverage.kcal_ativas,0);
 assert.equal(card(r,'steps-kcal').delta,200);assert.equal(card(r,'steps-spend').delta,20);assert.equal(card(r,'steps-count').delta,0);assert.equal(card(r,'steps-late').delta,100);
 assert.equal(card(r,'steps-protein').delta,50);assert.equal(card(r,'next-steps').delta,-8000);assert.ok(Math.abs(card(r,'next-sleep').delta+200/60)<1e-10);
});
test('missing sleep does not gate the eight movement and workout cards',()=>{
 const {orders,health}=fixture();health.forEach(h=>delete h.sono_min);const r=analyze(orders,health);assert.equal(r.ready,8);assert.equal(card(r,'next-sleep').ready,false);
});
test('sleep joins the next calendar day, not same day or next available observation',()=>{
 const orders=[{id:1,tipo:'Restaurante',criado_em:'2026-01-01T22:00:00'}];
 const r=analyze(orders,[{dia:'2026-01-01',sono_min:600},{dia:'2026-01-03',sono_min:500}]);assert.equal(card(r,'next-sleep').groups[1].n,0);
 const boundary=analyze([{...orders[0],criado_em:'2026-12-31T22:00:00'}],[{dia:'2027-01-01',sono_min:500}],'2026');assert.equal(card(boundary,'next-sleep').groups[1].n,0);
});
test('null workout is never no workout, zero steps is an observation, small groups stay pending',()=>{
 const {orders,health}=fixture();health.forEach((h,i)=>{h.passos=i%2?9000:0;h.treino_min=null});const r=analyze(orders,health);assert.equal(card(r,'steps-kcal').ready,true);assert.equal(card(r,'workout-kcal').ready,false);
 assert.equal(analyze(orders.slice(0,8),health).ready,0);
});
test('duplicates, nonrestaurants and incomplete nutrition cannot bias day joins',()=>{
 const {orders,health}=fixture();const r=analyze([...orders,orders[0],{...orders[0],id:'market',tipo:'Mercado'}],health);assert.equal(r.matchedDays,60);assert.equal(card(r,'steps-count').delta,0);
 orders[0].confianca=0;const v=analyze(orders,health);assert.equal(card(v,'steps-kcal').groups[0].n,29);assert.equal(card(v,'steps-spend').groups[0].n,30);
 const duplicated=analyze(orders,[...health,health[0]]);assert.equal(duplicated.matchedDays,59);
});
test('all null and all tied Health fields never produce invented comparisons',()=>{
 const {orders,health}=fixture();const empty=analyze(orders,health.map(h=>({dia:h.dia})));assert.equal(empty.ready,0);
 const tied=analyze(orders,health.map(h=>({dia:h.dia,passos:1000})));assert.equal(card(tied,'steps-kcal').ready,false);
});
