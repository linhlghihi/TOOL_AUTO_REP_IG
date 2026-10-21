import React,{useEffect,useRef,useState} from 'react';
import { createRoot } from 'react-dom/client';
import { CHANNEL,routeThread,readDom,fingerprint,calibrateDom } from './extract';
import { SnapshotSchema,type Snapshot,type AIResult,type Settings,type Job } from '../shared/types';
import {LOCAL_SERVER,serverUrl} from '../shared/server';
const snapshots=new Map<string,Snapshot>();
const listeners=new Set<()=>void>();
window.addEventListener('message',e=>{
 if(e.source!==window||e.origin!==location.origin||e.data?.channel!==CHANNEL||!Array.isArray(e.data.snapshots))return;
 for(const raw of e.data.snapshots.slice(0,20)){
  const parsed=SnapshotSchema.safeParse(raw);if(!parsed.success)continue;
  const s=parsed.data,old=snapshots.get(s.thread);
  if(old?.account===s.account){const map=new Map(old.messages.map(m=>[m.id,m]));for(const m of s.messages)map.set(m.id,m);s.messages=[...map.values()].sort((a,b)=>(a.timestamp||0)-(b.timestamp||0)).slice(-500);}
  snapshots.set(s.thread,s);if(snapshots.size>20)snapshots.delete(snapshots.keys().next().value!);
 }
 for(const notify of listeners)notify();
});
window.postMessage({channel:CHANNEL,request:'snapshot'},location.origin);
function activeSnapshot():Snapshot|null {
 const thread=routeThread(location.pathname);if(!thread)return null;
 const dom=readDom(document,thread),network=snapshots.get(thread);
 if(!network)return dom;
 if(!dom?.messages.length)return {...network,confirmed:false};
 const available=new Map<string,number>();
 for(const m of network.messages.filter(m=>!m.deleted))available.set(m.text,(available.get(m.text)||0)+1);
 const matched=dom.messages.every(m=>{const n=available.get(m.text)||0;if(n<1)return false;available.set(m.text,n-1);return true;});
 // If a websocket/DOM update has not been mapped to stable metadata, do not guess.
 return matched?network:calibrateDom(document,dom,network);
}
async function api(path:string,method='GET',body?:unknown,server?:string):Promise<any>{const r=await chrome.runtime.sendMessage({type:'bridge',path,method,body,server});if(!r?.ok)throw new Error(r?.error||'Extension đã được cập nhật. Hãy tải lại tab.');return r.data;}
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const styles=`
html,body{margin:0;background:transparent;}body{color-scheme:light;font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;font-size:13px;color:#202b38}
*{box-sizing:border-box}button,input,select,textarea{font:inherit}button{cursor:pointer;border:1px solid #d9e2e7;border-radius:9px;background:white;color:#273849;padding:8px 11px;font-weight:600}button:hover{background:#edf6f4}button:disabled{opacity:.45;cursor:default}button.primary{background:#146b5d;color:white;border-color:#146b5d}button.ghost{background:transparent;border-color:transparent;padding:6px}input,select,textarea{border:1px solid #d7e0e5;border-radius:9px;padding:9px;color:#263747;background:white;width:100%;outline:none}input:focus,textarea:focus,select:focus{border-color:#238c78;box-shadow:0 0 0 2px #238c781a}textarea{resize:vertical;min-height:76px;line-height:1.55}p{margin:6px 0;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}label{display:block;margin:12px 0 5px;font-weight:600;font-size:12px}small{font-size:11px;color:#72808d}a{color:#146b5d;overflow-wrap:anywhere}h3{font-size:13px;margin:0 0 10px}hr{border:0;border-top:1px solid #e7ecef;margin:16px 0}
.shell{position:fixed;z-index:2147483600;right:0;top:0;bottom:0;width:100%;background:#f6f8fa;border:1px solid #dce5e7;border-radius:17px;box-shadow:0 14px 60px #102a3b26;display:flex;flex-direction:column;overflow:hidden}.top{padding:17px 18px;background:#fff;border-bottom:1px solid #e5ebee;display:flex;align-items:center;gap:10px}.brand{background:#146b5d;color:white;border-radius:10px;padding:9px;font-weight:800}.grow{flex:1;min-width:0}.title{font-weight:750;font-size:15px}.sub{font-size:11px;color:#788693;margin-top:3px}.tabs{display:flex;padding:9px 12px;gap:6px;background:#fff;border-bottom:1px solid #e5ebee}.tabs button{flex:1;border:0;font-size:12px}.tabs .selected{background:#e4f2ed;color:#146b5d}.scroll{overflow:auto;padding:15px;flex:1}.card{background:white;border:1px solid #e2e8ec;border-radius:12px;padding:13px;margin-bottom:12px}.row{display:flex;gap:7px;align-items:center}.between{justify-content:space-between}.status{padding:11px 17px;font-size:12px;border-top:1px solid #e3e9ec;background:white;color:#526578}.dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#329980;margin-right:7px}.warning{background:#fff7e5;border:1px solid #efdfb7;padding:10px;border-radius:9px;font-size:12px;line-height:1.5;margin-bottom:12px}.error{background:#fff0ef;color:#a04138;border-color:#ecc9c5}.muted{color:#788794}.bubble{border-left:3px solid #c6d8d3}.bubble.self{border-left-color:#9eaccd}.translation{margin-top:8px;padding-top:8px;border-top:1px dashed #e2e8e9;color:#536878;font-size:12px}.badge{font-size:10px;background:#edf4f2;color:#357466;border-radius:5px;padding:3px 5px}.empty{text-align:center;padding:28px 12px;color:#71828e;line-height:1.7}.float{position:fixed;right:0;bottom:0;z-index:2147483600;background:#146b5d;color:white;box-shadow:0 5px 20px #143f332b}.pill{font-size:11px}.stack{display:flex;gap:8px;flex-wrap:wrap}.danger{color:#a04138}.sources{font-size:11px}.draft{min-height:115px}.accent{color:#146b5d;font-weight:600}
`;
function App(){
 const [visible,setVisible]=useState(true),[tab,setTab]=useState<'chat'|'reply'|'settings'>('reply');
 useEffect(()=>{panelFrame.style.height=visible?'calc(100vh - 32px)':'62px';panelFrame.style.width=visible?'min(405px, calc(100vw - 32px))':'160px';panelFrame.style.top=visible?'16px':'auto';},[visible]);
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[connected,setConnected]=useState(false),[code,setCode]=useState('');
 const [server,setServer]=useState(LOCAL_SERVER);
 useEffect(()=>{void chrome.storage.local.get('bridgeServer').then(x=>setServer(x.bridgeServer||LOCAL_SERVER));},[]);
 const [paused,setPaused]=useState(false),[status,setStatus]=useState('Đang kết nối…'),[error,setError]=useState('');
 const [focused,setFocused]=useState(document.visibilityState==='visible');
 const [settings,setSettings]=useState<Settings|null>(null),[models,setModels]=useState<string[]>([]),[facts,setFacts]=useState<any[]>([]),[revisions,setRevisions]=useState<any[]>([]);
 const [settingsRevision,setSettingsRevision]=useState(0);
 const [result,setResult]=useState<AIResult|null>(null),[sources,setSources]=useState<any[]>([]),[draft,setDraft]=useState(''),[dirty,setDirty]=useState(false),[resultKey,setResultKey]=useState('');
 const [instruction,setInstruction]=useState(''),[answer,setAnswer]=useState(''),[mediaNotes,setMediaNotes]=useState<Record<string,string>>({}),[manualSenders,setManualSenders]=useState<Record<string,'self'|'customer'>>({});
 const [manualAccount,setManualAccount]=useState(''),[manualConfirmed,setManualConfirmed]=useState('');
 const epoch=useRef(0),current=useRef<Snapshot|null>(null),lastThread=useRef(''),lastObserved=useRef(''),running=useRef(false);
 const key=snapshot?fingerprint(snapshot):'';
 const effective=snapshot&&manualConfirmed===key?{...snapshot,account:snapshot.account==='unconfirmed-account'?manualAccount:snapshot.account,confirmed:true,messages:snapshot.messages.map(m=>({...m,sender:m.sender==='unknown'?manualSenders[m.id]:m.sender}))}:snapshot;
 const effectiveRef=useRef(effective);effectiveRef.current=effective;
 async function loadSettings(){const data=await api('/settings');setResultKey('');setSettings(data.settings);setSettingsRevision(v=>v+1);setFacts(data.facts);setRevisions(data.revisions);setConnected(true);setError('');setStatus('Đã kết nối AGY bridge');try{const x=await api('/models');setModels(x.models);}catch(e){setError((e as Error).message);}}
 useEffect(()=>{void loadSettings().catch(e=>{setConnected(false);setError(e.message);setStatus('Chưa ghép cặp');});},[]);
 useEffect(()=>{const changed=()=>{const active=document.visibilityState==='visible';setFocused(active);if(!active){epoch.current++;void api('/cancel','POST').catch(()=>{});}};document.addEventListener('visibilitychange',changed);return()=>document.removeEventListener('visibilitychange',changed);},[]);
 useEffect(()=>{
  const toggle=(m:any)=>{if(m.type==='toggle-panel')setVisible(v=>!v);};chrome.runtime.onMessage.addListener(toggle);
  const read=()=>{
   const s=activeSnapshot(),fp=s?fingerprint(s):'';if(fp===lastObserved.current)return;lastObserved.current=fp;
   const thread=s?`${s.account}:${s.thread}`:'';
   if(thread!==lastThread.current){lastThread.current=thread;setResult(null);setSources([]);setDraft('');setDirty(false);setResultKey('');setAnswer('');setInstruction('');setMediaNotes({});setManualSenders({});setManualConfirmed('');}
   epoch.current++;running.current=false;void api('/cancel','POST').catch(()=>{});current.current=s;setSnapshot(s);setStatus(s?'Đã nhận cuộc trò chuyện':'Mở một cuộc trò chuyện Instagram');
  };
  let timer:ReturnType<typeof setTimeout>|undefined;
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(read,200);};
  const observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  const interval=setInterval(read,1000);listeners.add(schedule);read();
  return()=>{observer.disconnect();clearInterval(interval);clearTimeout(timer);listeners.delete(schedule);chrome.runtime.onMessage.removeListener(toggle);epoch.current++;};
 },[]);
 async function generate(force=false,ownerAnswer?:{question:string;answer:string}){
  const s=effectiveRef.current;if(!s?.confirmed||!connected)return;
  const mine=++epoch.current,fp=current.current?fingerprint(current.current):'';running.current=true;setError('');setStatus('Đang gửi yêu cầu…');
  try{
   const {id}=await api('/generate','POST',{snapshot:s,instruction,force,mediaNotes,answer:ownerAnswer});
   while(mine===epoch.current){
    const job:Job=await api(`/jobs/${id}`);if(mine!==epoch.current)return;
    setStatus(job.phase);
    if(job.status==='error')throw new Error(job.error);
    if(job.status==='cancelled')return;
    if(job.status==='done'){
     if(fp!==(current.current?fingerprint(current.current):''))return;
     setResult(job.result||null);setDraft(job.result?.reply||'');setDirty(false);setResultKey(fp);setSources(job.sources||[]);setAnswer('');
     if(ownerAnswer){const data=await api('/settings');if(mine===epoch.current){setFacts(data.facts);setRevisions(data.revisions);}}
     return;
    }
    await wait(1000);
   }
  }catch(e){if(mine===epoch.current){setError((e as Error).message);setStatus('Cần kiểm tra');}}
  finally{if(mine===epoch.current)running.current=false;}
 }
 useEffect(()=>{
  if(!connected||paused||!focused||!effective?.confirmed||!settings?.context.trim()||dirty)return;
  const timer=setTimeout(()=>void generate(),2000);return()=>clearTimeout(timer);
 },[key,manualConfirmed,connected,paused,focused,settingsRevision]);
 async function pair(){try{setError('');await api('/pair','POST',{code},serverUrl(server));setCode('');await loadSettings();}catch(e){setError((e as Error).message);}}
 async function save(){try{setError('');await api('/settings','POST',settings);epoch.current++;setResultKey('');await loadSettings();setStatus('Đã lưu cấu hình');}catch(e){setError((e as Error).message);}}
 function chooseSender(id:string,sender:'self'|'customer'){setManualSenders(v=>({...v,[id]:sender}));setManualConfirmed('');setResultKey('');epoch.current++;void api('/cancel','POST').catch(()=>{});}
 const err=(e:unknown)=>setError((e as Error).message);
 if(!visible)return <><style>{styles}</style><button className="float" onClick={()=>setVisible(true)}>✦ Trợ lý IG</button></>;
 return <><style>{styles}</style><section className="shell" aria-label="Trợ lý tư vấn Instagram">
  <header className="top"><div className="brand">ig</div><div className="grow"><div className="title">Trợ lý shop</div><div className="sub">Tư vấn · Bạn tự gửi</div></div><button className="ghost" title="Thu gọn" onClick={()=>setVisible(false)}>✕</button></header>
  <nav className="tabs">{([['chat','Hội thoại'],['reply','Đề xuất'],['settings','Cài đặt']] as const).map(([id,label])=><button key={id} className={tab===id?'selected':''} onClick={()=>setTab(id)}>{label}{id==='reply'&&result?.questions.length?' •':''}</button>)}</nav>
  <div className="scroll">
   {error&&<div className="warning error">{error}<button className="ghost" onClick={()=>setError('')}>×</button></div>}
   {!connected?<div className="card"><h3>Kết nối AGY server</h3><p>Chạy <b>START.cmd</b>, dán URL server và mã ghép cặp hiện trong cửa sổ đó. Multilogin dùng URL HTTPS của Cloudflare.</p><label>Địa chỉ server</label><input value={server} onChange={e=>setServer(e.target.value)} placeholder="https://…trycloudflare.com"/><label>Mã ghép cặp</label><input value={code} onChange={e=>setCode(e.target.value)} placeholder="Mã 16 ký tự"/><div className="stack" style={{marginTop:12}}><button className="primary" onClick={()=>void pair()}>Kết nối</button><button onClick={()=>void loadSettings().catch(err)}>Thử lại kết nối đã lưu</button></div></div>:null}
   {tab!=='settings'&&connected&&<>
    <div className="row between" style={{marginBottom:12}}><div><b>{snapshot?.customer||'Chưa chọn khách'}</b><div className="sub">{snapshot?`${snapshot.messages.length} tin đã tải · ${snapshot.source==='network'?'Có ID hội thoại':'Dữ liệu DOM'}`:'Mở Instagram Direct để bắt đầu'}</div></div><button className="pill" onClick={()=>{setPaused(p=>!p);epoch.current++;void api('/cancel','POST').catch(err);}}>{paused?'▶ Tiếp tục':'Ⅱ Tạm dừng'}</button></div>
    {!settings?.context.trim()&&<div className="warning">Thêm kiến thức shop trong <button className="ghost" onClick={()=>setTab('settings')}>Cài đặt</button> để bắt đầu tư vấn.</div>}
    {snapshot&&!effective?.confirmed&&<div className="warning"><b>Chưa xác nhận đủ người gửi.</b><p>Tải lại tab để nhận dữ liệu hội thoại, hoặc chọn “Bạn / Khách” cho từng tin bên dưới rồi xác nhận.</p>{snapshot.account==='unconfirmed-account'&&<input placeholder="Username Instagram của shop" value={manualAccount} onChange={e=>setManualAccount(e.target.value)}/>}<button disabled={snapshot.messages.some(m=>m.sender==='unknown'&&!manualSenders[m.id])||!snapshot.messages.length||snapshot.account==='unconfirmed-account'&&!/^[a-zA-Z0-9_.]{1,100}$/.test(manualAccount)} onClick={()=>setManualConfirmed(key)}>Xác nhận người gửi</button></div>}
   </>}
   {tab==='chat'&&<>
    {!snapshot?.messages.length?<div className="empty">Lịch sử hội thoại sẽ xuất hiện ở đây.<br/>Tool chỉ đọc phần hội thoại đã tải.</div>:snapshot.messages.filter(m=>!m.deleted&&m.sender!=='system').map(m=>{return <div key={m.id} className={`card bubble ${m.sender==='self'?'self':''}`}><div className="row between"><span className="badge">{m.sender==='self'?'Bạn':m.sender==='customer'?'Khách':'Chưa rõ người gửi'}</span>{m.timestamp&&<small>{new Date(m.timestamp).toLocaleString('vi-VN')}</small>}</div><p>{m.text||'[Tin media]'}</p>{m.sender==='unknown'&&<div className="stack"><button className={manualSenders[m.id]==='self'?'primary':''} onClick={()=>chooseSender(m.id,'self')}>Bạn</button><button className={manualSenders[m.id]==='customer'?'primary':''} onClick={()=>chooseSender(m.id,'customer')}>Khách</button></div>}{m.media.length>0&&<><small>{m.media.map(x=>x.kind==='audio'?'Voice':x.kind==='image'?'Ảnh':x.label||'Media').join(' · ')}</small><input placeholder="Mô tả media nếu AI chưa đọc được" value={mediaNotes[m.id]||''} onChange={e=>setMediaNotes(v=>({...v,[m.id]:e.target.value}))}/></>}</div>;})}
    <button className="primary" disabled={!connected||!effective?.confirmed||!settings?.context.trim()} onClick={()=>{setTab('reply');void generate(true);}}>Soạn câu trả lời</button>
   </>}
   {tab==='reply'&&<>
    {dirty&&resultKey!==key&&<div className="warning">Có tin mới. Bản bạn đang sửa được giữ lại; hãy soạn lại trước khi copy.</div>}
    {!!result?.questions.length&&<div className="card"><h3>Cần bạn bổ sung</h3>{result.questions.map((q,i)=><p key={i}>{i+1}. {q}</p>)}<textarea placeholder="Trả lời bằng tiếng Việt…" value={answer} onChange={e=>setAnswer(e.target.value)}/><small>Thông tin chung được tự ghi nhớ cho shop. Chi tiết riêng giữ theo khách.</small><button className="primary" disabled={!answer.trim()||!effective?.confirmed} onClick={()=>void generate(true,{question:result.questions.join('\n'),answer})}>Bổ sung & soạn lại</button></div>}
    <div className="card"><div className="row between"><h3>Câu trả lời đề xuất</h3><span className="badge">{result?.language||'Theo ngôn ngữ khách'}</span></div><textarea className="draft" placeholder="Đề xuất sẽ xuất hiện ở đây…" value={draft} onChange={e=>{setDraft(e.target.value);setDirty(true);}}/><div className="row between" style={{marginTop:10}}><small>{dirty?'Bạn đã chỉnh sửa đề xuất':'Bạn tự dán và gửi trên Instagram'}</small><button className="primary" disabled={!draft.trim()||resultKey!==key||!!result?.questions.length} onClick={()=>{void navigator.clipboard.writeText(draft).then(()=>setStatus('Đã copy — bạn tự dán và gửi')).catch(err);}}>Copy</button></div></div>
    <div className="card"><label>Hướng dẫn thêm cho AI</label><textarea value={instruction} onChange={e=>setInstruction(e.target.value)} placeholder="Ví dụ: hỏi khách muốn kích thước nào, trả lời ngắn thôi…"/><button style={{marginTop:10}} disabled={!connected||!effective?.confirmed||!settings?.context.trim()} onClick={()=>void generate(true)}>↻ Soạn lại</button></div>
    {result?.warnings.map((w,i)=><div className="warning" key={i}>{w}</div>)}
    {!!sources.length&&<div className="card sources"><h3>Nguồn tham khảo</h3>{sources.map(s=><p key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title||s.url}</a><br/><small>{new Date(s.fetchedAt).toLocaleString('vi-VN')}</small></p>)}</div>}
   </>}
   {tab==='settings'&&connected&&<div className="card"><label>Server đang dùng</label><p>{server}</p><button onClick={()=>{epoch.current++;running.current=false;void api('/cancel','POST').catch(()=>{});setConnected(false);setResult(null);setDraft('');setDirty(false);setResultKey('');setSettings(null);}}>Đổi server / Ghép cặp lại</button></div>}
   {tab==='settings'&&settings&&<>
    <div className="warning">Ảnh: xử lý qua AGY khi lấy được file. Voice: CLI hiện chưa hỗ trợ đọc tự động; bạn nhập nội dung voice vào ô “Mô tả media”.</div>
    <div className="card"><h3>Kiến thức của shop</h3><label>Website shop (HTTPS)</label><input value={settings.website} onChange={e=>setSettings({...settings,website:e.target.value})} placeholder="https://shop-cua-ban.com"/><label>Sản phẩm, giá và chính sách</label><textarea style={{minHeight:190}} value={settings.context} onChange={e=>setSettings({...settings,context:e.target.value})} placeholder="Tên sản phẩm, giá/tiền tệ, kích thước, vận chuyển, đổi trả…"/><label>Nạp .txt / .md / .csv</label><input type="file" accept=".txt,.md,.csv" onChange={e=>{const file=e.target.files?.[0];if(file){if(file.size>150000){setError('File tối đa 150 KB.');return;}void file.text().then(text=>setSettings(v=>v?{...v,context:(v.context+'\n'+text).slice(0,150000)}:v));}}}/><label>Giọng tư vấn</label><textarea value={settings.tone} onChange={e=>setSettings({...settings,tone:e.target.value})}/><label>Model AGY</label><select value={settings.model} onChange={e=>setSettings({...settings,model:e.target.value})}>{!models.includes(settings.model)&&<option value={settings.model}>{settings.model} — chưa xác nhận</option>}{models.map(m=><option key={m}>{m}</option>)}</select><label>Ngôn ngữ trả lời</label><select value={settings.language} onChange={e=>setSettings({...settings,language:e.target.value})}><option value="auto">Tự nhận diện theo khách</option><option value="English">English</option><option value="Vietnamese">Tiếng Việt</option><option value="French">Français</option><option value="Spanish">Español</option><option value="German">Deutsch</option><option value="Japanese">日本語</option></select><button className="primary" style={{marginTop:14}} onClick={()=>void save()}>Lưu cài đặt</button></div>
    <div className="card"><h3>Kiến thức đã tự ghi nhớ ({facts.length})</h3>{facts.length===0&&<p className="muted">Chưa có thông tin bổ sung.</p>}{facts.map(f=><div key={f.id}><p>{f.answer}</p><div className="stack"><button onClick={()=>{setSettings({...settings,context:settings.context+'\n'+f.answer});setStatus('Đã chép lên ô context để bạn chỉnh sửa. Lưu rồi xóa bản ghi cũ nếu cần.');}}>Chép vào context để sửa</button><button className="danger" onClick={()=>void api(`/facts/${f.id}`,'DELETE').then(loadSettings).catch(err)}>Xóa</button></div><hr/></div>)}</div>
    {!!revisions.length&&<div className="card"><h3>Phiên bản context trước</h3>{revisions.map(r=><p key={r.id}><button onClick={()=>{setSettings(JSON.parse(r.value));setStatus('Đã nạp phiên bản cũ vào biểu mẫu. Bấm Lưu để áp dụng.');}}>{new Date(r.created).toLocaleString('vi-VN')}</button></p>)}</div>}
    <div className="card"><small>Dữ liệu lưu trên máy. Cache/hội thoại hết hạn sau 30 ngày. Xóa dưới đây không xóa lịch sử riêng do AGY quản lý.</small><button className="danger" style={{marginTop:10}} onClick={()=>{if(window.confirm('Xóa context, kiến thức học được và cache của tool?'))void api('/data','DELETE').then(()=>{setResult(null);setDraft('');setResultKey('');return loadSettings();}).catch(err);}}>Xóa dữ liệu tool</button></div>
   </>}
  </div><footer className="status"><span className="dot" style={{background:connected?'#329980':'#b8a372'}}/>{paused?'Đã tạm dừng tự động':status}</footer>
 </section></>;
}
// Events inside a child browsing context do not bubble/capture through Instagram's document.
const host=document.createElement('div');host.id='ig-shop-assistant-root';document.documentElement.appendChild(host);
const shadow=host.attachShadow({mode:'closed'});
const panelFrame=document.createElement('iframe');panelFrame.title='Trợ lý shop';
panelFrame.style.cssText='position:fixed;z-index:2147483600;right:16px;top:16px;bottom:16px;width:min(405px, calc(100vw - 32px));height:calc(100vh - 32px);border:0;background:transparent;color-scheme:light;';
shadow.appendChild(panelFrame);
const panelDocument=panelFrame.contentDocument!;
const mount=panelDocument.createElement('div');panelDocument.body.appendChild(mount);
createRoot(mount).render(<App/>);
