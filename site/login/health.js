// Stream Apple Health XML; only daily aggregates leave the browser.
window.EatIQHealth = (() => {
  const attr=(tag,key)=>tag.match(new RegExp('\\b'+key+'="([^"]*)"'))?.[1]??null;
  const numeric=v=>v!==null&&v!==''&&Number.isFinite(+v)?+v:null;
  function parser(){
    const agg=new Map();let carry='',records=0;
    const bucket=day=>{if(!agg.has(day))agg.set(day,{});return agg.get(day)};
    const add=(d,k,src,v)=>{if(!Number.isFinite(v)||v<0)return;const o=bucket(d);o[k]??=new Map();o[k].set(src,(o[k].get(src)||0)+v)};
    function tag(t){
      const start=attr(t,'startDate'),d=start?.slice(0,10);if(!d||!/^\d{4}-\d{2}-\d{2}$/.test(d))return;
      const type=attr(t,'type'),src=attr(t,'sourceName')||'unknown',unit=attr(t,'unit'),v=numeric(attr(t,'value'));
      if(t.startsWith('<Workout')){const n=numeric(attr(t,'duration')),u=attr(t,'durationUnit');if(n!==null&&['min','s','hr','h'].includes(u))add(d,'treino',src,n*(u==='s'?1/60:/h/.test(u)?60:1));return}
      records++;
      if(type==='HKQuantityTypeIdentifierBodyMass'&&v!==null){const kg=unit==='kg'?v:unit==='lb'?v*0.45359237:unit==='g'?v/1000:null;if(kg>0&&kg<1000){const o=bucket(d);if(!o.weightAt||start>o.weightAt){o.weightAt=start;o.peso=kg}}}
      else if(type==='HKQuantityTypeIdentifierStepCount'&&unit==='count'&&v!==null)add(d,'passos',src,v);
      else if(['HKQuantityTypeIdentifierActiveEnergyBurned','HKQuantityTypeIdentifierBasalEnergyBurned'].includes(type)&&v!==null){const kcal=unit==='kcal'?v:unit==='kJ'?v/4.184:null;if(kcal!==null)add(d,type.includes('Active')?'ativas':'basal',src,kcal)}
      else if(type==='HKCategoryTypeIdentifierSleepAnalysis'&&/Asleep/.test(attr(t,'value')||'')){
        const end=attr(t,'endDate'),a=Date.parse(start),b=Date.parse(end);if(Number.isFinite(a)&&Number.isFinite(b)&&b>a&&b-a<864e5){const o=bucket(end.slice(0,10));o.sleep??=new Map();if(!o.sleep.has(src))o.sleep.set(src,[]);o.sleep.get(src).push([a,b])}
      }
    }
    function feed(text,final=false){carry+=text;const re=/<(?:Record|Workout)\b[^>]*>/g;let m,last=0;while((m=re.exec(carry))){tag(m[0]);last=re.lastIndex}carry=carry.slice(last);const i=carry.lastIndexOf('<');carry=i>=0?carry.slice(i):'';if(carry.length>1024*1024)throw new Error('Registro XML maior que o limite.');if(final&&/^<(Record|Workout)\b/.test(carry)&&!carry.includes('>'))throw new Error('XML incompleto.');}
    const max=map=>map?.size?Math.round(Math.max(...map.values())):null;
    const minutes=intervals=>{intervals.sort((a,b)=>a[0]-b[0]);let total=0,end=0;for(const [a,b] of intervals){total+=Math.max(0,b-Math.max(a,end));end=Math.max(end,b)}return total/60000};
    const rows=()=>[...agg].map(([dia,o])=>({dia,passos:max(o.passos),kcal_ativas:max(o.ativas),kcal_basal:max(o.basal),peso:o.peso??null,sono_min:o.sleep?Math.round(Math.max(...[...o.sleep.values()].map(minutes))):null,treino_min:max(o.treino),fonte:'export'})).sort((a,b)=>a.dia.localeCompare(b.dia));
    return {feed,rows,get records(){return records}};
  }
  async function read(file){
    const p=parser();let bytes=0;const decoder=new TextDecoder();const feed=chunk=>{bytes+=chunk.length;if(bytes>1024*1024*1024)throw new Error('XML descompactado maior que 1 GB.');p.feed(decoder.decode(chunk,{stream:true}))};
    if(/\.zip$/i.test(file.name)){
      let found=false,completed=false,error=null;
      const unzip=new fflate.Unzip(entry=>{if(!/(^|\/)export\.xml$/i.test(entry.name))return;if(found){error=new Error('ZIP contém mais de um export.xml.');return}found=true;entry.ondata=(err,chunk,final)=>{if(err){error=err;return}try{feed(chunk);if(final)completed=true}catch(e){error=e}};entry.start()});
      unzip.register(fflate.UnzipInflate);
      const rd=file.stream().getReader();try{for(;;){const {done,value}=await rd.read();if(done){unzip.push(new Uint8Array(),true);break}unzip.push(value);if(error)throw error;await new Promise(r=>setTimeout(r,0))}}finally{await rd.cancel()}
      if(error)throw error;if(!found)throw new Error('ZIP sem export.xml. Use a exportação do Apple Health.');if(!completed)throw new Error('ZIP incompleto ou corrompido.');
    }else if(/\.xml$/i.test(file.name)){
      const rd=file.stream().getReader();try{for(;;){const {done,value}=await rd.read();if(done)break;feed(value)}}finally{await rd.cancel()}
    }else throw new Error('Use um arquivo ZIP ou XML do Apple Health.');
    p.feed(decoder.decode(),true);const rows=p.rows();if(!rows.length)throw new Error('Nenhum registro compatível encontrado.');return {rows,records:p.records};
  }
  return {parser,read};
})();
