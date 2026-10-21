import {CHANNEL,normalizeThreads} from './extract';
// Observe copies of existing responses only. Never replay, navigate or mutate a request.
const latest=new Map<string,ReturnType<typeof normalizeThreads>[number]>();
window.addEventListener('message',e=>{if(e.source===window&&e.origin===location.origin&&e.data?.channel===CHANNEL&&e.data?.request==='snapshot')window.postMessage({channel:CHANNEL,snapshots:[...latest.values()]},location.origin);});
const emit = (text:string) => {
 if (text.length>8_000_000) return;
 try {
  const clean=text.replace(/^for\s*\(;;\);\s*/, '');
  for (const line of clean.split('\n')) {
   if (!line.trim()) continue;
   const snapshots=normalizeThreads(JSON.parse(line));
   for(const s of snapshots){latest.set(s.thread,s);if(latest.size>20)latest.delete(latest.keys().next().value!);}
   if(snapshots.length) window.postMessage({channel:CHANNEL,snapshots},location.origin);
  }
 } catch { /* Non-JSON or unrelated response. */ }
};
const relevant=(url:string)=>{try{const u=new URL(url,location.href);return u.origin===location.origin && /\/graphql|\/api\/v1\/direct\//.test(u.pathname);}catch{return false;}};
const originalFetch=window.fetch;
window.fetch=function(...args:Parameters<typeof fetch>){
 const result=Reflect.apply(originalFetch,this,args);
 const url=typeof args[0]==='string'?args[0]:args[0] instanceof URL?args[0].href:args[0].url;
 if(relevant(url)) void result.then(r=>r.clone().text()).then(emit).catch(()=>{});
 return result;
};
const originalOpen=XMLHttpRequest.prototype.open;
const urls=new WeakMap<XMLHttpRequest,string>();
XMLHttpRequest.prototype.open=function(this:XMLHttpRequest,method:string,url:string|URL,...rest:any[]){
 urls.set(this,String(url));
 return Reflect.apply(originalOpen,this,[method,url,...rest] as any);
} as typeof originalOpen;
const originalSend=XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send=function(body?:Document|XMLHttpRequestBodyInit|null){
 if(relevant(urls.get(this)||'')) this.addEventListener('load',()=>{try{if(this.responseType===''||this.responseType==='text')emit(this.responseText);else if(this.responseType==='json')emit(JSON.stringify(this.response));}catch{}},{once:true});
 return Reflect.apply(originalSend,this,[body]);
};
