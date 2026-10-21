import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { normalizeThreads,readDom,routeThread,calibrateDom } from '../src/extension/extract';
import { Store } from '../src/bridge/store';
import { Engine,GenerateSchema } from '../src/bridge/engine';
import { parseEnvelope } from '../src/bridge/agy';
import { publicAddress,allowedMedia,websiteScope,publicFetch } from '../src/bridge/network';
import { type AIResult,type Snapshot } from '../src/shared/types';
const snapshot=(thread='123456'):Snapshot=>({account:'100',thread,customer:'Test',source:'network',confirmed:true,messages:[{id:'m1',sender:'customer',text:'What sizes?',timestamp:1,media:[]}]});
const result=():AIResult=>({needsProductLinks:false,language:'English',reply:'We have S and M.',questions:[],needsWebsite:false,searchTerms:[],warnings:[]});
const options=(s:Snapshot)=>GenerateSchema.parse({snapshot:s});
async function done(engine:Engine,id:string){for(let i=0;i<200;i++){const job=engine.jobs.get(id)!;if(['done','error','cancelled'].includes(job.status))return job;await new Promise(r=>setTimeout(r,5));}throw new Error('Test job timed out');}
test('network IDs distinguish IG ID from sender FBID and preserve repeated messages',()=>{
 const thread={thread_key:'123456',viewer_id:'100',viewer:{id:'unrelated'},thread_title:'Test',slide_messages:{edges:[
  {node:{message_id:'a',sender_fbid:'900',sender:{igid:'100'},text_body:'Hi',timestamp_ms:'2',content:{__typename:'SlideMessageText'}}},
  {node:{message_id:'b',sender_fbid:'901',sender:{igid:'101'},text_body:'Hi',timestamp_ms:'1',content:{__typename:'SlideMessageText'}}}
 ]}};
 const [s]=normalizeThreads({data:{thread}});assert.equal(s.messages.length,2);assert.equal(s.messages[0].sender,'customer');assert.equal(s.messages[1].sender,'self');assert.equal(s.confirmed,true);
});
test('unknown sender is never guessed',()=>{
 const [s]=normalizeThreads({thread_key:'123456',viewer_id:'100',slide_messages:{edges:[{node:{message_id:'m',sender_fbid:'123',text_body:'hello',content:{__typename:'SlideMessageText'}}}]}});assert.equal(s.confirmed,false);assert.equal(s.messages[0].sender,'unknown');
});
test('DOM reads only message articles, preserves repetitions and requires confirmation',()=>{
 const doc=new JSDOM('<main><div role="article" aria-roledescription="message">Hello</div><div role="group" aria-label="Message actions">Reply Delete</div><div role="article" aria-roledescription="message">Hello</div><div contenteditable="true" role="textbox">draft</div></main>').window.document;
 const s=readDom(doc,'123456')!;assert.equal(s.messages.length,2);assert.notEqual(s.messages[0].id,s.messages[1].id);assert.equal(s.messages[0].text,'Hello');assert.equal(s.confirmed,false);assert.equal(routeThread('/direct/t/123456/'),'123456');assert.equal(routeThread('/direct/inbox/'),undefined);
});
test('realtime DOM sender requires calibration against both known sides',()=>{
 const doc=new JSDOM('<main><div style="display:flex;flex-direction:row"><div role="article" aria-roledescription="message">Hello</div></div><div style="display:flex;flex-direction:row-reverse"><div role="article" aria-roledescription="message">Hi!</div></div><div style="display:flex;flex-direction:row"><div role="article" aria-roledescription="message">Price?</div></div></main>').window.document;
 const network=snapshot();network.messages=[{id:'a',sender:'customer',text:'Hello',media:[]},{id:'b',sender:'self',text:'Hi!',media:[]}];
 const dom=readDom(doc,'123456')!;const calibrated=calibrateDom(doc,dom,network);assert.equal(calibrated.confirmed,true);assert.equal(calibrated.messages[2].sender,'customer');assert.equal(calibrated.messages[1].id,'b');
 network.messages.pop();assert.equal(calibrateDom(doc,dom,network).confirmed,false);
});
test('SQLite merges edits/tombstones, isolates customers and invalidates cache',()=>{
 const db=new Store(':memory:');const s=snapshot();db.merge(s);db.merge({...s,messages:[{...s.messages[0],text:'edited'}]});assert.equal(db.merge({...s,messages:[]}).messages[0].text,'edited');
 db.merge({...s,messages:[{...s.messages[0],deleted:true,text:''}]});assert.equal(db.merge({...s,messages:[]}).messages[0].deleted,true);assert.equal(db.merge(snapshot('222222')).messages.length,1);
 db.cache('reply:x',{a:1});db.cache('translation:x',{vi:'xin chào'});assert.deepEqual(db.cached('reply:x'),{a:1});db.saveSettings({...db.settings(),context:'New'});assert.equal(db.cached('reply:x'),undefined);assert.ok(db.cached('translation:x'));db.addFact('100:123456','q','private');assert.equal(db.facts('100:222222').length,0);db.close();
});
test('AGY envelope uses structured output and rejects errors',()=>{
 assert.deepEqual(parseEnvelope(JSON.stringify({event:'result',result:{status:'SUCCESS',response:'noise',structured_output:{ok:true}}})),{ok:true});
 assert.deepEqual(parseEnvelope(JSON.stringify({status:'SUCCESS',response:'```json\n{"a":1}\n```\n{"a":2}'})),{a:2});
 assert.deepEqual(parseEnvelope(JSON.stringify({status:'SUCCESS',structured_output:{answer:'{"language":"en"}'}})),{language:'en'});
 assert.throws(()=>parseEnvelope(JSON.stringify({status:'ERROR',error:'Denied'})),/Denied/);
});
test('web access blocks local networks and out-of-scope media',async()=>{
 for(const ip of ['127.0.0.1','10.1.1.1','172.20.1.1','192.168.0.1','169.254.169.254','::1','::ffff:127.0.0.1','fd00::1'])assert.equal(publicAddress(ip),false,ip);
 assert.equal(publicAddress('8.8.8.8'),true);assert.equal(allowedMedia('https://scontent.cdninstagram.com/image.jpg'),true);assert.equal(allowedMedia('https://cdninstagram.com.evil.test/x'),false);assert.equal(allowedMedia('http://cdninstagram.com/x'),false);
 assert.equal(websiteScope('https://shop.test')('https://other.test'),false);
 await assert.rejects(publicFetch('https://127.0.0.1/',()=>true),/nội bộ/);
});
test('unread media and clarification questions always block customer reply',async()=>{
 const db=new Store(':memory:');db.saveSettings({...db.settings(),context:'Sizes S and M.'});
 const engine=new Engine(db,{reply:async()=>result()} as any);const s=snapshot();s.messages[0].media=[{kind:'unsupported',label:'Voice'}];
 const j=engine.start('one',s,options(s));const completed=await done(engine,j.id);assert.equal(completed.status,'done');assert.equal(completed.result?.reply,'');assert.ok(completed.result?.questions.length);db.close();
});
test('cache prevents repeat generation and never crosses threads',async()=>{
 const db=new Store(':memory:');db.saveSettings({...db.settings(),context:'Sizes S and M.'});let calls=0;
 const engine=new Engine(db,{reply:async()=>{calls++;return result();}} as any);
 const s=snapshot();await done(engine,engine.start('one',s,options(s)).id);const second=await done(engine,engine.start('one',s,options(s)).id);assert.equal(calls,1);assert.equal(second.cached,true);
 const other=snapshot('222222');await done(engine,engine.start('one',other,options(other)).id);assert.equal(calls,2);db.close();
});
test('switching conversations cancels old work without delivering a stale result',async()=>{
 const db=new Store(':memory:');db.saveSettings({...db.settings(),context:'Sizes S and M.'});
 let release:()=>void=()=>{};let started=false;
 const engine=new Engine(db,{reply:async()=>{if(!started){started=true;await new Promise<void>(r=>release=r);}return result();}} as any);
 const a=snapshot(),b=snapshot('222222');const first=engine.start('tab',a,options(a));await new Promise(r=>setTimeout(r,5));const second=engine.start('tab',b,options(b));release();
 assert.equal((await done(engine,first.id)).status,'cancelled');assert.equal((await done(engine,second.id)).status,'done');assert.equal(engine.owners.get('tab'),second.id);assert.equal(first.result,undefined);db.close();
});
test('last own message skips AI entirely',async()=>{
 const db=new Store(':memory:');db.saveSettings({...db.settings(),context:'Sizes S and M.'});let calls=0;const engine=new Engine(db,{reply:async()=>{calls++;return result();}} as any);const s=snapshot();s.messages[0].sender='self';const j=await done(engine,engine.start('tab',s,options(s)).id);assert.equal(j.result?.reply,'');assert.equal(calls,0);db.close();
});
