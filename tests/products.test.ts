import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProductLinks} from '../src/shared/product-links';
import {productSource,readProductLinks} from '../src/bridge/products';
import {Store} from '../src/bridge/store';
import {Engine,GenerateSchema} from '../src/bridge/engine';
import type {AIResult,Snapshot} from '../src/shared/types';
const snapshot:Snapshot={account:'shop',thread:'123456',customer:'Test',source:'network',confirmed:true,messages:[{id:'m1',sender:'customer',text:'Can you recommend two tables?',media:[]}]};
const result=(extra:Partial<AIResult>={}):AIResult=>({language:'en',reply:'Two options for you.',needsProductLinks:false,questions:[],needsWebsite:false,searchTerms:[],warnings:[],...extra});
async function finish(engine:Engine,id:string){for(let n=0;n<100;n++){const job=engine.jobs.get(id)!;if(['done','error','cancelled'].includes(job.status))return job;await new Promise(r=>setTimeout(r,5));}throw new Error('Timeout');}
test('product links normalize and enforce URL and count constraints',async()=>{
 assert.deepEqual(normalizeProductLinks(['https://shop.test/products/a#detail',' https://shop.test/products/a ']),['https://shop.test/products/a']);
 for(const url of ['http://shop.test/a','https://user:pass@shop.test/a','https://shop.test:444/a','https://shop.test/cart/add','javascript:alert(1)'])assert.throws(()=>normalizeProductLinks([url]));
 assert.throws(()=>normalizeProductLinks(Array(7).fill('https://shop.test/a')));
 const read=await readProductLinks(['https://127.0.0.1/product'],new AbortController().signal);assert.equal(read.sources.length,0);assert.equal(read.errors.length,1);
});
test('product page extraction retains product details, offer currency, and source URL',()=>{
 const page=productSource('<title>Oak table</title><script type="application/ld+json">{"@type":"Product","offers":{"price":"49","priceCurrency":"USD"}}</script><main>Solid oak coffee table. Price starts at 49 USD for the smallest size. Larger variants have a different price.</main><footer>Unrelated navigation</footer>','https://shop.test/products/a');
 assert.ok(page.text.includes('priceCurrency'));assert.ok(page.text.includes('Larger variants'));assert.ok(!page.text.includes('Unrelated navigation'));assert.equal(page.url,'https://shop.test/products/a');
});
test('recommendation pauses to ask owner instead of browsing or drafting',async()=>{
 const db=new Store(':memory:');db.saveSettings({...db.settings(),context:'Tables shop',website:'https://shop.test'});
 const engine=new Engine(db,{reply:async()=>result({needsProductLinks:true,needsWebsite:true})} as any,async()=>{throw new Error('Must not read before owner selects');});
 try{const job=await finish(engine,engine.start('tab',snapshot,GenerateSchema.parse({snapshot})).id);assert.equal(job.status,'done');assert.equal(job.result?.reply,'');assert.equal(job.result?.needsWebsite,false);assert.ok(job.result?.questions[0].includes('Dán link'));}finally{db.close();}
});
test('selected links are read before one synthesis call and never become global facts',async()=>{
 const db=new Store(':memory:');db.saveSettings({...db.settings(),context:'Tables shop'});let calls=0,reads=0;
 const links=['https://shop.test/products/a','https://shop.test/products/b'];
 const engine=new Engine(db,{reply:async(prompt:string)=>{calls++;const data=JSON.parse(prompt.split('DATA:\n')[1]);assert.deepEqual(data.selectedProductLinks,links);assert.equal(data.sources.length,2);return result();},json:async()=>{throw new Error('Must not classify selected links as shop knowledge');}} as any,async values=>{reads++;return {sources:values.map(url=>({url,title:'Table',text:'Verified table details',fetchedAt:Date.now()})),errors:[]};});
 try{const options=GenerateSchema.parse({snapshot,productLinks:links});const job=await finish(engine,engine.start('tab',snapshot,options).id);assert.equal(job.status,'done');assert.equal(job.result?.reply,'Two options for you.');assert.equal(calls,1);assert.equal(reads,1);assert.equal(db.facts('shop').length,0);assert.equal(db.facts('shop:123456').length,0);
 await finish(engine,engine.start('tab',snapshot,options).id);assert.equal(reads,2,'Re-read prices on regeneration rather than use old reply cache');
 }finally{db.close();}
});
test('one unreadable selected link blocks synthesized reply and exposes retry guidance',async()=>{
 const db=new Store(':memory:');db.saveSettings({...db.settings(),context:'Tables shop'});let calls=0;
 const engine=new Engine(db,{reply:async()=>{calls++;return result();}} as any,async()=>({sources:[],errors:['https://shop.test/products/a — HTTP 404']}));
 try{const job=await finish(engine,engine.start('tab',snapshot,GenerateSchema.parse({snapshot,productLinks:['https://shop.test/products/a']})).id);assert.equal(job.result?.needsProductLinks,true);assert.equal(job.result?.reply,'');assert.equal(calls,0);assert.ok(job.result?.warnings[0].includes('404'));}finally{db.close();}
});
