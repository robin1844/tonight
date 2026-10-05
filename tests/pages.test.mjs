import test from 'node:test';
import assert from 'node:assert/strict';
import {createPagesAPI} from '../public/pages-api.mjs';
import catalogue from '../dist/catalogue/index.js';
test('Pages ratings stay in the browser and detect competing saves',async()=>{
 const data=new Map(),calls=[];const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 const api=createPagesAPI({backend:'https://catalogue.example',storage,fetchImpl:async(url,opts)=>{calls.push([String(url),opts]);return Response.json({genres:['Comedy'],indexPages:6});}});
 const first=await api('/api/boot');assert.equal(first.revision,0);assert.equal(first.profile.genre,'Romantic comedy');
 const next=await api('/api/profile',{body:JSON.stringify({profile:{...first.profile,feedback:{'tmdb:1':'loved'}},revision:0})});assert.equal(next.revision,1);assert.equal(calls.length,1);assert.equal(calls[0][1].credentials,'omit');
 await assert.rejects(api('/api/profile',{body:JSON.stringify({profile:first.profile,revision:0})}),/another tab/);
 assert.equal((await api('/api/boot')).profile.feedback['tmdb:1'],'loved');
});
test('Pages reports unavailable local storage without claiming to save',async()=>{
 const api=createPagesAPI({backend:'https://catalogue.example',storage:{getItem:()=>null,setItem:()=>{throw Error('blocked');}}});
 await assert.rejects(api('/api/profile',{body:JSON.stringify({profile:{},revision:0})}),/could not save/);
});
test('public catalogue exposes metadata but no profile or writes',async()=>{
 const env={get DB(){throw Error('Private database must never be accessed');}};
 const metadata=await catalogue.fetch(new Request('https://catalogue.example/api/meta'),env);assert.equal(metadata.status,200);assert.equal(metadata.headers.get('Access-Control-Allow-Origin'),'https://robin1844.github.io');const result=await metadata.json();assert.ok(result.genres.some(g=>g.name==='Romantic comedy'));assert.ok(result.indexPages>0);assert.equal(result.profile,undefined);
 for(const path of ['/api/profile','/api/boot'])assert.equal((await catalogue.fetch(new Request('https://catalogue.example'+path),env)).status,404);
 assert.equal((await catalogue.fetch(new Request('https://catalogue.example/api/search',{method:'POST'}),env)).status,405);
});

