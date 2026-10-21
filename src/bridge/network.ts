import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { Agent, fetch } from 'undici';
import * as cheerio from 'cheerio';
import type { Source } from '../shared/types';
export function publicAddress(ip:string):boolean {
 if (isIP(ip)===6) return !(/^(::|fc|fd|fe[89ab]|ff|2001:db8)/i.test(ip));
 if(isIP(ip)!==4)return false;
 const [a,b]=ip.split('.').map(Number);
 return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19));
}
export function allowedMedia(url:string):boolean {
 try{const u=new URL(url);return u.protocol==='https:' && !u.username&&!u.password && !u.port && /(^|\.)(cdninstagram\.com|fbcdn\.net)$/.test(u.hostname);}catch{return false;}
}
export async function publicFetch(url:string,allowed:(url:string)=>boolean,signal?:AbortSignal,maxBytes=2_000_000):Promise<{body:Buffer;mime:string;url:string}> {
 for(let i=0;i<4;i++){
  const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.port||!allowed(u.href))throw new Error('Địa chỉ ngoài website/media được phép.');
  const addresses=await lookup(u.hostname,{all:true});
  if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw new Error('Không truy cập địa chỉ nội bộ.');
  const selected=addresses[0];
  const agent=new Agent({connect:{lookup:((_host:any,options:any,callback:any)=>{if(options?.all)callback(null,[selected]);else callback(null,selected.address,selected.family);}) as any}});
  try{
   const response=await fetch(u,{dispatcher:agent,redirect:'manual',signal:AbortSignal.any([signal||new AbortController().signal,AbortSignal.timeout(15000)]),headers:{'User-Agent':'IGShopAssistant/0.1 (+public product lookup)'}});
   if(response.status>=300&&response.status<400){const target=response.headers.get('location');await response.body?.cancel();if(!target)throw new Error('Chuyển hướng không hợp lệ.');url=new URL(target,u).href;continue;}
   if(!response.ok)throw new Error(`Website trả HTTP ${response.status}.`);
   if(Number(response.headers.get('content-length'))>maxBytes){await response.body?.cancel();throw new Error('Nội dung vượt giới hạn dung lượng.');}
   const chunks:Uint8Array[]=[];let size=0;
   if(response.body)for await(const chunk of response.body){size+=chunk.length;if(size>maxBytes)throw new Error('Nội dung vượt giới hạn dung lượng.');chunks.push(chunk);}
   return {body:Buffer.concat(chunks),mime:response.headers.get('content-type')||'',url:u.href};
  }finally{await agent.close();}
 }
 throw new Error('Quá nhiều chuyển hướng.');
}
export function websiteScope(website:string){const root=new URL(website);if(root.protocol!=='https:'||root.username||root.password||root.port)throw new Error('Website phải dùng HTTPS công khai.');return (url:string)=>{try{return new URL(url).hostname===root.hostname;}catch{return false;}};}
export async function research(website:string,terms:string[],signal:AbortSignal):Promise<Source[]> {
 const allowed=websiteScope(website),origin=new URL(website).origin;
 const root=await publicFetch(website,allowed,signal);
 const $=cheerio.load(root.body.toString('utf8'));
 let candidates=[...new Set($('a[href]').toArray().map(a=>{try{return new URL($(a).attr('href')!,root.url).href.split('#')[0];}catch{return '';}}).filter(u=>u&&allowed(u)))];
 try{
  const sitemap=await publicFetch(`${origin}/sitemap.xml`,allowed,signal);
  const xml=cheerio.load(sitemap.body.toString('utf8'),{xmlMode:true});
  const locs=xml('loc').toArray().map(n=>xml(n).text()).filter(allowed);
  const isSitemap=(u:string)=>new URL(u).pathname.endsWith('.xml');
  candidates.push(...locs.filter(u=>!isSitemap(u)));
  for(const sub of locs.filter(isSitemap).slice(0,2)){
   const page=await publicFetch(sub,allowed,signal);const x=cheerio.load(page.body.toString('utf8'),{xmlMode:true});candidates.push(...x('loc').toArray().map(n=>x(n).text()).filter(allowed));
  }
 }catch(error){if(signal.aborted)throw error;}
 const words=terms.join(' ').toLowerCase().split(/\s+/).filter(w=>w.length>2);
 const score=(u:string)=>words.reduce((n,w)=>n+(decodeURI(u).toLowerCase().includes(w)?4:0),0)+(/product|shipping|return|policy|faq/i.test(u)?1:0);
 candidates=[...new Set(candidates)].filter(u=>u!==root.url&&!/\/cart|\/checkout|\/account|\.(jpg|png|pdf|zip)(\?|$)/i.test(u)).sort((a,b)=>score(b)-score(a)).slice(0,5);
 const pages=[root];
 for(const url of candidates){try{pages.push(await publicFetch(url,allowed,signal));}catch(error){if(signal.aborted)throw error;}}
 return pages.filter(p=>/html|text/i.test(p.mime)).map(p=>{const d=cheerio.load(p.body.toString('utf8'));const title=d('title').text();d('script,style,nav,footer,header,noscript,svg,form').remove();return {url:p.url,title,text:(d('main').length?d('main'):d('body')).text().replace(/\s+/g,' ').slice(0,18000),fetchedAt:Date.now()};});
}
