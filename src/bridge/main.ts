import { createServer,type IncomingMessage,type ServerResponse } from 'node:http';
import { randomBytes,timingSafeEqual } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { Store,digest } from './store';
import { Agy } from './agy';
import { Engine,GenerateSchema } from './engine';
import { SettingsSchema,SnapshotSchema } from '../shared/types';
import { websiteScope } from './network';
const port=Number(process.env.IG_ASSISTANT_PORT||43127);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid bridge port');
const localHost=`127.0.0.1:${port}`;
const dataDir=resolve(process.env.IG_ASSISTANT_DATA||'.local');await mkdir(join(dataDir,'agy'),{recursive:true});
const store=new Store(join(dataDir,'assistant.sqlite'));
const agy=new Agy(join(dataDir,'agy'));const engine=new Engine(store,agy);
const code=randomBytes(8).toString('hex').toUpperCase();let attempts=0;
const equal=(a:string,b:string)=>a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
async function body(req:IncomingMessage){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>2_000_000)throw new Error('Dữ liệu quá lớn.');}return text?JSON.parse(text):{};}
function send(res:ServerResponse,status:number,data:unknown){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
const server=createServer(async(req,res)=>{
 try{
  if(req.headers.host!==localHost){send(res,403,{error:'Host không hợp lệ.'});return;}
  const origin=req.headers.origin||'';
  if(origin&&!/^chrome-extension:\/\/[a-p]{32}$/.test(origin)){send(res,403,{error:'Origin không được phép.'});return;}
  if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Vary','Origin');
  if(req.method==='OPTIONS'){
   if(!origin){send(res,403,{});return;}
   res.setHeader('Access-Control-Allow-Methods','GET, POST, DELETE');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization, X-Extension-ID, X-Client-ID');res.writeHead(204);res.end();return;
  }
  const path=new URL(req.url||'/', 'http://127.0.0.1:43127').pathname;
  if(path==='/health'&&req.method==='GET'){send(res,200,{ok:true,version:'0.1.0'});return;}
  const extension=String(req.headers['x-extension-id']||'');
  if(!/^[a-p]{32}$/.test(extension)||origin&&origin!==`chrome-extension://${extension}`){send(res,403,{error:'Extension không hợp lệ.'});return;}
  if(path==='/pair'&&req.method==='POST'){
   const input=await body(req);
   if(++attempts>20){send(res,429,{error:'Quá nhiều lần thử. Khởi động lại bridge để lấy mã mới.'});return;}
   if(typeof input.code!=='string'||!equal(input.code.trim().toUpperCase(),code)){send(res,401,{error:'Mã ghép cặp không đúng.'});return;}
   const token=randomBytes(32).toString('hex');store.set(`token:${extension}`,digest(token));send(res,200,{token});return;
  }
  const token=String(req.headers.authorization||'').replace(/^Bearer /,'');
  if(!token||!equal(store.get(`token:${extension}`,''),digest(token))){send(res,401,{error:'Chưa ghép cặp hoặc token hết hiệu lực.'});return;}
  const client=String(req.headers['x-client-id']||'default').slice(0,80);const owner=`${extension}:${client}`;
  if(path==='/settings'&&req.method==='GET'){send(res,200,{settings:store.settings(),facts:store.facts('shop'),revisions:store.db.prepare('SELECT id,created,value FROM revisions ORDER BY id DESC LIMIT 10').all()});return;}
  if(path==='/settings'&&req.method==='POST'){
   const settings=SettingsSchema.parse(await body(req));if(settings.website)websiteScope(settings.website);
   const models=await agy.models();if(!models.includes(settings.model))throw new Error('Model không có trong danh sách AGY hiện tại.');
   for(const o of [...engine.owners.keys()])engine.cancel(o);
   store.saveSettings(settings);send(res,200,{ok:true});return;
  }
  if(path==='/models'&&req.method==='GET'){send(res,200,{models:await agy.models()});return;}
  if(path==='/generate'&&req.method==='POST'){
   const input=GenerateSchema.parse(await body(req));const snapshot=SnapshotSchema.parse(input.snapshot);
   const job=engine.start(owner,snapshot,input);send(res,202,{id:job.id});return;
  }
  if(path==='/cancel'&&req.method==='POST'){engine.cancel(owner);send(res,200,{ok:true});return;}
  if(path.startsWith('/jobs/')&&req.method==='GET'){
   const id=path.slice(6);if(engine.owners.get(owner)!==id){send(res,404,{error:'Tác vụ đã thay đổi hoặc bị hủy.'});return;}
   const job=engine.jobs.get(id);send(res,job?200:404,job?{...job,sources:job.sources?.map(({text,...rest})=>rest)}:{error:'Không tìm thấy tác vụ.'});return;
  }
  if(path.startsWith('/facts/')&&req.method==='DELETE'){const id=Number(path.slice(7));if(!Number.isSafeInteger(id))throw new Error('ID không hợp lệ.');store.deleteFact(id);send(res,200,{ok:true});return;}
  if(path==='/data'&&req.method==='DELETE'){for(const o of [...engine.owners.keys()])engine.cancel(o);store.clear();send(res,200,{ok:true});return;}
  send(res,404,{error:'Không tìm thấy chức năng.'});
 }catch(error){send(res,400,{error:(error as Error).message.slice(0,1000)});}
});
server.requestTimeout=20000;
server.on('error',error=>{console.error('Không mở được bridge:',error.message);process.exitCode=1;store.close();});
server.listen(port,'127.0.0.1',()=>{console.log(`IG Shop Assistant — http://127.0.0.1:43127\nMã ghép cặp: ${code}\nDữ liệu: ${dataDir}\nGiữ cửa sổ này mở khi dùng. Ctrl+C để dừng.`);});
const cleanup=setInterval(()=>store.cleanup(),3600000);cleanup.unref();
process.on('SIGINT',()=>{for(const o of [...engine.owners.keys()])engine.cancel(o);server.close();clearInterval(cleanup);setTimeout(()=>{store.close();process.exit(0);},1000).unref();});
