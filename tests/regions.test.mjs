import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import {adConfidence,tmdbOffers} from '../src/engine.mjs';
import {screenRegionalProvider} from '../src/regional-screen.mjs';
import {createPagesAPI} from '../public/pages-api.mjs';
test('country changes preserve browser taste and services and reach the catalogue',async()=>{
 const values=new Map(),calls=[];const api=createPagesAPI({backend:'https://catalogue.example',storage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},fetchImpl:async u=>{calls.push(new URL(u));return Response.json({});}});
 let {profile}=await api('/api/boot');profile={...profile,country:'CA',feedback:{'tmdb:1':'loved'}};
 await api('/api/profile',{body:JSON.stringify({profile,revision:0})});await api('/api/availability?id=1');
 assert.equal(calls.at(-1).searchParams.get('country'),'CA');
 const saved=await api('/api/boot');assert.deepEqual(saved.profile.services,['netflix','prime']);assert.deepEqual(saved.profile.feedback,profile.feedback);
});
test('US and Canadian recommendations and search availability use local subscriptions only',async()=>{
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async input=>{const u=new URL(input);calls.push(u);let data;
  if(u.pathname.endsWith('/watch/providers/movie'))data={results:[{provider_id:8,provider_name:'Netflix'},{provider_id:9,provider_name:'Amazon Prime Video'}]};
  else if(u.pathname.endsWith('/watch/providers'))data={results:{GB:{link:'https://example.org/gb',flatrate:[{provider_id:8}]},US:{link:'https://example.org/us',flatrate:[{provider_id:9}]},CA:{link:'https://example.org/ca',rent:[{provider_id:9}],flatrate:[{provider_id:8}]}}};
  else if(u.pathname.endsWith('/genre/movie/list'))data={genres:[{id:35,name:'Comedy'}]};
  else if(u.pathname.endsWith('/discover/movie'))data={results:[{id:353577}],total_pages:1};
  else data={id:353577,title:'Love at First Sight',release_date:'2023-01-01',genres:[{name:'Comedy'}],keywords:{keywords:[]},credits:{}};
  return Response.json(data);
 };
 try{for(const country of ['US','CA']){
  const env={TMDB_READ_TOKEN:'test'};
  const film=await(await worker.fetch(new Request(`https://tonight.example/api/availability?id=353577&country=${country}`),env)).json();
  assert.ok(film.offers.every(o=>o.country===country));assert.ok(film.adEvidence.every(a=>a.country===country));assert.ok(film.offers.every(o=>!o.directUrl?.includes('/gb/')));
  const selection=await(await worker.fetch(new Request(`https://tonight.example/api/candidates?genre=comedy&country=${country}`),env)).json();assert.equal(selection.titles.length,1);assert.ok(selection.titles[0].offers.every(o=>o.country===country));assert.ok(selection.titles[0].adEvidence.every(a=>a.country===country));
  assert.ok(calls.some(u=>u.pathname.endsWith('/discover/movie')&&u.searchParams.get('watch_region')===country));
 }}finally{globalThis.fetch=original;}
});
test('UK and unknown-territory AD cannot influence another country',()=>{
 const checkedAt=new Date().toISOString(),settings={country:'CA',services:['netflix']};
 const film={offers:[{country:'CA',service:'netflix',type:'subscription',checkedAt}],adEvidence:[{country:'GB',service:'netflix',scope:'movie',status:'available',language:'en',source:'https://example.org',checkedAt}]};
 assert.equal(adConfidence(film,settings).level,0);film.adEvidence[0].country='unknown';assert.equal(adConfidence(film,settings).level,0);
 film.adEvidence[0].country='CA';assert.equal(adConfidence(film,settings).level,4);
});
test('regional screening rejects redirects, wrong language-region and mismatched canonical pages',()=>{
 const url='https://tv.apple.com/ca/movie/test/id';const html='<html lang="en-CA"><link rel="canonical" href="'+url+'"><h1>Test</h1><dd data-testid="information-releaseDate">2020</dd><dt data-testid="languages-audio">Audio</dt><dd>English (AD)</dd></html>';
 assert.equal(screenRegionalProvider(html,url,url,'CA',new Date().toISOString()).status,'available');
 assert.equal(screenRegionalProvider(html,url,url.replace('/ca/','/gb/'),'CA',''),null);
 assert.equal(screenRegionalProvider(html.replace('en-CA','en-GB'),url,url,'CA',''),null);
 assert.equal(screenRegionalProvider(html.replace('href="'+url,'href="https://wrong.example'),url,url,'CA',''),null);
});
