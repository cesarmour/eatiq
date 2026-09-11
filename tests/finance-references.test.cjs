const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c={window:{}};vm.createContext(c);vm.runInContext(fs.readFileSync('site/login/finance-references.js','utf8'),c);const refs=c.window.EatIQFinanceReferences;
test('grocery recipe converts package units to raw portions without pricing cooked weights',()=>{
 const beef=refs.recipe('beef'),eggs=refs.recipe('eggs');
 const expected=19.63/5000*75+8.96/1000*50+8.2/1000*150+7.89/1000*30+31.60/1000*5+7.37/900*10;
 assert.ok(Math.abs(beef.total-(expected+48.54/1000*200))<1e-10);
 assert.ok(Math.abs(eggs.total-(expected+10.74/12*2))<1e-10);
 assert.equal(refs.recipe('custom'),null);
 assert.match(beef.source.url,/procon/);assert.equal(beef.source.date,'2026-07-31');
});
test('restaurant presets preserve the published formats rather than one invented mean',()=>{
 assert.equal(refs.restaurants.commercial.price,44.16);assert.equal(refs.restaurants.executive.price,58.84);
 assert.equal(refs.restaurants.selfservice.price,61.44);assert.equal(refs.restaurants.alacarte.price,103.66);
 assert.equal(refs.restaurantSource.date,'2025-09');
});
