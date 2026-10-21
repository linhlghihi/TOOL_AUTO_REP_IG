import { mkdir,writeFile,readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Agy } from '../src/bridge/agy';
const dir=resolve('.local/probe');await mkdir(dir,{recursive:true});
const agy=new Agy(dir);
const originalProcess=agy.process.bind(agy);
agy.process=async(...args)=>{const output=await originalProcess(...args);await writeFile(resolve('.local/probe-last-output.jsonl'),output);return output;};
const model=process.env.AGY_MODEL||'gemini-3.8-flash-high';
const schema={type:'object',properties:{answer:{type:'string'}},required:['answer'],additionalProperties:false};
const report:any={model,at:new Date().toISOString()};
for(const kind of ['text','image','audio'] as const){
 const file=process.argv.find(a=>a.startsWith(`--${kind}=`))?.split('=').slice(1).join('=');
 if(kind!=='text'&&!file){report[kind]={status:'not-tested'};continue;}
 try{
  const prompt=kind==='text'?'Return JSON answer: READY. Do not call tools.':kind==='image'?'Describe the actual colors and objects in the attached image. If no attachment was received say MISSING. Do not call tools.':'Transcribe the attached audio verbatim. If no audio was received say MISSING. Do not call tools.';
  report[kind]={status:'completed',result:await agy.json(prompt,model,schema,AbortSignal.timeout(130000),file?[{mime:kind==='image'?'image/png':'audio/wav',data:(await readFile(file)).toString('base64')}]:[])};
 }catch(e){report[kind]={status:'error',error:(e as Error).message};}
 console.log(kind,JSON.stringify(report[kind]));
}
await writeFile(resolve('.local/agy-probe.json'),JSON.stringify(report,null,2));
