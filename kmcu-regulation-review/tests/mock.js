// 테스트용 window.claude 모의 객체: db(메모리, 실시간 구독), sample(AI), downloads, user
(function(){
  const store=new Map(); const subs=new Set();
  window.__log={prompts:[],downloads:[],writes:0};
  const clone=o=>JSON.parse(JSON.stringify(o));
  function snapDoc(path){const v=store.get(path);return{id:path.split('/').pop(),exists:!!v,data:()=>v?clone(v):undefined,metadata:{fromCache:false,hasPendingWrites:false}}}
  function notify(){for(const s of subs)setTimeout(s,0)}
  function query(col,opts){
    return{
      where(){return query(col,opts)},
      orderBy(f,d){return query(col,{...opts,f,d})},
      limit(n){return query(col,{...opts,n})},
      async get(){return run()},
      onSnapshot(next){const fn=()=>next(run());subs.add(fn);setTimeout(fn,30);return()=>subs.delete(fn)},
      doc(id){return docRef(col+'/'+(id||Math.random().toString(36).slice(2)))},
      async add(d){const r=docRef(col+'/'+Math.random().toString(36).slice(2));await r.set(d);return r}
    };
    function run(){let ds=[...store.keys()].filter(k=>k.startsWith(col+'/')&&k.split('/').length===col.split('/').length+1).map(snapDoc);
      if(opts.f)ds.sort((a,b)=>{const x=a.data()[opts.f],y=b.data()[opts.f];return (x>y?1:x<y?-1:0)*(opts.d==='desc'?-1:1)});
      if(opts.n)ds=ds.slice(0,opts.n);return{docs:ds,size:ds.length,empty:!ds.length,docChanges:()=>[],metadata:{fromCache:false,hasPendingWrites:false}}}
  }
  function docRef(path){
    if(path.split('/').length%2)throw new TypeError('doc path needs even segments: '+path);
    return{id:path.split('/').pop(),path,
      async get(){return snapDoc(path)},
      async set(d){if(JSON.stringify(d).length>256*1024)throw{code:'invalid_argument',message:'too big'};window.__log.writes++;store.set(path,clone(d));notify()},
      async update(d){store.set(path,{...store.get(path),...clone(d)});notify()},
      async delete(){store.delete(path);notify()},
      onSnapshot(next){const fn=()=>next(snapDoc(path));subs.add(fn);setTimeout(fn,30);return()=>subs.delete(fn)},
      collection(p){return query(path+'/'+p,{})}};
  }
  const db={doc:docRef,collection:c=>{if(c.split('/').length%2===0)throw new TypeError('collection odd');return query(c,{})}};
  async function sampleFn(input,opts){window.__log.prompts.push({input,opts});return{text:JSON.stringify(window.__answer(input)),truncated:false}}
  sampleFn.json=async(input,opts)=>{window.__log.prompts.push({input,opts:{modelTier:opts&&opts.modelTier,tools:opts&&opts.tools?opts.tools.map(t=>t.name):null}});await new Promise(r=>setTimeout(r,300));
    if(opts&&opts.tools){const ts=Object.fromEntries(opts.tools.map(t=>[t.name,t]));
      const r1=await ts.search_law.execute({query:'고등교육법 시행령'});const mst=JSON.parse(r1).laws[0].mst;
      const r2=await ts.get_law_text.execute({mst,jo:'제19조'});window.__lawToolOut=r2;
      return{lawSummary:'학사운영규정의 휴학 기간이 고등교육법 시행령 위임 범위와 학칙 기준을 벗어납니다.',conflicts:[{type:'상위법 상충',severity:'높음',title:'휴학 기간 규정의 상위법 정합성',regA:'(예시) 학사운영규정',articleA:'제12조 제1항',textA:'일반휴학 기간은 통산 4년을 초과할 수 없다.',regB:'고등교육법 시행령',articleB:'제19조',textB:JSON.parse(r2).text,lawDate:'2026.03.01',issue:'시행령이 학칙에 위임한 사항을 하위 규정이 다르게 정함',recommendation:'학칙 기준(3년)으로 통일'}]}}
    return window.__answer(input)};
  sampleFn.limits=async()=>({images:false});
  window.__answer=function(input){
    if(input.includes('신구조문대비표'))return{title:'휴학 기간 상한 일치화 개정안',rows:[{reg:'(예시) 학사운영규정',article:'제12조 제1항',current:'일반휴학 기간은 통산 4년을 초과할 수 없다.',revised:'일반휴학 기간은 통산 3년을 초과할 수 없다.',reason:'학칙 제35조 제2항과 일치'},{reg:'(예시) 학사운영규정',article:'부칙',current:'(신설)',revised:'이 규정은 공포한 날부터 시행한다.',reason:'시행일 명시'}],note:'재학생 경과조치 필요 여부 검토'};
    return{summary:'학칙과 학사운영규정 사이에 휴학 기간과 성적 등급 체계가 서로 다릅니다. 학과장·학과주임 용어가 혼용되며, 장학위원회 위원장 직위가 현행 조직표와 다릅니다.',
      conflicts:[{type:'위계 위반',severity:'높음',title:'휴학 기간 상한 불일치',regA:'(예시) 학칙',articleA:'제35조 제2항',textA:'휴학 기간은 통산 3년을 초과할 수 없다.',regB:'(예시) 학사운영규정',articleB:'제12조 제1항',textB:'일반휴학 기간은 통산 4년을 초과할 수 없다.',issue:'하위 규정이 학칙보다 긴 휴학을 허용합니다.',recommendation:'학사운영규정을 3년으로 개정'},
        {type:'상충',severity:'중간',title:'성적 최고 등급 차이',regA:'(예시) 학칙',articleA:'제41조',textA:'A+부터 F까지로 평가',regB:'(예시) 학사운영규정',articleB:'제18조',textB:'A부터 F까지로 평가',issue:'A+ 등급 존재 여부가 다릅니다.',recommendation:'학사운영규정에 A+ 반영'}],
      terms:[{standard:'학과장',variants:['학과주임'],regs:['(예시) 학사운영규정','(예시) 장학금지급규정'],note:'학칙과 다수 규정이 학과장 사용'}],
      orgs:[{found:'학생복지처장',suggested:'학생처장',locations:['(예시) 장학금지급규정 제5조'],basis:'기준 조직표에 학생처'}, {found:'교무과',suggested:'교무처',locations:['(예시) 학사운영규정 제12조'],basis:'기준 조직표에 교무처'}]};
  };
  const downloads={save:async({filename,data})=>{const arr=data instanceof Uint8Array?Array.from(data):null;window.__log.downloads.push({filename,len:data.length,bytes:arr});return{status:'saved'}}};
  window.__log.law=[];
  const LAWDB={'고등교육법':{mst:'270001',arts:{'제23조':'제23조(학점의 인정 등)…','제24조':'제24조(분교)…'}},'고등교육법 시행령':{mst:'270002',arts:{'제19조':'제19조(휴학) ① 학생은 … 휴학할 수 있다. 다만 일반휴학 기간은 학칙으로 정하되 …','제11조':'제11조(학기) 학기는 매 학년도 2학기 이상으로 한다.'}}};
  const mcp={
    listTools:async(server)=>({servers:server&&server!=='Korean Law'?[]:[{server:'Korean Law',authStatus:'connected',tools:[{name:'search_law',description:''},{name:'get_law_text',description:''}]}]}),
    describeTool:async(server,tool)=>({name:tool,description:tool==='search_law'?'법령 검색':'조문 조회',inputSchema:tool==='search_law'?{type:'object',properties:{query:{type:'string'}},required:['query']}:{type:'object',properties:{mst:{type:'string'},jo:{type:'string'}}}}),
    callTool:async(server,tool,input)=>{window.__log.law.push({tool,input});
      if(tool==='search_law'){const k=Object.keys(LAWDB).find(n=>n===input.query)||Object.keys(LAWDB).find(n=>input.query.includes(n));return{content:[],payload:k?{laws:[{name:k,mst:LAWDB[k].mst,efYd:'20260301'}]}:{laws:[]}}}
      if(tool==='get_law_text'){const k=Object.keys(LAWDB).find(n=>LAWDB[n].mst===input.mst);if(!k)throw{code:'tool_error',message:'not found'};return{content:[],payload:{law:k,jo:input.jo,text:LAWDB[k].arts[input.jo]||'(조문 없음)'}}}
      throw{code:'not_in_manifest'}}};
  const user={can:async()=>true,id:async()=>'u1',canEdit:async()=>true,isOwner:async()=>true};
  const caps={db,sample:sampleFn,downloads,user,mcp};
  window.claude={use:n=>new Promise(r=>setTimeout(()=>r(caps[n]||null),50))};
})();
