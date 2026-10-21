import { spawn } from 'node:child_process';
import { mkdtemp,writeFile,rm,mkdir } from 'node:fs/promises';
import { join,resolve,sep } from 'node:path';
import { ResultSchema,resultJsonSchema,type AIResult } from '../shared/types';
export type Attachment={mime:string;data:string};
export function parseEnvelope(output:string):any {
 const lines=output.split(/\r?\n/).filter(Boolean);let final:any;
 for(const line of lines){try{const v=JSON.parse(line);if(v.event==='result')final=v.result;else if(v.status)final=v;}catch{}}
 if(!final)throw new Error('AGY không trả kết quả JSON hợp lệ.');
 if(final.status!=='SUCCESS')throw new Error(`AGY: ${String(final.error||final.status).slice(0,500)}`);
 let response=final.structured_output??final.response;
 // finish may wrap an already-serialized structured answer in {answer: "{...}"}.
 const unwrap=(v:any)=>{for(let i=0;i<3;i++){if(!v||typeof v!=='object'||Object.keys(v).length!==1||typeof v.answer!=='string')break;try{const inner=JSON.parse(v.answer);if(!inner||typeof inner!=='object')break;v=inner;}catch{break;}}return v;};
 response=unwrap(response);
 if(typeof response==='string'){
  response=response.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  try{return unwrap(JSON.parse(response));}catch{
   // Some CLI versions concatenate a draft JSON and the final JSON in response.
   const candidates:any[]=[];let start=-1,depth=0,quoted=false,escaped=false;
   for(let i=0;i<response.length;i++){
    const ch=response[i];if(start<0){if(ch==='{'){start=i;depth=1;}continue;}
    if(quoted){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')quoted=false;continue;}
    if(ch==='"')quoted=true;else if(ch==='{')depth++;else if(ch==='}'&&--depth===0){try{candidates.push(JSON.parse(response.slice(start,i+1)));}catch{}start=-1;}
   }
   if(candidates.length)return unwrap(candidates.at(-1));
   throw new Error('AGY trả nội dung không đúng JSON yêu cầu.');
  }
 }
 return response;
}
export class Agy {
 constructor(private dir:string,private executable=process.env.AGY_PATH||'agy'){}
 async models():Promise<string[]>{
  const output=await this.process(['models'],undefined,AbortSignal.timeout(20000),this.dir);
  return output.split(/\r?\n/).map(x=>x.split(/\s+/)[0]).filter(x=>/^(gemini|claude|gpt|o\d)[a-zA-Z0-9._-]*$/.test(x));
 }
 async process(args:string[],input:string|undefined,signal:AbortSignal,cwd:string):Promise<string>{
  await mkdir(cwd,{recursive:true});
  return new Promise((resolvePromise,reject)=>{
   if(signal.aborted){reject(new Error('Đã hủy.'));return;}
   const child=spawn(this.executable,args,{cwd,windowsHide:true,shell:false,stdio:['pipe','pipe','pipe']});
   let out='',err='',limitError=false;
   const abort=()=>{if(child.pid&&process.platform==='win32')spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else child.kill('SIGTERM');};
   signal.addEventListener('abort',abort,{once:true});
   child.stdout.on('data',b=>{if(limitError)return;out+=b;if(out.length>8_000_000){limitError=true;abort();}});
   child.stderr.on('data',b=>{err=(err+b).slice(-4000);});
   child.on('error',e=>{signal.removeEventListener('abort',abort);reject(e);});
   child.on('close',code=>{signal.removeEventListener('abort',abort);if(limitError)reject(new Error('AGY trả quá nhiều dữ liệu.'));else if(signal.aborted)reject(new Error('Đã hủy hoặc hết thời gian xử lý.'));else if(code!==0)reject(new Error(`AGY lỗi ${code}: ${err.slice(-600)}`));else resolvePromise(out);});
   child.stdin.on('error',()=>{});child.stdin.end(input);
  });
 }
 async json(prompt:string,model:string,schema:unknown,signal:AbortSignal,attachments:Attachment[]=[]):Promise<any>{
  const work=await mkdtemp(join(this.dir,'turn-'));
  try{
   await mkdir(join(work,'.agents'),{recursive:true});
   const paths:string[]=[];
   for(let i=0;i<attachments.length;i++){
    const media=attachments[i];
    if(!media.mime.startsWith('image/'))throw new Error('AGY CLI headless hiện chỉ nhận text; chưa có cách đọc voice được kiểm chứng. Hãy mô tả voice bằng chữ.');
    const ext=media.mime==='image/jpeg'?'jpg':media.mime.split('/')[1];
    if(!['png','jpg','webp','gif'].includes(ext))throw new Error('Định dạng ảnh chưa hỗ trợ.');
    const path=join(work,`media-${i}.${ext}`);await writeFile(path,Buffer.from(media.data,'base64'));paths.push(path);
   }
   const hookPath=join(work,'.agents','deny-tools.cjs');
   await writeFile(hookPath,`const path=require('node:path');const allowed=${JSON.stringify(paths.map(p=>p.toLowerCase()))};let s='';process.stdin.on('data',b=>s+=b);process.stdin.on('end',()=>{const x=JSON.parse(s||'{}'),t=x.toolCall||{},p=t.args?.AbsolutePath||t.args?.Path;const read=['view_file','read_file'].includes(t.name)&&typeof p==='string'&&allowed.includes(path.resolve(p).toLowerCase());console.log(JSON.stringify({decision:t.name==='finish'||read?'allow':'deny',reason:'Only final response and exact attached image reads are permitted. No other tools or sending messages.'}));});`);
   if(/[\"%\r\n]/.test(process.execPath+hookPath))throw new Error('Đường dẫn chạy hook không được hỗ trợ.');
   await writeFile(join(work,'.agents','hooks.json'),JSON.stringify({'ig-inference-only':{PreToolUse:[{matcher:'*',hooks:[{type:'command',command:'node deny-tools.cjs',timeout:10}]}]}}));
   const schemaPath=join(work,'output.schema.json');await writeFile(schemaPath,JSON.stringify(schema));
   const content:any[]=[{type:'text',text:prompt+'\n'+(paths.length?'For this image analysis only, use view_file to inspect these exact attached local images: '+JSON.stringify(paths)+'. This permitted image read overrides the generic no-tools instruction. No other tools are allowed.\n':'')+'Return exactly one JSON object with this schema: '+JSON.stringify(schema)}];
   const args=['--print=','--input-format','stream-json','--output-format','stream-json','--model',model,'--json-schema',schemaPath,'--sandbox','--disable-slash-commands','--print-timeout','120s'];
   const output=await this.process(args,JSON.stringify({event:'user',message:{role:'user',content}})+'\n',AbortSignal.any([signal,AbortSignal.timeout(130000)]),work);
   return parseEnvelope(output);
  }finally{if(!resolve(work).startsWith(resolve(this.dir)+sep))throw new Error('Workspace tạm không hợp lệ.');await rm(work,{recursive:true,force:true});}
 }
 async reply(prompt:string,model:string,signal:AbortSignal,attachments:Attachment[]=[]):Promise<AIResult>{return ResultSchema.parse(await this.json(prompt,model,resultJsonSchema,signal,attachments));}
}
