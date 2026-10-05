import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import worker from '../dist/server/index.js';
function env(){const db=new DatabaseSync(':memory:');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')))db.exec(readFileSync(`drizzle/${f}`,'utf8'));return {DB:{prepare(sql){const s=db.prepare(sql);let values=[];return {bind(...v){values=v;return this;},async first(){return s.get(...values)||null;},async run(){return {meta:{changes:Number(s.run(...values).changes)}};}};}}};}
const p={country:'GB',services:['netflix','prime'],genre:'Romance',adOnly:false,feedback:{},anchors:[]};
function request(profile,revision,origin='https://tonight.example'){return new Request('https://tonight.example/api/profile',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({profile,revision})});}
test('profile is saved durably and revisions prevent lost updates',async()=>{
  const e=env();let r=await worker.fetch(request(p,0),e);assert.equal(r.status,200);assert.equal((await r.json()).revision,1);
  assert.equal((await worker.fetch(request({...p,genre:'Comedy'},0),e)).status,409);
  assert.equal((await worker.fetch(request({...p,genre:'Comedy'},1),e)).status,200);
  const stored=await e.DB.prepare('SELECT profile, revision FROM household WHERE id = 1').first();
  assert.equal(JSON.parse(stored.profile).genre,'Comedy');assert.equal(stored.revision,2);
  assert.equal((await worker.fetch(request({...p,genre:'Horror'},1),e)).status,409);
});
test('cross-origin saves are rejected',async()=>assert.equal((await worker.fetch(request(p,0,'https://other.example'),env())).status,403));
test('invalid ratings and unsupported subscriptions cannot be saved',async()=>{
  for(const profile of [{...p,services:['starz']},{...p,country:'US'},{...p,feedback:{'tmdb:1':'made-up'}},{...p,anchors:[{id:'bad',title:'x'}]}])assert.equal((await worker.fetch(request(profile,0),env())).status,400);
});
test('oversized profiles are rejected without writes',async()=>{
  const r=new Request('https://tonight.example/api/profile',{method:'POST',headers:{Origin:'https://tonight.example','Content-Type':'application/json'},body:' '.repeat(300001)});
  assert.equal((await worker.fetch(r,env())).status,413);
});
test('site serves the real app and only permitted methods',async()=>{
  const r=await worker.fetch(new Request('https://tonight.example/'),env());assert.equal(r.status,200);assert.match(await r.text(),/Teach Tonight your taste/);assert.ok(r.headers.get('Content-Security-Policy'));
  assert.equal((await worker.fetch(new Request('https://tonight.example/api/profile',{method:'DELETE'}),env())).status,405);
});
