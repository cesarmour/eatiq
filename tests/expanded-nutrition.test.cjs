const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const catalog=JSON.parse(fs.readFileSync('supabase/nutrition-catalog.json'));
const recipes=JSON.parse(fs.readFileSync('supabase/nutrition-recipes.json'));
const sql=fs.readFileSync('supabase/supabase-motor.sql','utf8');
const legacy=[...sql.matchAll(/^\('([^']+)','([^']+)',([\d.]+),([\d.]+),([\d.]+),([\d.]+),'([^']+)'\)/gm)].map(m=>({nome:m[1],categoria:m[2],kcal:+m[3],prot:+m[4],carb:+m[5],gord:+m[6],palavras:m[7]}));
async function engine(){const c={window:{},setTimeout};vm.createContext(c);vm.runInContext(fs.readFileSync('site/login/engine.js','utf8'),c);await c.window.EatIQEngine.loadBase(async path=>({ok:true,json:async()=>path.includes('ingredientes')?[...legacy,...catalog]:path.includes('pratos')?recipes:[]}));return c.window.EatIQEngine}
test('catalog is finite, unique and complete; every recipe reference resolves',()=>{assert.equal(catalog.length,578);const names=new Set([...legacy,...catalog].map(x=>x.nome));assert.equal(new Set(catalog.map(x=>x.nome)).size,catalog.length);for(const x of catalog){for(const k of ['kcal','prot','carb','gord'])assert.ok(Number.isFinite(x[k])&&x[k]>=0);assert.ok(x.prot+x.carb+x.gord<=102,x.nome);new RegExp(x.palavras)}for(const r of recipes)for(const x of r.composicao)assert.ok(names.has(x.ing),x.ing)});
test('unseen lentil and pea names use individual food profiles',async()=>{const e=await engine();for(const name of ['Lentilha 100g','Lentinha 100g','Ervilha 100g']){const a=e.estimate(name,'',1,'restaurante',{});assert.equal(a.gramas,100);assert.equal(a.used.length,1);assert.match(a.used[0].ing,/TACO:/);assert.ok(a.p>3)}});
test('dry and cooked lentils are distinct',async()=>{const e=await engine();const a=e.estimate('Lentilha crua 100g','',1,'restaurante',{}),b=e.estimate('Lentilha cozida 100g','',1,'restaurante',{});assert.ok(a.kcal>b.kcal*2)});
test('carbonara is a complete recipe and declared portion scales macros',async()=>{const e=await engine();const a=e.estimate('Spaghetti carbonara','',1,'restaurante',{});assert.equal(a.used.length,4);assert.ok(a.kcal>500&&a.kcal<1100);assert.ok(a.p>20);const b=e.estimate('Carbonara 630g','',1,'restaurante',{});assert.equal(b.gramas,630);assert.ok(Math.abs(b.p-2*a.p)<.01)});
test('all curated recipes yield nonzero finite nutrition',async()=>{const e=await engine();for(const r of recipes){const name=r.padrao.split('|')[0].replace(/\.\*/g,' ');const a=e.estimate(name,'',1,'restaurante',{});assert.ok(a.kcal>0&&Number.isFinite(a.p),name)}});
test('presunto and shoyu no longer use grouped substitutes',async()=>{const e=await engine();for(const [name,id] of [['Presunto 100g','439'],['Shoyu 100g','518']]){const a=e.estimate(name,'',1,'restaurante',{});assert.equal(a.used.length,1);assert.equal(a.used[0].fonte_id,id)}});
test('a bacon component weight must not shrink the entire carbonara',async()=>{
 const e=await engine();const a=e.estimate('Carbonara com bacon 30g','',1,'restaurante',{});
 assert.equal(a.gramas,310);assert.equal(a.used.find(x=>x.ing==='bacon').g,30);
 assert.equal(a.used.find(x=>x.ing==='massa cozida').g,220);
});
test('curated recipes respect weights and removals supplied in the description',async()=>{
 const e=await engine();const a=e.estimate('Carbonara','Bacon 20g; sem parmesão',1,'restaurante',{});
 assert.equal(a.gramas,275);assert.ok(!a.used.some(x=>/parmes/i.test(x.ing)));
 assert.equal(a.used.find(x=>x.ing==='bacon').g,20);
 assert.equal(a.used.find(x=>x.ing==='bacon').evidencia,'peso informado');
});
test('dish total allocates only remaining mass and quantity scales once',async()=>{
 const e=await engine();const a=e.estimate('Carbonara 400g','Bacon 30g',2,'restaurante',{});
 assert.equal(a.gramas,800);assert.equal(a.used.find(x=>x.ing==='bacon').g,60);
 assert.ok(a.used.find(x=>x.ing==='massa cozida').g>440);
});
test('dish total can be supplied in description without ignoring named weights',async()=>{
 const e=await engine();const a=e.estimate('Carbonara','Peso total 400g; bacon 30g',1,'restaurante',{});
 assert.equal(a.gramas,400);assert.equal(a.used.find(x=>x.ing==='bacon').g,30);
});
test('conflicting total lowers confidence and preserves explicit evidence',async()=>{
 const e=await engine();const a=e.estimate('Carbonara 100g','Bacon 150g',1,'restaurante',{});
 assert.equal(a.used.find(x=>x.ing==='bacon').g,150);assert.ok(a.conf<30);
 assert.match(a.nivel,/conflitantes/);assert.ok(a.kcal>0&&Number.isFinite(a.p));
});
