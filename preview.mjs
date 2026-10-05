import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync,readdirSync } from 'node:fs';
import worker from './dist/server/index.js';
process.loadEnvFile('.env');
const db=new DatabaseSync('preview.sqlite');
db.exec('CREATE TABLE IF NOT EXISTS preview_migrations (name TEXT PRIMARY KEY)');
for(const file of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort()) {
  if(!db.prepare('SELECT name FROM preview_migrations WHERE name = ?').get(file)) {
    db.exec(readFileSync(`drizzle/${file}`,'utf8'));
    db.prepare('INSERT INTO preview_migrations (name) VALUES (?)').run(file);
  }
}
const DB={prepare(sql){const s=db.prepare(sql);let values=[];return {bind(...v){values=v;return this;},async first(){return s.get(...values)||null;},async run(){const r=s.run(...values);return {meta:{changes:Number(r.changes)}};}};}};
createServer(async(req,res)=>{try{let body='';for await(const chunk of req)body+=chunk;const request=new Request(`http://localhost:4318${req.url}`,{method:req.method,headers:req.headers,...(body?{body}:{})});const response=await worker.fetch(request,{DB,TMDB_READ_TOKEN:process.env.TMDB_READ_TOKEN});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end('Preview unavailable.');}}).listen(4318,'127.0.0.1',()=>console.log('Tonight preview: http://localhost:4318'));
