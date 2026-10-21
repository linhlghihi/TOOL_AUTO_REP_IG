import { SnapshotSchema, type Message, type Snapshot } from '../shared/types';
export const CHANNEL = 'ig-shop-assistant:observed:v1';
export function routeThread(path: string): string | undefined { return path.match(/^\/direct\/t\/(\d+)\/?/)?.[1]; }
const str = (v: unknown) => typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
export function normalizeThreads(payload: unknown): Snapshot[] {
 const output = new Map<string, Snapshot>(); let visited = 0;
 function walk(value: any, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 35 || ++visited > 60000) return;
  if (value.slide_messages?.edges && value.thread_key && value.viewer_id) {
   const viewerId = str(value.viewer_id), viewer = value.viewer || {};
   const messages: Message[] = value.slide_messages.edges.slice(0, 500).flatMap((edge: any) => {
    const m = edge.node; if (!m || !m.message_id) return [];
    const c = m.content || {}, typename = str(c.__typename);
    const media: Message['media'] = [];
    const urls: {url:string; kind:'image'|'audio'}[] = [];
    function findMedia(o: any, d=0) {
     if (!o || typeof o !== 'object' || d > 10) return;
     for (const [k,v] of Object.entries(o)) {
      if (typeof v === 'string' && /^https:\/\//.test(v) && /url|src/i.test(k) && !/profile|avatar/i.test(k)) {
       if (/audio|voice/i.test(typename) && /audio|playable|src|url/i.test(k)) urls.push({url:v,kind:'audio'});
       else if (/image|photo/i.test(typename)) urls.push({url:v,kind:'image'});
      } else if (typeof v === 'object') findMedia(v,d+1);
     }
    }
    const ephemeral = !!m.expiration_timestamp_ms || !!m.view_expiration_timestamp_ms || /raven|ephemeral|viewonce/i.test(typename);
    if (!ephemeral) findMedia(c);
    if (urls.length) media.push({...urls[0],label:typename});
    else if (typename && !/Text|Admin/i.test(typename)) media.push({kind:'unsupported',label:ephemeral?'Media một lần xem / tự hết hạn':typename});
    const senderId = str(m.sender?.igid || m.sender?.user_dict?.pk);
    let sender: Message['sender'] = 'unknown';
    if (/Admin/.test(typename)) sender = 'system';
    else if (senderId) sender = senderId === viewerId ? 'self' : 'customer';
    else if (viewer.interop_messaging_user_fbid && m.sender_fbid) sender = str(m.sender_fbid) === str(viewer.interop_messaging_user_fbid) ? 'self' : 'customer';
    const deleted = !!m.tombstone_reason;
    return [{id:str(m.message_id), sender, text:deleted?'':str(m.text_body || c.text_body), timestamp:Number(m.timestamp_ms)||undefined, media:deleted?[]:media, deleted}];
   });
   messages.sort((a,b)=>(a.timestamp||0)-(b.timestamp||0));
   const parsed = SnapshotSchema.safeParse({account:viewerId,thread:str(value.thread_key),customer:str(value.thread_title),messages,confirmed:messages.every(m=>m.sender!=='unknown'),source:'network'});
   if (parsed.success) output.set(parsed.data.thread,parsed.data);
  }
  if (Array.isArray(value)) for (const child of value) walk(child,depth+1);
  else for (const child of Object.values(value)) walk(child,depth+1);
 }
 walk(payload); return [...output.values()];
}
export function readDom(doc: Document, thread: string): Snapshot | null {
 const main = doc.querySelector('main,[role="main"]'); if (!main) return null;
 const profileLinks = [...doc.querySelectorAll<HTMLAnchorElement>('a[href]')];
 const own = profileLinks.find(a=>a.textContent?.trim()==='Profile' || a.querySelector('svg[aria-label="Profile"]'));
 const account = own?.getAttribute('href')?.split('/').filter(Boolean)[0] || 'unconfirmed-account';
 const customerLink = [...main.querySelectorAll<HTMLAnchorElement>('a[href]')].find(a=>/^\/[a-zA-Z0-9_.]+\/?$/.test(a.getAttribute('href')||'') && !['/direct/','/explore/'].includes(a.getAttribute('href')||''));
 const occurrences = new Map<string,number>();
 const messages: Message[] = [...main.querySelectorAll<HTMLElement>('[role="article"][aria-roledescription="message"]')].map(el=>{
  const text=el.textContent?.trim()||'';
  const count=(occurrences.get(text)||0)+1;occurrences.set(text,count);
  let hash=2166136261; for (const ch of text) hash=Math.imul(hash^ch.charCodeAt(0),16777619);
  const hasMedia=!!el.querySelector('img,video,audio,svg[aria-label*="audio" i],svg[aria-label*="photo" i]');
  return {id:`dom-${hash>>>0}-${count}`,sender:'unknown',text,media:hasMedia?[{kind:'unsupported',label:'Media chưa có dữ liệu xác thực'}]:[]};
 });
 return {account,thread,customer:customerLink?.textContent?.trim()||'Khách hàng',messages,confirmed:false,source:'dom'};
}
export function fingerprint(s:Snapshot):string { return JSON.stringify([s.account,s.thread,s.confirmed,s.messages.map(m=>[m.id,m.sender,m.text,m.deleted,m.media.map(x=>[x.kind,x.url])])]); }
// Calibrate layout against BOTH senders already identified by network metadata.
// This handles DOM-only realtime updates without assuming a global CSS class name.
export function calibrateDom(doc:Document,dom:Snapshot,network:Snapshot):Snapshot {
 const articles=[...doc.querySelectorAll<HTMLElement>('main [role="article"][aria-roledescription="message"],[role="main"] [role="article"][aria-roledescription="message"]')];
 const signatures=articles.map(el=>{
  let parent=el.parentElement;
  for(let i=0;i<5&&parent;i++,parent=parent.parentElement){const css=doc.defaultView?.getComputedStyle(parent);if(css?.display==='flex')return css.flexDirection;}
  return '';
 });
 const byText=new Map<string,Message[]>();for(const m of network.messages.filter(m=>!m.deleted&&m.sender!=='system'))byText.set(m.text,[...(byText.get(m.text)||[]),m]);
 const mapping=new Map<string,Set<Message['sender']>>();
 dom.messages.forEach((m,i)=>{const hits=byText.get(m.text)||[],sig=signatures[i];if(hits.length===1&&sig&&['self','customer'].includes(hits[0].sender)){const set=mapping.get(sig)||new Set();set.add(hits[0].sender);mapping.set(sig,set);}});
 const usable=[...mapping].filter(([,values])=>values.size===1);
 if(!usable.some(([,v])=>v.has('self'))||!usable.some(([,v])=>v.has('customer')))return {...dom,account:network.account,customer:network.customer};
 const messages=dom.messages.map((m,i)=>{
  const senders=mapping.get(signatures[i]);const sender=senders?.size===1?[...senders][0]:'unknown';const hits=byText.get(m.text)||[];
  return hits.length===1&&hits[0].sender===sender?hits[0]:{...m,sender};
 });
 return {...dom,account:network.account,customer:network.customer,messages,confirmed:messages.every(m=>m.sender!=='unknown')};
}
