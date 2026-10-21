import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {transform} from 'esbuild';
import {LOCAL_SERVER,serverUrl} from '../src/shared/server';
test('server URL accepts HTTPS origins and local bridge only',()=>{
 assert.equal(serverUrl(' https://shop.trycloudflare.com/ '),'https://shop.trycloudflare.com');
 assert.equal(serverUrl(LOCAL_SERVER),LOCAL_SERVER);
 for(const value of ['http://remote.test','https://user:pass@host.test','https://host.test/path','https://host.test?token=x','javascript:alert(1)'])assert.throws(()=>serverUrl(value));
});
test('pairing never leaks old token and switches endpoint only after success',async()=>{
 let listener:any;const stored:any={bridgeToken:'old-secret',bridgeServer:LOCAL_SERVER};const calls:any[]=[];let rejectPair=false;
 const chrome={runtime:{id:'a'.repeat(32),onMessage:{addListener:(fn:any)=>listener=fn}},storage:{local:{get:async()=>({...stored}),set:async(value:any)=>Object.assign(stored,value)}},action:{onClicked:{addListener:()=>{}}},tabs:{onRemoved:{addListener:()=>{}}}};
 const source=(await readFile('src/extension/background.ts','utf8')).replace("import {LOCAL_SERVER,serverUrl} from '../shared/server';",'');
 const compiled=await transform(source,{loader:'ts',format:'iife'});
 runInNewContext(compiled.code,{chrome,LOCAL_SERVER,serverUrl,AbortSignal,fetch:async(url:string,init:any)=>{
  calls.push({url,init});return {ok:!rejectPair,status:rejectPair?401:200,headers:{get:()=> 'application/json'},json:async()=>rejectPair?{error:'Wrong code'}:url.endsWith('/pair')?{token:'new-secret'}:{ok:true}};
 }});
 const send=(message:any)=>new Promise<any>(resolve=>listener({type:'bridge',...message},{id:chrome.runtime.id,url:'https://www.instagram.com/direct/',tab:{id:1},frameId:0},resolve));
 rejectPair=true;assert.equal((await send({path:'/pair',method:'POST',server:'https://new.test',body:{code:'bad'}})).ok,false);
 assert.equal(stored.bridgeServer,LOCAL_SERVER);assert.equal(calls[0].init.headers.Authorization,undefined);
 rejectPair=false;const paired=await send({path:'/pair',method:'POST',server:'https://new.test',body:{code:'valid'}});
 assert.equal(paired.ok,true);assert.equal(paired.data.token,undefined);assert.equal(stored.bridgeServer,'https://new.test');
 await send({path:'/settings'});assert.equal(calls[2].url,'https://new.test/settings');assert.equal(calls[2].init.headers.Authorization,'Bearer new-secret');assert.equal(calls[2].init.redirect,'error');
});
