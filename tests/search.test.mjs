import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import {eligibleOffers} from '../src/engine.mjs';
test('film and series suggestions use exact typed identities when opened',async()=>{
 const original=globalThis.fetch;const calls=[];
 globalThis.fetch=async url=>{
  calls.push(String(url));const path=new URL(url).pathname;
  if(path.endsWith('/search/movie'))return Response.json({results:[{id:555,title:'Emily',release_date:'2022-10-14'}]});
  if(path.endsWith('/search/tv'))return Response.json({results:[{id:82596,name:'Emily in Paris',first_air_date:'2020-10-02'}]});
  if(path.endsWith('/tv/82596'))return Response.json({id:82596,name:'Emily in Paris',first_air_date:'2020-10-02',genres:[{name:'Comedy'}],keywords:{results:[{name:'paris'}]},credits:{cast:[],crew:[]}});
  if(path.endsWith('/movie/555'))return Response.json({id:555,title:'Emily',release_date:'2022-10-14',genres:[],keywords:{keywords:[]},credits:{cast:[],crew:[]}});
  throw Error('Unexpected route');
 };
 try{
  const env={TMDB_READ_TOKEN:'test'};
  const result=await(await worker.fetch(new Request('https://tonight.example/api/search?q=Emily'),env)).json();
  assert.equal(result.results.length,2);
  for(const suggestion of result.results){
   const title=await(await worker.fetch(new Request(`https://tonight.example/api/movie?id=${suggestion.id}&kind=${suggestion.kind}`),env)).json();
   assert.equal(title.title,suggestion.title);assert.equal(title.kind,suggestion.kind);
   assert.equal(title.id,suggestion.kind==='tv'?'tmdb:tv:82596':'tmdb:555');
  }
  assert.ok(calls.some(c=>c.includes('/tv/82596')));
  assert.equal((await worker.fetch(new Request('https://tonight.example/api/movie?id=82596&kind=person'),env)).status,400);
 }finally{globalThis.fetch=original;}
});
test('availability search checks exact GB base subscriptions without genre or watched exclusions',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async url=>{
  const path=new URL(url).pathname;
  if(path.endsWith('/watch/providers/movie'))return Response.json({results:[{provider_id:8,provider_name:'Netflix'},{provider_id:9,provider_name:'Amazon Prime Video'}]});
  if(path.endsWith('/watch/providers'))return Response.json({results:{GB:{link:'https://example.org/watch',flatrate:path.includes('/777/')?[{provider_id:9},{provider_id:98}]:[{provider_id:98}],rent:[{provider_id:8}]},US:{flatrate:[{provider_id:8}]}}});
  return Response.json({id:Number(path.split('/').at(-1)),title:'Specific film',genres:[{name:'Horror'}],keywords:{keywords:[]},credits:{cast:[],crew:[]}});
 };
 try{
  const env={TMDB_READ_TOKEN:'test'};
  const film=await(await worker.fetch(new Request('https://tonight.example/api/availability?id=777'),env)).json();
  assert.equal(film.title,'Specific film');assert.deepEqual(film.offers.map(o=>o.service),['prime']);
  assert.equal(eligibleOffers(film,{country:'GB',services:['netflix']}).length,0);
  assert.equal(eligibleOffers(film,{country:'GB',services:['prime'],genre:'Romantic comedy',feedback:{'tmdb:777':'seen'}}).length,1);
  const unavailable=await(await worker.fetch(new Request('https://tonight.example/api/availability?id=778'),env)).json();
  assert.deepEqual(unavailable.offers,[]);
  assert.equal((await worker.fetch(new Request('https://tonight.example/api/availability?id=bad'),env)).status,400);
 }finally{globalThis.fetch=original;}
});
