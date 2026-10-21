import {LOCAL_SERVER,serverUrl} from '../shared/server';
const safePath=/^\/(pair|health|settings|models|generate|cancel|data|jobs\/[0-9a-f-]+|facts\/\d+)$/;
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(sender.id!==chrome.runtime.id||!sender.url?.startsWith('https://www.instagram.com/')||sender.tab?.id===undefined||sender.frameId!==0)return;
 if(message.type!=='bridge')return;
 void (async()=>{
  try{
   if(!safePath.test(message.path))throw new Error('Đường dẫn không hợp lệ.');
   const {bridgeToken,bridgeServer}=await chrome.storage.local.get(['bridgeToken','bridgeServer']);
   const base=serverUrl(message.path==='/pair'?message.server||bridgeServer||LOCAL_SERVER:bridgeServer||LOCAL_SERVER);
   const headers:Record<string,string>={'Content-Type':'application/json','X-Extension-ID':chrome.runtime.id,'X-Client-ID':String(sender.tab!.id)};
   if(bridgeToken&&message.path!=='/pair')headers.Authorization=`Bearer ${bridgeToken}`;
   const response=await fetch(base+message.path,{redirect:'error',method:message.method||'GET',headers,body:message.body===undefined?undefined:JSON.stringify(message.body),signal:AbortSignal.timeout(25000)});
   if(!response.headers.get('content-type')?.includes('application/json'))throw new Error(`Server trả HTTP ${response.status}, không phải AGY bridge. Kiểm tra URL và cửa sổ START.cmd.`);
   const data=await response.json();if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
   if(message.path==='/pair'&&typeof data.token==='string'){await chrome.storage.local.set({bridgeToken:data.token,bridgeServer:base});respond({ok:true,data:{paired:true}});}
   else respond({ok:true,data});
  }catch(error){respond({ok:false,error:(error as Error).message==='Failed to fetch'?'Không truy cập được server. Kiểm tra URL, START.cmd và Cloudflare Tunnel. Với Multilogin, dùng URL HTTPS hiện trong START.cmd.':(error as Error).message});}
 })();return true;
});
chrome.action.onClicked.addListener(tab=>{if(tab.id)void chrome.tabs.sendMessage(tab.id,{type:'toggle-panel'}).catch(()=>{});});
chrome.tabs.onRemoved.addListener(async tabId=>{const {bridgeToken,bridgeServer}=await chrome.storage.local.get(['bridgeToken','bridgeServer']);if(bridgeToken)void fetch(serverUrl(bridgeServer||LOCAL_SERVER)+'/cancel',{redirect:'error',method:'POST',headers:{Authorization:`Bearer ${bridgeToken}`,'X-Extension-ID':chrome.runtime.id,'X-Client-ID':String(tabId)}}).catch(()=>{});});
