import {spawn} from 'node:child_process';
import {mkdir,access,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
const local='http://127.0.0.1:43127';
let bridge,tunnel,stopping=false;
function stop(code=0){if(stopping)return;stopping=true;tunnel?.kill();bridge?.kill();setTimeout(()=>process.exit(code),500);}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
async function healthy(){try{const r=await fetch(local+'/health',{signal:AbortSignal.timeout(1500)});const j=await r.json();return r.ok&&j.ok===true&&j.version==='0.1.0';}catch{return false;}}
try{
 if(await healthy())console.log('Bridge đang chạy. Dùng mã ghép cặp trong cửa sổ START trước đó.');
 else{
  bridge=spawn(process.execPath,['--experimental-sqlite','dist/bridge/main.js'],{stdio:'inherit',windowsHide:true});
  bridge.on('error',e=>{console.error(e.message);stop(1);});
  bridge.on('exit',code=>{if(!stopping)stop(code||1);});
  let ready=false;for(let i=0;i<40&&!stopping;i++){if(await healthy()){ready=true;break;}await new Promise(r=>setTimeout(r,250));}
  if(!ready)throw new Error('Không khởi động được bridge.');
 }
 const dir=resolve('.local/bin');await mkdir(dir,{recursive:true});
 const exe=process.env.CLOUDFLARED_PATH||resolve(dir,'cloudflared.exe');
 try{await access(exe);}catch{
  if(process.env.CLOUDFLARED_PATH)throw new Error('CLOUDFLARED_PATH không tồn tại.');
  console.log('Đang tải cloudflared từ bản phát hành chính thức của Cloudflare…');
  const r=await fetch('https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe',{signal:AbortSignal.timeout(180000)});
  if(!r.ok)throw new Error(`Tải cloudflared thất bại: HTTP ${r.status}`);
  await writeFile(exe+'.download',Buffer.from(await r.arrayBuffer()));await rename(exe+'.download',exe);
 }
 // Explicit empty config prevents a user's named-tunnel config affecting Quick Tunnel.
 const config=resolve('.local/quick-tunnel.yml');await writeFile(config,'{}\n');
 tunnel=spawn(exe,['tunnel','--config',config,'--url',local,'--http-host-header','127.0.0.1:43127','--protocol','http2','--no-autoupdate'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
 let tail='',announced=false;
 const output=b=>{
  const line=b.toString();process.stderr.write(line);tail=(tail+line).slice(-8000);
  const match=tail.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if(match&&!announced){announced=true;console.log(`\nSERVER: ${match[0]}\nDán URL này vào extension và nhập mã ghép cặp của bridge.\nGiữ cửa sổ này mở. Ctrl+C để dừng tunnel.\n`);}
 };
 tunnel.stdout.on('data',output);tunnel.stderr.on('data',output);
 tunnel.on('error',e=>{console.error('Không mở được tunnel:',e.message);stop(1);});
 tunnel.on('exit',code=>{if(!stopping){console.error('Tunnel đã dừng. Chạy lại START.cmd để lấy URL mới.');stop(code||1);}});
}catch(e){console.error(e.message);stop(1);}
