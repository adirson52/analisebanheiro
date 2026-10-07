/* Optional, authenticated product usage. No text fields, passwords or search queries. */
(function(){
 'use strict';
 const cfg=window.FCUAccessConfig;
 if(!cfg||window.FCUUsage)return;
 const endpoint='https://preditor-fcu-master.vercel.app/api/access',prefix='fcu-usage-v1:'+cfg.id+':',maxAge=7*86400000;
 let client,user=null,flushing=false,lastInput=Date.now(),lastBeat=Date.now(),retryAt=0,failures=0,startedUser=null;
 const consent=()=>{try{return navigator.doNotTrack!=='1'&&!navigator.globalPrivacyControl&&JSON.parse(localStorage.getItem('fcu_privacy_v1')||'null')?.choice==='analytics';}catch{return false;}};
 function read(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')||fallback;}catch{return fallback;}}
 function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{/* A full/disabled local store must not block the map. */}}
 function queue(uid){const value=read(prefix+uid,[]);return Array.isArray(value)?value.filter(e=>e&&Date.parse(e.occurred_at)>Date.now()-maxAge).slice(-200):[];}
 function clear(){if(user)try{localStorage.removeItem(prefix+user.id);}catch{}}
 function session(){
  const key=prefix+'session:'+user.id;let value;try{value=JSON.parse(sessionStorage.getItem(key)||'null');}catch{}
  if(!value||Date.now()-value.at>1800000)value={id:crypto.randomUUID(),at:Date.now()};
  value.at=Date.now();try{sessionStorage.setItem(key,JSON.stringify(value));}catch{}return value.id;
 }
 function record(name,detail={}){
  if(!user||!consent()){clear();return;}
  const event={id:crypto.randomUUID(),session_id:session(),event_name:name,path:location.pathname,occurred_at:new Date().toISOString(),device_type:innerWidth<768?'mobile':innerWidth<1100?'tablet':'desktop',detail};
  write(prefix+user.id,[...queue(user.id),event].slice(-200));
 }
 async function flush(){
  if(!user||!consent()){clear();return;}if(flushing||navigator.onLine===false||Date.now()<retryAt)return;
  const uid=user.id,events=queue(uid).slice(0,5);if(!events.length)return;flushing=true;
  try{
   const auth=(await client.auth.getSession()).data.session;
   if(!auth||auth.user.id!==uid||user?.id!==uid||!consent())return;
   const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth.access_token},body:JSON.stringify({action:'event',product_id:cfg.id,analytics_consent:true,events}),signal:AbortSignal.timeout(20000),keepalive:true});
   const result=await r.json();
   if(r.ok&&result.recorded===true&&Array.isArray(result.ids)){
    write(prefix+uid,queue(uid).filter(e=>!result.ids.includes(e.id)));failures=0;retryAt=0;
   }else{failures++;retryAt=Date.now()+Math.min(60000,5000*2**Math.min(failures,4));}
  }catch{failures++;retryAt=Date.now()+Math.min(60000,5000*2**Math.min(failures,4));}finally{flushing=false;}
 }
 function setUser(next){
  if(user?.id!==next?.id){if(!next)clear();startedUser=null;}
  user=next;if(!user||!consent()){clear();return;}
  if(startedUser!==user.id){startedUser=user.id;record('session_started');record('page_view');}flush();
 }
 window.FCUUsage={record,flush};
 function start(){
  client=window.FCUAccessClient;if(!client)return;
  client.auth.getSession().then(r=>setUser(r.data.session?.user||null));
  client.auth.onAuthStateChange((_event,s)=>setTimeout(()=>setUser(s?.user||null),0));
  for(const name of ['pointerdown','keydown','touchstart'])document.addEventListener(name,()=>lastInput=Date.now(),{passive:true});
  document.addEventListener('click',e=>{
   const b=e.target.closest('button,a');if(!b)return;
   if(b.dataset.tab)record('section_view',{section:b.dataset.tab});
   else if(b.dataset.mapView||['view2d','view3d'].includes(b.id))record('view_mode_changed',{view:b.dataset.mapView||b.id});
   else if(b.dataset.mapBase)record('layer_changed',{control:'basemap',value:b.dataset.mapBase});
   else if(b.dataset.model||b.dataset.method)record('experiment_changed',{experiment:b.dataset.model||b.dataset.method});
   else if(b.tagName==='A'&&(b.hasAttribute('download')||b.pathname?.startsWith('/downloads/'))){const u=new URL(b.href,location.origin);if(u.origin===location.origin)record('download',{target:u.pathname});}
  });
  document.addEventListener('change',e=>{
   const el=e.target;
   if(el.tagName==='SELECT'&&!el.closest('form'))record('layer_changed',{control:el.id||'selector',value:el.value});
   else if(el.type==='checkbox'&&!el.closest('form'))record('layer_changed',{control:el.id||'layer',value:String(el.checked)});
  });
  window.addEventListener('online',()=>{retryAt=0;flush();});
  window.addEventListener('storage',e=>{if(e.key==='fcu_privacy_v1'){if(!consent())clear();else setUser(user);}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();});window.addEventListener('pagehide',flush);
  setInterval(flush,5000);
  setInterval(()=>{const now=Date.now(),seconds=Math.min(60,Math.round((now-lastBeat)/1000));lastBeat=now;if(!document.hidden&&now-lastInput<120000){record('session_heartbeat',{active_seconds:seconds});flush();}},60000);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
