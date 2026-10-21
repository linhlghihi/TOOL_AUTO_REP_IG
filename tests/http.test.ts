import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp,rm,mkdir } from 'node:fs/promises';
import { resolve,join,sep } from 'node:path';
test('bridge requires pairing, blocks web origins and separates client jobs',async()=>{
 const base=resolve('.local/http-tests');await mkdir(base,{recursive:true});const dir=await mkdtemp(join(base,'run-'));
 const child=spawn(process.execPath,['--experimental-sqlite','--import','tsx','src/bridge/main.ts'],{cwd:process.cwd(),env:{...process.env,IG_ASSISTANT_DATA:dir,IG_ASSISTANT_PORT:"43128"},windowsHide:true,stdio:['ignore','pipe','pipe']});
 const closed=new Promise(r=>child.on('exit',r));
 try{
  const code=await new Promise<string>((res,rej)=>{let stdout='';const t=setTimeout(()=>rej(new Error('Bridge startup timeout')),15000);child.stdout.on('data',b=>{stdout+=b;const m=stdout.match(/Mã ghép cặp: ([A-F0-9]+)/);if(m){clearTimeout(t);res(m[1]);}});child.on('exit',c=>{clearTimeout(t);rej(new Error('Bridge exited '+c));});child.on('error',rej);});
  const url='http://127.0.0.1:43128';const ext='a'.repeat(32);const headers={'X-Extension-ID':ext,'Content-Type':'application/json','X-Client-ID':'test'};
  assert.equal((await fetch(url+'/health')).status,200);
  assert.equal((await fetch(url+'/settings',{headers})).status,401);
  assert.equal((await fetch(url+'/health',{headers:{Origin:'https://evil.test'}})).status,403);
  assert.equal((await fetch(url+'/pair',{method:'POST',headers,body:JSON.stringify({code:'wrong'})})).status,401);
  const paired=await fetch(url+'/pair',{method:'POST',headers,body:JSON.stringify({code})});assert.equal(paired.status,200);const {token}=await paired.json() as any;
  const auth={...headers,Authorization:`Bearer ${token}`};
  const settings=await fetch(url+'/settings',{headers:auth});assert.equal(settings.status,200);assert.equal(((await settings.json()) as any).settings.context,'');
  assert.equal((await fetch(url+'/settings',{headers:{...auth,'X-Extension-ID':'b'.repeat(32)}})).status,401);
  assert.equal((await fetch(url+'/jobs/unknown',{headers:auth})).status,404);
  assert.equal((await fetch(url+'/data',{method:'DELETE',headers:auth})).status,200);
 }finally{
  child.kill();await closed;
  if(!resolve(dir).startsWith(base+sep))throw new Error('Unexpected test directory');
  await rm(dir,{recursive:true,force:true});
 }
});
