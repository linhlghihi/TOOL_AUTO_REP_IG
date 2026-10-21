import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { SettingsSchema,type Settings,type Snapshot,type Message } from '../shared/types';
export const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export class Store {
 db:DatabaseSync;
 constructor(path:string){
  this.db=new DatabaseSync(path);
  this.db.exec(`PRAGMA journal_mode=WAL;
   CREATE TABLE IF NOT EXISTS kv(key TEXT PRIMARY KEY,value TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS cache(key TEXT PRIMARY KEY,value TEXT NOT NULL,expires INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS threads(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS facts(id INTEGER PRIMARY KEY AUTOINCREMENT,scope TEXT NOT NULL,question TEXT NOT NULL,answer TEXT NOT NULL,created INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS revisions(id INTEGER PRIMARY KEY AUTOINCREMENT,value TEXT NOT NULL,created INTEGER NOT NULL);`);
  this.cleanup();
 }
 get<T>(key:string, fallback:T):T {const r=this.db.prepare('SELECT value FROM kv WHERE key=?').get(key) as any;return r?JSON.parse(r.value):fallback;}
 set(key:string,value:unknown){this.db.prepare('INSERT OR REPLACE INTO kv VALUES (?,?)').run(key,JSON.stringify(value));}
 settings():Settings{return SettingsSchema.parse(this.get('settings',{}));}
 saveSettings(settings:Settings){this.db.prepare('INSERT INTO revisions(value,created) VALUES (?,?)').run(JSON.stringify(this.settings()),Date.now());this.set('settings',settings);this.bump();}
 bump(){this.set('knowledgeVersion',this.get('knowledgeVersion',0)+1);this.db.exec("DELETE FROM cache WHERE key LIKE 'reply:%'");}
 cached<T>(key:string):T|undefined {const r=this.db.prepare('SELECT value FROM cache WHERE key=? AND expires>?').get(key,Date.now()) as any;return r?JSON.parse(r.value):undefined;}
 cache(key:string,value:unknown,ttl=30*86400_000){this.db.prepare('INSERT OR REPLACE INTO cache VALUES (?,?,?)').run(key,JSON.stringify(value),Date.now()+ttl);}
 key(s:Snapshot){return `${s.account}:${s.thread}`;}
 merge(s:Snapshot):Snapshot {
  const key=this.key(s); const row=this.db.prepare('SELECT value FROM threads WHERE key=?').get(key) as any;
  const previous:Snapshot|undefined=row?JSON.parse(row.value):undefined;
  // DOM-only snapshots lack stable IDs; never accumulate these as confirmed history.
  if(s.source==='dom')return s;
  const messages=new Map<string,Message>((previous?.messages||[]).map(m=>[m.id,m]));
  for(const m of s.messages)messages.set(m.id,m);
  const merged={...s,messages:[...messages.values()].sort((a,b)=>(a.timestamp||0)-(b.timestamp||0)).slice(-500)};
  this.db.prepare('INSERT OR REPLACE INTO threads VALUES (?,?,?)').run(key,JSON.stringify(merged),Date.now());return merged;
 }
 facts(scope:string){return this.db.prepare("SELECT * FROM facts WHERE scope='shop' OR scope=? ORDER BY id DESC LIMIT 100").all(scope);}
 addFact(scope:string,question:string,answer:string){this.db.prepare('INSERT INTO facts(scope,question,answer,created) VALUES (?,?,?,?)').run(scope,question,answer,Date.now());this.bump();}
 deleteFact(id:number){this.db.prepare('DELETE FROM facts WHERE id=?').run(id);this.bump();}
 cleanup(){const expiry=Date.now()-30*86400_000;this.db.prepare('DELETE FROM threads WHERE updated<?').run(expiry);this.db.prepare('DELETE FROM cache WHERE expires<?').run(Date.now());this.db.prepare("DELETE FROM facts WHERE scope!='shop' AND created<?").run(expiry);}
 clear(){this.db.exec('DELETE FROM cache; DELETE FROM threads; DELETE FROM facts; DELETE FROM revisions;');this.set('settings',SettingsSchema.parse({}));this.bump();}
 close(){this.db.close();}
}
