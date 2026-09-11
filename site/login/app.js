
const SUPABASE_URL='https://krleeleliuollgtxcvwc.supabase.co';
const SUPABASE_ANON_KEY='sb_publishable_G2q71BtZSKJUZ_-3V2vvBw_Rj1frq6M';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dayKey=d=>{d=new Date(d);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const valueOr=(v,f)=>v===null||v===undefined||v===''||!Number.isFinite(+v)?f:+v;
let ROWS=[];const fmt=n=>Math.round(n).toLocaleString('pt-BR');const brl=n=>'R$ '+fmt(n);const brl2=n=>'R$ '+n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const MON=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];const DOWN=['dom','seg','ter','qua','qui','sex','sáb'];
const MC={Calorias:'#1C2430',Proteína:'#5B8FD6',Carboidrato:'#D9A441',Gordura:'#7A4E6C'};const PC={iFood:'#EA1D2C',Rappi:'#F58220'};

// ---------- auth ----------
let session=null;try{session=JSON.parse(localStorage.getItem('eatiq_session')||'null')}catch(e){}
const saveSession=x=>{if(!x){window.EatIQInsights?.reset();window.EatIQQuizProfile?.reset();}session=x;if(x)localStorage.setItem('eatiq_session',JSON.stringify(x));else localStorage.removeItem('eatiq_session')};
const H=()=>({'apikey':SUPABASE_ANON_KEY,'Authorization':'Bearer '+(session?.access_token||'')});
const AH={'apikey':SUPABASE_ANON_KEY,'Content-Type':'application/json'};
const authErr=j=>{const m=j.error_description||j.msg||j.message||j.error||'';if(/invalid login|invalid_credentials/i.test(m))return 'E-mail ou senha incorretos.';if(/not confirmed/i.test(m))return 'Confirme seu e-mail antes de entrar. Veja a caixa de entrada.';if(/already registered|already been registered/i.test(m))return 'Esse e-mail já tem conta. Entre ou redefina a senha.';if(/rate limit/i.test(m))return 'Muitas tentativas. Espere um minuto.';if(/password/i.test(m))return 'Senha fraca: use pelo menos 8 caracteres.';if(/signups not allowed/i.test(m))return 'Cadastro desligado no momento.';return m||'Não deu certo.'};
let refreshPending=null;
function returnToLogin(message='Sua sessão terminou. Entre novamente para continuar.'){
 saveSession(null);$('app').style.display='none';$('login').style.display='grid';showView('in');
 $('loginErr').textContent=message;$('loginErr').style.display=message?'block':'none';
}
async function refreshOnce(){const previous=session;if(!previous?.refresh_token)return false;const r=await fetch(SUPABASE_URL+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:AH,body:JSON.stringify({refresh_token:previous.refresh_token})});if(session!==previous)return false;if(!r.ok){if(r.status===400||r.status===401||r.status===403){returnToLogin();return false}throw new Error('Falha temporária ao renovar sessão ('+r.status+'). Tente novamente.')}const next=await r.json();if(session!==previous)return false;if(!next.access_token)throw new Error('Resposta de sessão inválida');saveSession(next);return true}
function refresh(){if(!refreshPending)refreshPending=refreshOnce().finally(()=>refreshPending=null);return refreshPending}
async function api(path,opt={}){const denied=r=>r.status===401||(path==='/auth/v1/user'&&r.status===403);let r=await fetch(SUPABASE_URL+path,{...opt,headers:{...H(),...(opt.headers||{})}});if(denied(r)&&await refresh())r=await fetch(SUPABASE_URL+path,{...opt,headers:{...H(),...(opt.headers||{})}});if(denied(r))returnToLogin();return r}
document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.v)));
function showView(v){document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('on',x.dataset.v===v));document.querySelectorAll('.view').forEach(f=>f.style.display=f.dataset.view===v?'block':'none')}
const busy=(btn,on,label)=>{btn.disabled=on;btn.textContent=on?'Um momento...':label};
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();const b=$('loginBtn'),er=$('loginErr');er.style.display='none';busy(b,true,'Entrar');try{
  const r=await fetch(SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:AH,body:JSON.stringify({email:$('email').value.trim(),password:$('pass').value})});const j=await r.json();
  if(!r.ok){er.textContent=authErr(j);er.style.display='block';busy(b,false,'Entrar');return}saveSession(j);boot()}catch(x){er.textContent='Falha de conexão. Tente novamente.';er.style.display='block'}finally{busy(b,false,'Entrar')}});
$('signupForm').addEventListener('submit',async e=>{e.preventDefault();const b=$('signupBtn'),er=$('signupErr'),ok=$('signupOk');er.style.display=ok.style.display='none';if(!$('suConsent').checked){er.textContent='Marque o consentimento.';er.style.display='block';return}busy(b,true,'Criar conta');try{
  const r=await fetch(SUPABASE_URL+'/auth/v1/signup',{method:'POST',headers:AH,body:JSON.stringify({email:$('suEmail').value.trim(),password:$('suPass').value,data:{nome:$('suName').value.trim(),consentimento:true,consentido_em:new Date().toISOString()},options:{emailRedirectTo:location.origin+'/login/'}})});const j=await r.json();
  if(!r.ok){er.textContent=authErr(j);er.style.display='block';busy(b,false,'Criar conta');return}
  if(j.access_token){saveSession(j);boot();return}
  ok.textContent='Conta criada. Enviamos um link de confirmação para '+$('suEmail').value.trim()+'. Clique nele e depois entre.';ok.style.display='block';busy(b,false,'Criar conta')}catch(x){er.textContent='Falha de conexão. Tente novamente.';er.style.display='block'}finally{busy(b,false,'Criar conta')}});
$('resetForm').addEventListener('submit',async e=>{e.preventDefault();const b=$('resetBtn'),er=$('resetErr'),ok=$('resetOk');er.style.display=ok.style.display='none';busy(b,true,'Enviar link');try{
  const r=await fetch(SUPABASE_URL+'/auth/v1/recover',{method:'POST',headers:AH,body:JSON.stringify({email:$('rsEmail').value.trim(),options:{redirectTo:location.origin+'/login/'}})});
  if(!r.ok){er.textContent=authErr(await r.json());er.style.display='block'}else{ok.textContent='Se esse e-mail tiver conta, o link chega em instantes.';ok.style.display='block'}busy(b,false,'Enviar link')}catch(x){er.textContent='Falha de conexão. Tente novamente.';er.style.display='block'}finally{busy(b,false,'Enviar link')}});
$('newPassForm').addEventListener('submit',async e=>{e.preventDefault();const b=$('npBtn'),er=$('npErr');er.style.display='none';busy(b,true,'Salvar senha');try{
  const r=await api('/auth/v1/user',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('npPass').value})});
  if(!r.ok){er.textContent=authErr(await r.json());er.style.display='block';busy(b,false,'Salvar senha');return}history.replaceState(null,'',location.pathname);boot()}catch(x){er.textContent='Falha de conexão. Tente novamente.';er.style.display='block'}finally{busy(b,false,'Salvar senha')}});
$('logout').addEventListener('click',()=>{const headers=H();returnToLogin('');USER=null;ALL=[];ROWS=[];window.__rawO=[];fetch(SUPABASE_URL+'/auth/v1/logout',{method:'POST',headers}).catch(()=>{});});
// links de confirmação / recuperação chegam com tokens no hash
let recovering=false;
(function(){const h=new URLSearchParams(location.hash.replace(/^#/,''));if(h.get('access_token')){saveSession({access_token:h.get('access_token'),refresh_token:h.get('refresh_token'),token_type:'bearer'});history.replaceState(null,'',location.pathname);if(h.get('type')==='recovery'){recovering=true;$('login').style.display='grid';showView('newpass');return}history.replaceState(null,'',location.pathname)}else if(h.get('error_description')){$('loginErr').textContent=decodeURIComponent(h.get('error_description').replace(/\+/g,' '));$('loginErr').style.display='block'}})();

// ---------- data ----------
let ALL=[],PRODS=[],HD={};
async function fetchAll(table,order){let out=[],from=0;const columns={pedidos:'id,app,criado_em,loja,tipo,tipo_loja,total,produtos,taxas,desconto,gorjeta,kcal,prot,carb,gord,minutos,itens,peso_g,confianca,origem_arquivo',health_daily:'dia,passos,kcal_ativas,kcal_basal,peso,sono_min,treino_min'};const stableOrder=table==='pedidos'?order+',id.asc':order;while(true){const r=await api(`/rest/v1/${table}?select=${columns[table]||"*"}&order=${stableOrder}`,{headers:{'Range':`${from}-${from+999}`,'Range-Unit':'items'}});if(!r.ok)throw new Error(table+' '+r.status);const j=await r.json();out.push(...j);if(j.length<1000)break;from+=1000}return out}
const CUIS=[['sushi|lamen|poke|aima|mizuki|japengo|izakaya|temaki|yakisoba|nikkei|jun sakamoto','Japonês'],['pizza|forneria|bráz|braz|domino|elettrica','Pizza / italiano'],['burger|hot dog|mcdonald|bullguer|z deli|cadillac|bob|smash','Hambúrguer'],['jaber|arab|esfiha|habib|kebab','Árabe'],['camar|coco bambu|frutos|peixe|mar','Frutos do mar'],['churras|espeto|beef|steak|fogo de|outback|madero|picanha','Carne / churrasco'],['padaria|bakery|panificadora|torta|ceci|officina|starbucks|café|cafe|bacio|gelato|doce|confeit|brigadeiro','Padaria / café'],['mexican|taco|burrito','Mexicano'],['frutaria|açaí|acai|salad|green|fit|bio |natural|oakberry|veg','Saudável'],['feijoada|mocotó|mineir|brasileir|galeto|marmita|prato feito','Brasileiro'],['nino|cucina|trattoria|osteria|massa|pasta|veridiana','Italiano'],['peruan|ceviche','Peruano'],['alemão|alemao','Alemão'],['thai|indian|india|chin|coreano|korean','Asiático']];
const cuisine=s=>{const n=(s||'').toLowerCase();for(const [re,c] of CUIS)if(new RegExp(re).test(n))return c;return 'Restaurante'};
function prep(rows){return rows.map(r=>{const date=new Date(r.criado_em);const meal=r.tipo==='Restaurante';const shp=Math.max(0,Math.min(100,valueOr(PROF.porcao_grande_pct,30)))/100;const share=v=>v<=900?v:900+(v-900)*shp;const sh=meal&&r.kcal>0?share(r.kcal)/r.kcal:1;
  return {id:r.id,p:r.app,date,d:r.criado_em,m:dayKey(date).slice(0,7),y:dayKey(date).slice(0,4),hr:date.getHours(),dow:date.getDay(),s:r.loja,t:r.tipo,tt:r.tipo_loja,cat:meal?cuisine(r.loja):r.tipo,meal,items:r.itens||'',
    tot:+r.total||0,sub:+r.produtos||0,fee:+r.taxas||0,disc:+r.desconto||0,tip:+r.gorjeta||0,kOrder:r.kcal||0,pOrder:r.prot??null,k:meal?share(r.kcal||0):0,pr:(r.prot||0)*sh,cb:(r.carb||0)*sh,f:(r.gord||0)*sh,sat:(r.gord||0)*sh*0.38,min:+r.minutos||0,
    drink:/refri|coca|guaran|pepsi|fanta|sprite/i.test(r.itens||'')?'refri':(/cerveja|chopp|heineken|brahma|vinho|rum|whisk|gin|cachaça|caipirinha/i.test(r.itens||'')?'alcool':null),
    peso:r.peso_g||null,conf:r.confianca||null,origem:r.origem_arquivo||null}})}
let PROF={},USER=null;
async function boot(){$('login').style.display='none';$('app').style.display='block';
  try{const u=await api('/auth/v1/user');if(!u.ok){if(u.status===401||u.status===403)return;throw new Error('serviço de autenticação '+u.status)}USER=await u.json();$('whoami').textContent=(USER.user_metadata?.nome||USER.email||'').slice(0,40);
    const profileResponse=await api(`/rest/v1/profiles?user_id=eq.${USER.id}&select=*`);if(!profileResponse.ok)throw new Error('perfil '+profileResponse.status);let pr=await profileResponse.json();if(!pr.length){await api('/rest/v1/profiles',{method:'POST',headers:{'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify({user_id:USER.id,email:USER.email,nome:USER.user_metadata?.nome||null})});pr=[{}]}PROF=pr[0]||{};window.EatIQQuizProfile?.mount({userId:USER.id,profile:PROF,api,onChange:p=>{PROF.quiz_gostos=p;window.EatIQInsights?.reset();render()}});
    const [o,p,h]=await Promise.all([fetchAll('pedidos','criado_em.asc'),Promise.resolve([]),fetchAll('health_daily','dia.asc')]);window.__rawO=o;ALL=prep(o);PRODS=p;HD={};h.forEach(x=>HD[x.dia]=x);setupHealth();$('loading').style.display='none';await renderUploads();
    if(!ALL.length){$('empty').style.display='block';$('content').style.display='block';loadProfile();render();return}
    $('content').style.display='block';loadProfile();render()}
  catch(x){$('loading').style.display='block';$('loading').textContent='Não consegui carregar seus dados ('+x.message+'). Tente recarregar.';console.error(x)}}
async function renderUploads(){try{const r=await api(`/rest/v1/uploads?user_id=eq.${USER.id}&select=arquivo,app,processado,created_at&order=created_at.desc&limit=5`);if(!r.ok)return;const u=await r.json();const el=$('upList');if(!el)return;el.innerHTML=u.length?u.map(x=>`<span class="pill ${x.processado?'':'warn'}" title="${esc(x.created_at)}">${esc(x.app||'arquivo')} · ${esc(x.arquivo)} · ${x.processado?'importado':'não concluído'}</span>`).join(' '):''}catch(e){}}
// importação: o arquivo é lido e analisado no navegador; só o resultado (pedidos e itens) vai para o banco. O arquivo em si não é enviado.
const STEP=(k,st)=>{const li=$('importSteps').querySelector(`[data-s="${k}"]`);if(li)li.className=st};
const stepFromMsg=m=>{if(/base nutricional/i.test(m))return 'read';if(/^Lendo/.test(m))return 'read';if(/duplicad/i.test(m))return 'dedupe';if(/Estimando/i.test(m))return 'estimate';if(/Gravando|Recalculando/i.test(m))return 'save';if(/^Pronto/i.test(m))return 'done';return null};
let reprocessNext=false,importBusy=false;
$('upFile2')?.addEventListener('change',()=>{if(!$('upFile2').files[0])return;const dt=new DataTransfer();dt.items.add($('upFile2').files[0]);$('upFile').files=dt.files;$('upFile').dispatchEvent(new Event('change'))});
$('upFile').addEventListener('change',async()=>{const f=$('upFile').files[0];if(!f||importBusy)return;importBusy=true;const reprocess=reprocessNext;reprocessNext=false;$('reproc').disabled=true;const st=$('upStatus');st.textContent='Lendo...';
  let upId=null;try{const u=await api('/rest/v1/uploads?select=id',{method:'POST',headers:{'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify({user_id:USER.id,arquivo:f.name.slice(0,120),caminho:null,app:/rappi/i.test(f.name)?'Rappi':(/ifood/i.test(f.name)?'iFood':null),tamanho:f.size})});upId=(await u.json())[0]?.id}catch(e){}
  try{const res=await EatIQEngine.run(f,{api,userId:USER.id,onStatus:t=>st.textContent=t,reprocess});if(upId)await api(`/rest/v1/uploads?id=eq.${upId}`,{method:'PATCH',headers:{'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify({processado:true,app:res.app||null})});
    productKey='';window.EatIQInsights?.reset();if(res.novos){const [o,p]=await Promise.all([fetchAll('pedidos','criado_em.asc'),Promise.resolve([])]);window.__rawO=o;ALL=prep(o);PRODS=p;$('empty').style.display='none';$('content').style.display='block';if(!$('pW').dataset.bound){loadProfile();$('pW').dataset.bound=1}render()}}
  catch(x){st.textContent='Importação falhou: '+x.message}
  renderUploads();$('upFile').value='';importBusy=false;$('reproc').disabled=false});
$('reproc')?.addEventListener('click',()=>{if(importBusy)return;reprocessNext=true;$('upStatus').textContent='Selecione o arquivo original. Apenas os pedidos presentes nele serão recalculados; os demais serão preservados.';$('upFile').click()});
$('upFile').addEventListener('cancel',()=>{reprocessNext=false});


// ---------- Apple Health ----------
function setupHealth(){$('syncToken').textContent=PROF.sync_token||'—';$('syncUrl').textContent=SUPABASE_URL+'/rest/v1/health_daily?on_conflict=user_id,dia';$('anonKeyShow').textContent=SUPABASE_ANON_KEY;
  const ks=Object.keys(HD).sort();$('lastSync').textContent=ks.length?`${ks[ks.length-1]} (${ks.length} dias no total)`:'nenhuma';
  $('copyToken').onclick=()=>{navigator.clipboard.writeText(PROF.sync_token||'');$('copyToken').textContent='Copiado';setTimeout(()=>$('copyToken').textContent='Copiar',1500)};
  $('newToken').onclick=async()=>{if(!confirm('Gerar um token novo invalida o atalho atual. Continuar?'))return;const r=await api(`/rest/v1/profiles?user_id=eq.${USER.id}&select=sync_token`,{method:'PATCH',headers:{'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify({sync_token:crypto.randomUUID()})});const j=await r.json();PROF.sync_token=j[0]?.sync_token;$('syncToken').textContent=PROF.sync_token};
  $('showShortcut').onclick=e=>{e.preventDefault();const t=$('atalho');t.style.display=t.style.display==='none'?'block':'none';t.scrollIntoView({behavior:'smooth'})};
  $('hkFile').onchange=importHealth}
let healthBusy=false;
async function importHealth(){const f=$('hkFile').files[0];if(!f||healthBusy)return;healthBusy=true;const st=$('hkStatus');st.textContent='Lendo '+f.name+'...';
 try{const result=await EatIQHealth.read(f);const rows=result.rows.map(r=>({...r,user_id:USER.id}));
  for(let i=0;i<rows.length;i+=500){const r=await api('/rest/v1/health_daily?on_conflict=user_id,dia',{method:'POST',headers:{'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows.slice(i,i+500))});if(!r.ok)throw new Error('Falha ao salvar Health ('+r.status+'). Reenvie o arquivo para retomar.');}
  rows.forEach(r=>HD[r.dia]=r);st.textContent=`Pronto: ${rows.length} dias importados.`;setupHealth();render();
 }catch(e){st.textContent=e.message}finally{healthBusy=false;$('hkFile').value=''}
}

// ---------- profile ----------
const PK={pW:'peso',pH:'altura',pA:'idade',pS:'sexo',pAct:'atividade',pG:'meta',pBase:'kcal_fora_delivery',pShare:'porcao_grande_pct',pCut:'corte_cenario'};let saveT=null;
function readProfileForm(){Object.entries(PK).forEach(([kk,c])=>PROF[c]=$(kk).value===''?null:(kk==='pS'?$(kk).value:+$(kk).value))}
function loadProfile(){if($('pW').dataset.bound)return;$('pW').dataset.bound='1';Object.entries(PK).forEach(([k,c])=>{if(PROF[c]!==null&&PROF[c]!==undefined)$(k).value=PROF[c]});Object.keys(PK).forEach(k=>$(k).addEventListener('input',()=>{readProfileForm();clearTimeout(saveT);saveT=setTimeout(render,150);$('profileSaved').textContent='Alterações não salvas'}));$('saveProfile').addEventListener('click',async()=>{readProfileForm();const b=$('saveProfile');b.disabled=true;b.textContent='Salvando...';const ok=await saveProfile();b.disabled=false;b.textContent='Salvar perfil';$('profileSaved').textContent=ok?'Salvo às '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'Não consegui salvar. Tente de novo.'})}
async function saveProfile(){try{const r=await api(`/rest/v1/profiles?user_id=eq.${USER.id}`,{method:'PATCH',headers:{'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify({...Object.fromEntries([...Object.values(PK),'ldl','hdl','tg','gli','uri'].map(k=>[k,PROF[k]??null])),updated_at:new Date().toISOString()})});return r.ok}catch(e){return false}}
function profile(){const w=+PROF.peso||0,h=+PROF.altura||0,a=+PROF.idade||0,s=PROF.sexo||'m',act=+PROF.atividade||1.375,g=+PROF.meta||0;const ok=w>0&&h>0&&a>0;
  const bmr=ok?(10*w+6.25*h-5*a+(s==='m'?5:-161)):0;const need=ok?bmr*act:2400;const share=Math.max(0,Math.min(100,valueOr(PROF.porcao_grande_pct,30)))/100,cut=Math.max(0,valueOr(PROF.corte_cenario,350)),base0=valueOr(PROF.kcal_fora_delivery,null);return {w,h,a,s,act,g,ok,bmr,need,needP:ok?w*1.4:120,needC:need*0.45/4,needF:need*0.28/9,imc:ok?w/((h/100)**2):0,share,cut,base0}}

// ---------- filters ----------
const state={p:'all',t:String(new Date().getFullYear())};
document.querySelectorAll('#segT [data-v="2026"]').forEach(b=>{b.dataset.v=state.t;b.textContent=state.t});
document.querySelectorAll('.seg').forEach(seg=>seg.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;seg.querySelectorAll('button').forEach(x=>x.classList.remove('on'));b.classList.add('on');state[seg.id==='segP'?'p':'t']=b.dataset.v;render()}));
function filtered(){const last=ALL.length?ALL[ALL.length-1].date:new Date();const from12=new Date(last);from12.setFullYear(last.getFullYear()-1);return ALL.filter(o=>(state.p==='all'||o.p===state.p)&&(state.t==='all'||(/^\d{4}$/.test(state.t)?o.y===state.t:o.date>=from12)))}
function rank(el,arr,keyFn,valFn,subFn,fmtV,fmtS,colFn,n=8){const c=Object.create(null);arr.forEach(o=>{const k=keyFn(o);c[k]=c[k]||{v:0,n:0,items:[]};c[k].v+=valFn(o);c[k].n++;c[k].items.push(o)});
  const a=Object.entries(c).sort((x,y)=>y[1].v-x[1].v).slice(0,n);const max=a[0]?a[0][1].v:1;
  $(el).innerHTML=a.map(([k,v])=>`<li><div><div class="name">${esc(k)}</div><div class="meta">${subFn(v)}</div><div class="bar"><i class="${colFn?colFn(v):''}" style="width:${v.v/max*100}%"></i></div></div><div class="right"><b>${fmtV(v.v)}</b>${fmtS?`<small>${fmtS(v)}</small>`:''}</div></li>`).join('')||'<li class="meta">Sem dados no filtro</li>'}

// ---------- days model ----------
function buildDays(O){const meals=O.filter(o=>o.meal);if(!O.length)return[];const pf=profile();const start=new Date(O[0].date);start.setHours(0,0,0,0);const end=new Date(O[O.length-1].date);end.setHours(0,0,0,0);const days=[];
  const byDay={};meals.forEach(o=>{const k=dayKey(o.date);(byDay[k]=byDay[k]||[]).push(o)});
  for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){const k=dayKey(d);const os=byDay[k]||[];const day={date:new Date(d),dow:d.getDay(),orders:os,k:0,p:0,c:0,f:0,s:0,lastHr:0};
    os.forEach(o=>{day.k+=o.k;day.p+=o.pr;day.c+=o.cb;day.f+=o.f;day.s+=o.sat;day.lastHr=Math.max(day.lastHr,o.hr)});
    const hd=HD[k];day.hd=hd||null;day.active=hd?.kcal_ativas||0;day.train=(hd?.treino_min||0)>=20;day.sleep=hd?.sono_min?hd.sono_min/60:null;day.weight=hd?.peso||null;
    const needDay=hd&&(hd.kcal_ativas||hd.kcal_basal)?((hd.kcal_basal||pf.bmr||1800)*1.15+(hd.kcal_ativas||0)):pf.need;
    const n=os.length;const b0=pf.base0??needDay;const base=n===0?b0:(n===1?b0*0.55:(n===2?b0*0.3:b0*0.15));day.k+=base;day.p+=base*0.18/4;day.c+=base*0.5/4;day.f+=base*0.32/9;day.s+=base*0.012;
    day.need=needDay;day.needP=pf.needP;day.needC=pf.needC;day.needF=pf.needF;days.push(day)}
  return days}
function buildWeeks(days){const weeks=[];if(!days.length)return weeks;let i=0;while(i<days.length){const ws=days.slice(i,i+7);const k=ws.reduce((a,x)=>a+x.k,0),p=ws.reduce((a,x)=>a+x.p,0),s=ws.reduce((a,x)=>a+x.s,0),dr=ws.reduce((a,x)=>a+x.orders.filter(o=>o.drink).length,0);
    weeks.push({d:ws[0].date,days:ws,sat:s/ws.length,k:k/ws.length,score:Math.max(0,Math.min(100,Math.round(74+(p*4/k-0.18)*250-(s/ws.length-20)*0.8-dr*2)))});i+=7}return weeks}

// ---------- render ----------
let productKey='',productRequest=0;
async function renderProductRank(){
 let start=null,end=null;if(/^\d{4}$/.test(state.t)){start=new Date(+state.t,0,1);end=new Date(+state.t+1,0,1)}else if(state.t!=='all'){start=new Date(ALL.length?ALL[ALL.length-1].date:new Date());start.setFullYear(start.getFullYear()-1)}
 const args={p_app:state.p==='all'?null:state.p,p_inicio:start?.toISOString()??null,p_fim:end?.toISOString()??null};const key=JSON.stringify(args);if(key===productKey)return;productKey=key;const ticket=++productRequest;$('prodRank').textContent='Carregando produtos do período...';
 try{const r=await api('/rest/v1/rpc/produtos_periodo',{method:'POST',headers:{'Content-Type':'application/json'},body:key});if(!r.ok)throw new Error('Produtos indisponíveis');const rows=await r.json();if(ticket!==productRequest)return;const max=Math.max(1,...rows.map(x=>+x.gasto));
 $('prodRank').innerHTML=rows.map(x=>`<li><div><div class="name">${esc(x.nome)}</div><div class="meta">${esc(x.app)} · ${fmt(x.pedidos)} pedidos · ${fmt(x.unidades)} un.</div><div class="bar"><i style="width:${+x.gasto/max*100}%"></i></div></div><div class="right"><b>${brl(+x.gasto)}</b><small>${brl(+x.gasto/Math.max(1,+x.unidades))} por un.</small></div></li>`).join('')||'<li>Sem produtos de mercado no período.</li>';
 }catch(e){if(ticket===productRequest){productKey='';$('prodRank').textContent='Não foi possível carregar os produtos. Tente trocar o filtro.'}}
}
function render(){if(window.__rawO)ALL=prep(window.__rawO);const O=filtered();const meals=O.filter(o=>o.meal);const pf=profile();if(USER&&window.EatIQInsights){const selected=new Set(O.map(o=>String(o.id)));window.EatIQInsights.render({orders:(window.__rawO||[]).filter(o=>selected.has(String(o.id))),userId:USER.id,api,quiz:PROF.quiz_gostos})}
  $('profileFoot').innerHTML=pf.ok?`Gasto basal <b>${fmt(pf.bmr)} kcal</b>, necessidade diária <b>${fmt(pf.need)} kcal</b>, proteína alvo <b>${fmt(pf.needP)}g</b>. IMC <b>${pf.imc.toFixed(1).replace('.',',')}</b>.`:'Preencha peso, altura e idade para calibrar a necessidade diária. Enquanto isso uso 2.400 kcal.';
  const days=buildDays(O);const weeks=buildWeeks(days);const week=days.slice(-7);
  // --- semana
  $('weekSub').textContent=week.length?`Últimos 7 dias com dados: ${week[0].date.toLocaleDateString('pt-BR')} a ${week[week.length-1].date.toLocaleDateString('pt-BR')}. Necessidade estimada pelo perfil e pelo Health, quando disponível.`:'';
  (function(){if(!week.length){$('rings').innerHTML='';$('ringsFoot').textContent='';$('macroDaily').innerHTML='';return}const W={k:0,p:0,c:0,f:0,nk:0,np:0,nc:0,nf:0};week.forEach(d=>{W.k+=d.k;W.p+=d.p;W.c+=d.c;W.f+=d.f;W.nk+=d.need;W.np+=d.needP;W.nc+=d.needC;W.nf+=d.needF});
    const items=[['Calorias',W.k,W.nk,'kcal'],['Proteína',W.p,W.np,'g'],['Carboidrato',W.c,W.nc,'g'],['Gordura',W.f,W.nf,'g']];
    $('rings').innerHTML=items.map(([n,v,t,u])=>{const r=v/t;const C=2*Math.PI*34;const col=MC[n];const over=r>1;const tag=over?`<span class="pill ${r>1.2?'hi':'warn'}">+${Math.round((r-1)*100)}%</span>`:`<span class="pill sky">${Math.round((1-r)*100)}% abaixo</span>`;
      return `<div class="ring"><svg viewBox="0 0 84 84"><circle cx="42" cy="42" r="34" fill="none" stroke="#EEF0EC" stroke-width="8"/><circle cx="42" cy="42" r="34" fill="none" stroke="${col}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${C*Math.min(r,1)} ${C}" transform="rotate(-90 42 42)"/>${over?`<circle cx="42" cy="42" r="26" fill="none" stroke="${col}" stroke-width="4" stroke-linecap="round" opacity=".55" stroke-dasharray="${2*Math.PI*26*Math.min(r-1,1)} 999" transform="rotate(-90 42 42)"/>`:''}<text x="42" y="47" text-anchor="middle" font-family="Bricolage Grotesque" font-size="17" font-weight="500" fill="#1C2430">${Math.round(r*100)}%</text></svg><b style="color:${col}">${fmt(v)}${u}</b><span>${n}<br>de ${fmt(t)}${u}</span>${tag}</div>`}).join('');
    const rf=W.f/W.nf,rk=W.k/W.nk;$('ringsFoot').innerHTML=`${rf>1?`No cenário estimado, gordura ficou <b>${Math.round((rf-1)*100)}%</b> acima da referência.`:'Gordura estimada dentro da referência.'} Calorias estimadas ${rk>1?`<b>+${fmt(W.k-W.nk)} kcal</b> acima`:`<b>${fmt(W.nk-W.k)} kcal</b> abaixo`} na semana. Proteína estimada atingiu a referência em ${week.filter(d=>d.p>=d.needP).length} dos ${week.length} dias. ${week.reduce((a,d)=>a+d.orders.length,0)} pedidos de comida na semana.`;
    const panels=[['Calorias','k','need','kcal'],['Proteína','p','needP','g'],['Carboidrato','c','needC','g'],['Gordura','f','needF','g']];
    $('macroDaily').innerHTML=panels.map(([lab,key,nk,u])=>{const col=MC[lab];const max=Math.max(...week.map(d=>Math.max(d[key],d[nk])))*1.18;let s='';const bw=34,gap=48,Hh=150,base=126;
      week.forEach((d,i)=>{const x=8+i*gap;const h=d[key]/max*100,hn=d[nk]/max*100;const over=d[key]>d[nk];s+=`<rect x="${x}" y="${base-h}" width="${bw}" height="${h}" rx="6" fill="${col}" opacity="${over?1:.32}"/><line x1="${x-4}" y1="${base-hn}" x2="${x+bw+4}" y2="${base-hn}" stroke="#1C2430" stroke-width="2"/><text class="ax" x="${x+bw/2}" y="${base-Math.max(h,hn)-6}" text-anchor="middle" fill="${over?'#1C2430':'#98A1AC'}">${fmt(d[key])}</text><text class="ax" x="${x+bw/2}" y="${Hh-4}" text-anchor="middle">${DOWN[d.dow]}</text>`});
      return `<div><div class="lab"><span style="color:${col};font-weight:500">${lab} (${u})</span><span>${week.filter(d=>d[key]>d[nk]).length} de ${week.length} dias acima</span></div><svg viewBox="0 0 350 ${Hh}">${s}</svg></div>`}).join('')})();
  window.EatIQAnalysis?.render(O);
  if(window.EatIQHabits){const ids=new Set(O.map(o=>String(o.id)));window.EatIQHabits.render((window.__rawO||[]).filter(o=>ids.has(String(o.id))))}
  (function(){const hrs=[7,9,11,12,13,14,17,18,19,20,21,22,23];const g={};let max=1;meals.forEach(o=>{const k=o.dow+'-'+o.hr;g[k]=(g[k]||0)+1;max=Math.max(max,g[k])});let s='<div></div>'+DOWN.map(n=>`<div class="h">${n}</div>`).join('');hrs.forEach(h=>{s+=`<div class="rl">${h}h</div>`;for(let d=0;d<7;d++){const v=g[d+'-'+h]||0;s+=`<div class="cell" style="background:rgba(28,36,48,${(0.05+v/max*0.9).toFixed(2)})" title="${DOWN[d]} ${h}h: ${v}"></div>`}});$('heat').innerHTML=s;
    const late=meals.filter(o=>o.hr>=22);$('heatFoot').innerHTML=`<b>${late.length} pedidos depois das 22h</b>${late.length?`, média de ${fmt(late.reduce((a,o)=>a+o.kOrder,0)/late.length)} kcal por pedido`:''}.`})();
  // --- dinheiro
  const ALLT=O.reduce((a,o)=>a+o.tot,0);
  window.EatIQFinance?.render(O);
  (function(){const cc={};meals.forEach(o=>{cc[o.cat]=cc[o.cat]||{k:0,cost:0,n:0};cc[o.cat].k+=o.kOrder;cc[o.cat].cost+=o.tot;cc[o.cat].n++});const arr=Object.entries(cc).filter(([,v])=>v.n>=3&&v.k>0).map(([n,v])=>[n,v.cost/v.k*1000,v.n]).sort((a,b)=>b[1]-a[1]).slice(0,7);const cmax=arr[0]?arr[0][1]:1;$('costKcal').innerHTML=arr.map(([n,v,k])=>`<li><div><div class="name">${esc(n)}</div><div class="meta">${k} pedidos</div><div class="bar"><i class="${v>120?'mid':''}" style="width:${v/cmax*100}%"></i></div></div><div class="right"><b>${brl(v)}</b><small>por 1.000 kcal</small></div></li>`).join('')||'<li class="meta">Sem dados</li>'})();
  rank('spendRank',meals,o=>o.s,o=>o.tot,v=>`${v.n} pedidos`,brl,v=>brl(v.v/v.n)+' cada',()=>'',8);

  rank('typeRank',O,o=>o.t,o=>o.tot,v=>`${v.n} pedidos · ${brl(v.v/v.n)} cada`,brl,v=>`${Math.round(v.v/ALLT*100)}%`,()=>'',6);
  renderProductRank();
  // --- corpo
  (function(){window.__gxf=null;const last90=days.slice(-90);const surplus=last90.length?last90.reduce((a,d)=>a+(d.k-d.need),0)/last90.length:0;const lastW=days.filter(d=>d.weight).slice(-1)[0];const w0=lastW?lastW.weight:(pf.w||0);if(lastW&&!pf.ok){pf.ok=pf.h>0&&pf.a>0;}const hm=(pf.h||181)/100;
    $('bodySub').textContent=pf.ok?`Perfil · excedente médio ${surplus>=0?'+':''}${fmt(surplus)} kcal/dia nos últimos ${last90.length} dias`:'Preencha o perfil acima';
    $('bodyW').innerHTML=pf.ok?`${w0.toFixed(1).replace('.',',')}<span style="font-size:.32em;color:#B8C0CA;margin-left:6px">kg</span>`:'—';
    const imc=pf.ok?w0/(hm*hm):0;const cls=imc<18.5?'abaixo do peso':(imc<25?'normal':(imc<30?'sobrepeso':'obesidade'));$('bodyImc').innerHTML=pf.ok?`IMC <b>${imc.toFixed(1).replace('.',',')}</b> · ${cls} · ${(hm*100).toFixed(0)} cm`:'';
    const pos=v=>Math.max(2,Math.min(98,(v-15)/(40-15)*100));const a=w0+surplus*182/7700,b=w0+(surplus-pf.cut)*182/7700;
    $('imcTrack').innerHTML=pf.ok?`<i style="left:${pos(imc)}%"></i><i class="ghost" style="left:${pos(a/(hm*hm))}%"></i>`:'';
    const goalW=pf.g||Math.round(24.9*hm*hm*10)/10;$('bodyFoot').innerHTML=pf.ok?`Cenário com as premissas do perfil, em 6 meses: <b>${a.toFixed(1).replace('.',',')} kg</b> se nada mudar (círculo tracejado), <b>${b.toFixed(1).replace('.',',')} kg</b> no cenário com corte de ${fmt(pf.cut)} kcal/dia (editável no perfil). Meta: <b>${goalW.toFixed(1).replace('.',',')} kg</b>.`:'';
    if(!pf.ok){$('forecastChart').innerHTML='<div class="sub">Preencha o perfil para ver o forecast.</div>';return}
    const Wd=760,Hh=260,pad=44,N=27;const gx=i=>pad+i*(Wd-pad-56)/(N-1);const lo=Math.min(b,goalW,w0)-3,hi=Math.max(a,w0)+3;const gy=v=>20+(hi-v)/(hi-lo)*200;let s='';
    const nlo=18.5*hm*hm,nhi=24.9*hm*hm;s+=`<rect x="${pad}" y="${Math.max(20,gy(Math.min(nhi,hi)))}" width="${Wd-pad-56}" height="${Math.max(0,Math.min(gy(Math.max(nlo,lo)),220)-Math.max(20,gy(Math.min(nhi,hi))))}" fill="#E6EFE8"/>`;
    for(let v=Math.ceil(lo);v<=hi;v+=2)s+=`<line x1="${pad}" y1="${gy(v)}" x2="${Wd-56}" y2="${gy(v)}" stroke="#E4E7E2" stroke-dasharray="3 4"/><text class="ax" x="6" y="${gy(v)+4}">${v} kg</text><text class="ax" x="${Wd-50}" y="${gy(v)+4}">IMC ${(v/(hm*hm)).toFixed(1)}</text>`;
    const meas=days.filter(d=>d.weight).slice(-40);if(meas.length>1){const M=meas.length;const gxm=i=>pad+i*(Wd-pad-56)*0.42/(M-1);const gxf=i=>pad+(Wd-pad-56)*0.42+i*(Wd-pad-56)*0.58/(N-1);s+=`<path d="${meas.map((d,i)=>(i?'L':'M')+gxm(i)+' '+gy(Math.min(hi,Math.max(lo,d.weight)))).join(' ')}" fill="none" stroke="#1C2430" stroke-width="2"/>`;window.__gxf=gxf}
    const gxx=window.__gxf||gx;
    let pa='',pb='';for(let i=0;i<N;i++){const wa=w0+surplus*7*i/7700,wb=w0+(surplus-pf.cut)*7*i/7700;pa+=(i?' L':'M')+gxx(i)+' '+gy(wa);pb+=(i?' L':'M')+gxx(i)+' '+gy(wb)}
    s+=`<path d="${pa}" fill="none" stroke="#7A4E6C" stroke-width="2" stroke-dasharray="6 5"/><path d="${pb}" fill="none" stroke="#4E7A5E" stroke-width="2" stroke-dasharray="6 5"/><circle cx="${gxx(0)}" cy="${gy(w0)}" r="5" fill="#1C2430"/><text class="ax" x="${gxx(0)+10}" y="${gy(w0)-10}" fill="#1C2430" font-weight="600">${w0.toFixed(1).replace('.',',')} hoje</text>`;
    s+=`<text class="ax" x="${gxx(N-1)+4}" y="${gy(a)+4}" fill="#7A4E6C" font-weight="600">${a.toFixed(1).replace('.',',')}</text><text class="ax" x="${gxx(N-1)+4}" y="${gy(b)+4}" fill="#4E7A5E" font-weight="600">${b.toFixed(1).replace('.',',')}</text>`;
    const t0=new Date();for(let i=0;i<N;i++){const d=new Date(t0.getTime()+i*7*864e5);if(d.getDate()<=7)s+=`<text class="ax" x="${gxx(i)}" y="${Hh-6}" text-anchor="middle">${MON[d.getMonth()]}</text>`}
    $('forecastChart').innerHTML=`<svg viewBox="0 0 ${Wd} ${Hh}">${s}</svg>`})();
  (function(){const wk=weeks.slice(-30);if(!wk.length){$('satChart').innerHTML='';return}const Wd=1080,Hh=200,pad=44,right=Wd-20,base=170;const gx=i=>pad+i*(right-pad-10)/Math.max(1,wk.length-1);const mx=Math.max(60,...wk.map(w=>w.days.reduce((a,d)=>a+d.f,0)/w.days.length))*1.1;const gy=v=>20+(mx-v)/mx*150;let s='';
    [pf.needF,pf.needF*1.5].forEach((v,i)=>s+=`<line x1="${pad}" y1="${gy(v)}" x2="${right}" y2="${gy(v)}" stroke="#E4E7E2" stroke-dasharray="3 4"/><text class="ax" x="6" y="${gy(v)+4}">${fmt(v)}g</text>`);
    s+=`<text class="ax" x="${pad+4}" y="${gy(pf.needF)-6}" fill="#4E7A5E">sua necessidade de gordura por dia</text>`;
    wk.forEach((w,i)=>{const v=w.days.reduce((a,d)=>a+d.f,0)/w.days.length;const h=base-gy(v);s+=`<rect x="${gx(i)-10}" y="${gy(v)}" width="20" height="${h}" rx="4" fill="${v>pf.needF*1.3?'#7A4E6C':(v>pf.needF?'#D9A441':'#4E7A5E')}"/>`;if(w.d.getDate()<=7)s+=`<text class="ax" x="${gx(i)}" y="${Hh-6}" text-anchor="middle">${MON[w.d.getMonth()]} ${String(w.d.getFullYear()).slice(2)}</text>`});
    $('satChart').innerHTML=`<svg viewBox="0 0 ${Wd} ${Hh}">${s}</svg>`})();
  // --- apple health cruzamentos
  (function(){const hdDays=days.filter(d=>d.hd&&d.hd.kcal_ativas);if(hdDays.length<5){$('scatter').innerHTML='<div class="sub">Importe o Apple Health para ver este cruzamento.</div>';$('scatterFoot').textContent='';$('sleepChart').innerHTML='';$('sleepFoot').textContent='';$('trainChart').innerHTML='';$('trainFoot').textContent='';return}
    const Wd=520,Hh=300,pad=40;const xs=hdDays.map(d=>d.active);const xmin=0,xmax=Math.max(600,...xs)*1.05,ymin=Math.min(...hdDays.map(d=>d.k))*0.9,ymax=Math.max(...hdDays.map(d=>d.k))*1.05;const gx=v=>pad+(v-xmin)/(xmax-xmin)*(Wd-pad-10);const gy=v=>10+(ymax-v)/(ymax-ymin)*(Hh-40);let s='';
    const bmr=(pf.bmr||1800)*1.15;s+=`<line x1="${gx(xmin)}" y1="${gy(bmr)}" x2="${gx(xmax)}" y2="${gy(bmr+xmax)}" stroke="#1C2430" stroke-width="1.5" stroke-dasharray="4 4"/><text class="ax" x="${gx(xmax)-4}" y="${gy(bmr+xmax)-8}" text-anchor="end" fill="#1C2430">equilíbrio</text>`;
    [0.25,0.5,0.75].forEach(f=>{const v=ymin+(ymax-ymin)*f;s+=`<text class="ax" x="4" y="${gy(v)+4}">${fmt(v/100)/10}k</text>`});[0.25,0.5,0.75,1].forEach(f=>{const v=xmax*f;s+=`<text class="ax" x="${gx(v)}" y="${Hh-6}" text-anchor="middle">${fmt(v)} ativas</text>`});
    hdDays.forEach(d=>{const over=d.k>d.need;s+=`<circle cx="${gx(d.active)}" cy="${gy(d.k)}" r="${d.train?4.5:3.5}" fill="${over?'#D9A441':'#4E7A5E'}" opacity="${d.train?.9:.55}" ${d.train?'stroke="#1C2430" stroke-width="1"':''}/>`});
    $('scatter').innerHTML=`<svg viewBox="0 0 ${Wd} ${Hh}">${s}</svg>`;const over=hdDays.filter(d=>d.k>d.need).length;const tr=hdDays.filter(d=>d.train),nt=hdDays.filter(d=>!d.train);
    const dlt=tr.length&&nt.length?tr.reduce((a,d)=>a+d.k,0)/tr.length-nt.reduce((a,d)=>a+d.k,0)/nt.length:0;$('scatterFoot').innerHTML=`<b>${Math.round(over/hdDays.length*100)}% dos dias</b> acima do equilíbrio em ${hdDays.length} dias com Health. ${tr.length?`Pontos com borda são dias de treino: você come em média <b>${dlt>=0?'+':''}${fmt(dlt)} kcal</b> nesses dias.`:''}`;
    const sd=days.filter(d=>d.sleep);const g=[['sem pedido',d=>!d.orders.length],['até 21h',d=>d.orders.length&&d.lastHr<22],['22h ou depois',d=>d.lastHr>=22]];const vals=g.map(([n,f])=>{const ds=sd.filter(f);return [n,ds.length?ds.reduce((a,d)=>a+d.sleep,0)/ds.length:0,ds.length]});
    if(sd.length>5){let t='';vals.forEach(([n,v,c],i)=>{const x=i*80+40;const h=Math.max(0,(v-4)/4*100);t+=`<rect x="${x-22}" y="${125-h}" width="44" height="${h}" rx="6" fill="${i===2?'#7A4E6C':'#4E7A5E'}"/><text class="ax" x="${x}" y="${125-h-6}" text-anchor="middle" fill="#1C2430">${v.toFixed(1).replace('.',',')}h</text><text class="ax" x="${x}" y="142" text-anchor="middle">${n}</text>`});$('sleepChart').innerHTML=`<svg viewBox="0 0 240 150">${t}</svg>`;$('sleepFoot').innerHTML=vals[2][2]&&vals[1][2]?`Nas noites com pedido depois das 22h, houve ${vals[1][1]-vals[2][1]>0?'menos':'mais'} <b>${Math.abs(vals[1][1]-vals[2][1]).toFixed(1).replace('.',',')}h de sono</b> na média; associação, sem estabelecer causa (${vals[2][2]} noites).`:'Poucas noites com pedido tarde para comparar.'}else{$('sleepChart').innerHTML='<div class="sub">Sem dados de sono no Health.</div>';$('sleepFoot').textContent=''}
    if(tr.length&&nt.length){const avg=(arr,k)=>arr.reduce((a,d)=>a+d[k],0)/arr.length;const rows=[['Consumido',avg(tr,'k'),avg(nt,'k')],['Gasto',avg(tr,'need'),avg(nt,'need')],['Balanço',avg(tr,'k')-avg(tr,'need'),avg(nt,'k')-avg(nt,'need')]];const max=Math.max(...rows.flatMap(r=>[Math.abs(r[1]),Math.abs(r[2])]))||1;
      $('trainChart').innerHTML=`<svg viewBox="0 0 240 150">`+rows.map(([n,a,b],i)=>{const y=i*46+8;const wa=Math.abs(a)/max*150,wb=Math.abs(b)/max*150;return `<text class="ax" x="0" y="${y+10}" fill="#1C2430">${n}</text><rect x="70" y="${y}" width="${wa}" height="12" rx="3" fill="#4E7A5E"/><text class="ax" x="${72+wa}" y="${y+10}">${a>0&&i===2?'+':''}${fmt(a)}</text><rect x="70" y="${y+16}" width="${wb}" height="12" rx="3" fill="#E4E7E2"/><text class="ax" x="${72+wb}" y="${y+26}">${b>0&&i===2?'+':''}${fmt(b)}</text>`}).join('')+`</svg><div class="legend"><span><i style="background:#4E7A5E"></i>Com treino</span><span><i style="background:#E4E7E2"></i>Sem treino</span></div>`;
      const bt=rows[2][1],bn=rows[2][2];$('trainFoot').innerHTML=bt<bn-100?`Dias de treino fecham <b>${fmt(bn-bt)} kcal</b> melhor que os outros.`:'Treinar não está fechando o dia no negativo: o excedente dos dias de treino é parecido com o dos outros.'}else{$('trainChart').innerHTML='<div class="sub">Sem treinos registrados no período.</div>';$('trainFoot').textContent=''}})();
  // --- exames
  renderLabs(meals);
  // --- tabela
  ROWS=O.slice().reverse();drawTable();}

// ---------- labs ----------
const LABS=[['ldl','Colesterol LDL','< 100',v=>v<100?'ok':(v<130?'warn':'hi')],['hdl','Colesterol HDL','> 40',v=>v>40?'ok':'warn'],['tg','Triglicérides','< 150',v=>v<150?'ok':(v<200?'warn':'hi')],['gli','Glicemia de jejum','70 a 99',v=>v<100?'ok':(v<126?'warn':'hi')],['uri','Ácido úrico','< 7,0',v=>v<7?'ok':'warn']];
function labVals(){return {ldl:PROF.ldl,hdl:PROF.hdl,tg:PROF.tg,gli:PROF.gli,uri:PROF.uri}}
function renderLabs(meals){const s=labVals();const LBL={ok:'ok',warn:'limítrofe',hi:'acima'};
  $('labRows').innerHTML=LABS.map(([k,n,ref,f])=>{const v=+s[k]||0;const st=v?f(v):null;return `<div class="lab-row"><div>${n}<div class="ref">ref. ${ref}</div></div><input type="number" step="0.1" data-k="${k}" value="${s[k]||''}" placeholder="—"><span class="pill ${st||''}" style="${st?'':'visibility:hidden'}">${st?LBL[st]:''}</span></div>`}).join('');
  $('labRows').querySelectorAll('input').forEach(i=>i.addEventListener('change',async()=>{PROF[i.dataset.k]=i.value===''?null:+i.value;renderLabs(meals);const ok=await saveProfile();$('labSaved').textContent=ok?'Salvo':'Não consegui salvar'}));
  const rules=[];const n=Math.max(1,meals.length);const fat=meals.reduce((a,o)=>a+o.f,0)/n;const alc=meals.filter(o=>o.drink==='alcool').length,ref=meals.filter(o=>o.drink==='refri').length;
  const top=Object.entries(meals.reduce((c,o)=>{c[o.cat]=(c[o.cat]||0)+o.f;return c},{})).sort((a,b)=>b[1]-a[1]).slice(0,2).map(x=>x[0]).join(' e ');
  if(+s.ldl>=100)rules.push(['Limite de gordura saturada: 18g/dia',`LDL em ${s.ldl}. Seus pedidos têm em média ${fmt(fat)}g de gordura na porção pessoal; ${top||'churrasco e hambúrguer'} são os que mais pesam. Aviso antes de confirmar nesses.`]);
  if(+s.tg>=150)rules.push(['Refrigerante e álcool contam contra triglicérides',`Triglicérides em ${s.tg}. ${ref} pedidos com refrigerante e ${alc} com álcool no período. Sugerir água com gás nos combos.`]);
  if(+s.gli>=100)rules.push(['Menos carboidrato refinado à noite',`Glicemia em ${s.gli}. Pizza, massa e lanche depois das 21h ganham alerta; priorizar proteína e vegetais no jantar.`]);
  if(+s.uri>=7)rules.push(['Ácido úrico: menos cerveja, miúdos e frutos do mar em excesso',`Ácido úrico em ${s.uri}. ${meals.filter(o=>o.cat==='Frutos do mar').length} pedidos de frutos do mar no período.`]);
  if(+s.hdl&&+s.hdl<=40)rules.push(['HDL baixo: peixe gordo e azeite sobem no ranking',`HDL em ${s.hdl}. Salmão, sardinha e pratos com azeite ganham prioridade na recomendação.`]);
  if(!rules.length)rules.push([Object.keys(s).some(k=>s[k])?'Nenhum marcador fora da faixa':'Digite seus exames ao lado','Com tudo na faixa, as regras ficam em proteína por caloria e horário dos pedidos. Preencha os valores para gerar regras específicas.']);
  $('rules').innerHTML=rules.map(([b,t])=>`<div class="rule"><i></i><div><b>${b}</b><span>${t}</span></div></div>`).join('')}

// ---------- table ----------
let tablePage=0;
function drawTable(){const q=($('q').value||'').toLowerCase();const matches=ROWS.filter(o=>!q||(o.s+' '+o.t+' '+o.tt+' '+o.p+' '+o.items).toLowerCase().includes(q));tablePage=Math.max(0,Math.min(tablePage,Math.ceil(matches.length/100)-1));const rows=matches.slice(tablePage*100,(tablePage+1)*100);
  $('tableSub').textContent=`${matches.length} pedidos encontrados · página ${tablePage+1} de ${Math.max(1,Math.ceil(matches.length/100))}`;$('prevPage').disabled=tablePage===0;$('nextPage').disabled=(tablePage+1)*100>=matches.length;
  $('tbody').innerHTML=rows.map(o=>`<tr><td>${o.date.toLocaleDateString('pt-BR')} ${o.date.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</td><td><span class="tag ${o.p==='iFood'?'if':'rp'}">${esc(o.p)}</span></td><td>${esc(o.s)}</td><td style="max-width:320px;overflow:hidden;text-overflow:ellipsis">${esc(o.items)}</td><td>${esc(o.tt)}</td><td class="r">${brl2(o.sub)}</td><td class="r">${brl2(o.fee+o.tip)}</td><td class="r">${o.disc?'-'+brl2(o.disc):''}</td><td class="r"><b>${brl2(o.tot)}</b></td><td class="r">${o.kOrder||''}</td><td class="r">${o.peso||''}</td><td class="r">${o.conf>=65?'Base conhecida':o.conf>=30?'Porção estimada':o.conf>0?'Baixa':'—'}</td></tr>`).join('')}
$('q').addEventListener('input',()=>{tablePage=0;drawTable()});
$('prevPage').onclick=()=>{tablePage--;drawTable()};$('nextPage').onclick=()=>{tablePage++;drawTable()};
if(location.hash==='#cadastro'){showView('up');history.replaceState(null,'',location.pathname)}
if(session&&!recovering)boot();
