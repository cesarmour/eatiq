const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const nodes=new Map();const context={window:{},document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:''});return nodes.get(id)}}};
 vm.createContext(context);vm.runInContext(fs.readFileSync('site/login/analysis-cards.js','utf8'),context);
 return {...context.window.EatIQAnalysis,nodes};
}
const order=(kcal,extra={})=>({meal:true,date:new Date('2026-08-01T12:00:00'),kOrder:kcal,conf:45,pOrder:30,tot:30,p:'iFood',s:'Loja',...extra});
test('typical order is a median; low-confidence and nonfood orders do not bias it',()=>{
 const a=setup().analyze([order(400),order(500),order(600),order(5000),order(10000,{conf:15}),order(9000,{meal:false})]);
 assert.equal(a.median,550);assert.equal(a.count,5);assert.equal(a.used,4);assert.equal(a.quality.review,1);
 assert.equal(a.q1,475);assert.equal(a.q3,1700);
});
test('equal 28-day windows compare per-order medians, independently of frequency',()=>{
 const start=new Date('2026-07-01T12:00:00');
 const rows=Array.from({length:56},(_,i)=>{const date=new Date(start);date.setDate(date.getDate()+i);return order(i<28?500:400,{date})});
 const a=setup().analyze(rows);assert.equal(a.trend.enough,true);assert.equal(a.trend.change,-20);
 assert.equal(a.trend.previousCount,28);assert.equal(a.trend.recentCount,28);
});
test('short history never reports an artificial improvement',()=>{
 const a=setup();a.render([order(400),order(500)]);
 assert.match(a.nodes.get('orderTrend').innerHTML,/falta histórico/);
 assert.equal(a.analyze([order(400)]).trend.change,null);
});
test('protein value uses whole-order protein and amount paid, separates apps and never repeats a store',()=>{
 const rows=[...Array.from({length:3},()=>order(500,{pr:1,pOrder:30,tot:60})),...Array.from({length:3},()=>order(500,{p:'Rappi',pOrder:30,tot:30}))];
 const a=setup().analyze(rows);assert.equal(a.ranking.length,2);assert.equal(a.ranking[0].app,'Rappi');
 assert.equal(a.ranking[0].value,10);assert.equal(a.ranking[1].value,5);
});
test('empty and missing estimates stay explicit; untrusted store names are escaped',()=>{
 const a=setup();a.render([]);assert.match(a.nodes.get('orderTypical').innerHTML,/Importe pedidos/);
 a.render(Array.from({length:3},()=>order(500,{s:'<img src=x onerror=alert(1)>'})));
 assert.ok(!a.nodes.get('protRank').innerHTML.includes('<img'));
 a.render([order(null,{conf:null}),order(0,{conf:0})]);
 assert.ok(!/NaN|Infinity/.test([...a.nodes.values()].map(x=>x.innerHTML).join('')));
 assert.equal(a.analyze([order(null,{conf:null})]).quality.missing,1);
});
