const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c={window:{}};vm.createContext(c);for(const f of ['clinical','taste'])vm.runInContext(fs.readFileSync(`site/login/${f}.js`,'utf8'),c);
const clinical=c.window.EatIQClinical,taste=c.window.EatIQTaste;
test('missing, invalid or non-triggering labs never change ranking',()=>{
 for(const labs of [{},{ldl:null},{ldl:90},{hdl:0},{tg:-1},{gli:'bad'},{uri:Infinity}])assert.equal(clinical.assess({name:'Pizza bacon'},labs).adjustment,0);
});
test('dietary conflicts take precedence over positive ingredients',()=>{
 const d=clinical.assess({name:'Bowl de camarão com legumes e azeite'},{ldl:140,uri:8});
 assert.ok(d.adjustment<0);assert.ok(d.reasons.every(x=>x.includes('Ácido úrico')));
 assert.ok(clinical.assess({name:'Pizza com bacon e vegetais'},{ldl:140}).adjustment<0);
});
test('no signal invented from unclear menus, removals or total fat',()=>{
 for(const item of [{name:'Prato do dia',gord:100},{name:'Pizza sem bacon'},{name:'Pizza bacon',choices:true},{name:'Pizza: escolha bacon ou legumes'},{name:'Pizza sem vegetais'},{name:'Bife ao vinho'}])assert.equal(clinical.assess(item,{ldl:140,tg:200}).adjustment,0);
 assert.equal(clinical.assess({name:'Combo pizza e refrigerante zero'},{gli:120}).adjustment,0);
});
test('each supported marker has an explainable food signal',()=>{
 for(const [labs,item] of [[{ldl:140},'Pizza bacon'],[{hdl:35},'Pizza manteiga'],[{tg:200},'Pizza com cerveja'],[{gli:110},'Pizza com refrigerante'],[{uri:8},'Pizza de camarão']]){
 const r=clinical.assess({name:item},labs);assert.ok(r.adjustment<0);assert.equal(r.reasons.length,1);
 }
 assert.ok(clinical.assess({name:'Bowl com lentilha e azeite'},{ldl:140}).adjustment>0);
});
test('saved lab criteria change the selected dish, preserving preferences and budget',()=>{
 const orders=[{id:'1',tipo:'Restaurante',app:'iFood',loja:'Old',criado_em:'2026-09-10'}],items=[{pedido_id:'1',nome:'Pizza',alimento:true}];
 const catalog={stores:[{id:'a',name:'A',rating:4.8,reviews:100}],items:[{id:'a',storeId:'a',name:'Pizza bacon',price:40},{id:'b',storeId:'a',name:'Pizza legumes',price:45}]};
 const rec=(labs,budget=50)=>taste.recommend(orders,items,catalog,'budget',{labs,budget}).suggestions;
 assert.equal(rec({})[0].id,'a');assert.equal(rec({ldl:140})[0].id,'b');assert.equal(rec({ldl:140},42)[0].id,'a');
 assert.ok(rec({ldl:140},42)[0].clinical.concerns.length);assert.equal(rec({})[0].id,'a');
});
