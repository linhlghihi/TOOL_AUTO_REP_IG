import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Store} from '../src/bridge/store';
import {Agy} from '../src/bridge/agy';
import {Engine,GenerateSchema} from '../src/bridge/engine';
import type {Snapshot} from '../src/shared/types';
const dir=resolve('.local/products-smoke');await mkdir(dir,{recursive:true});
const db=new Store(':memory:');db.saveSettings({...db.settings(),model:'gemini-3.8-flash-low',context:'Wrydeco furniture shop. Recommend only products selected by the owner. Use verified page details; do not invent prices or stock.'});
const engine=new Engine(db,new Agy(dir));
const snapshot:Snapshot={account:'demo',thread:'123456',customer:'Demo',source:'network',confirmed:true,messages:[{id:'a',sender:'customer',text:'Could you recommend two natural wood coffee tables for my living room? Please send links.',media:[]}]};
async function run(productLinks:string[]){const job=engine.start('smoke',snapshot,GenerateSchema.parse({snapshot,productLinks}));while(job.status==='queued'||job.status==='running')await new Promise(r=>setTimeout(r,300));if(job.status!=='done')throw new Error(job.error||job.status);return job;}
try{
 const ask=await run([]);console.log('Asks owner:',ask.result?.needsProductLinks);if(!ask.result?.needsProductLinks||ask.result.reply)throw new Error('Did not ask owner for products');
 const links=['https://wrydeco.com/products/handcrafted-live-edge-root-wood-coffee-table','https://wrydeco.com/products/handcrafted-live-edge-natural-wood-root-coffee-table'];
 const reply=await run(links);await writeFile(resolve('.local/products-smoke-result.json'),JSON.stringify({ask:ask.result,result:reply.result,sources:reply.sources?.map(s=>s.url)},null,2));
 console.log(JSON.stringify({result:reply.result,sources:reply.sources?.map(s=>s.url)},null,2));
 if(!reply.result?.reply||reply.result.needsProductLinks||reply.sources?.length!==2||links.some(url=>!reply.result?.reply.includes(url)))throw new Error('Product synthesis incomplete');
}finally{db.close();}
