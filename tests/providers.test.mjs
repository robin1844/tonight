import test from 'node:test';
import assert from 'node:assert/strict';
import {providerMap,tmdbOffers,eligibleOffers,adConfidence,DAY,matchesCategory} from '../src/engine.mjs';
import {screenProvider} from '../src/provider-screen.mjs';
import worker from '../dist/server/index.js';
test('exact subscription provider names exclude Apple rentals and paid channels',()=>{
 const map=providerMap([{provider_id:350,provider_name:'Apple TV'},{provider_id:2,provider_name:'Apple TV Store'},{provider_id:337,provider_name:'Disney Plus'},{provider_id:2243,provider_name:'Apple TV Amazon Channel'}]);assert.deepEqual([...map.values()],['apple','disney']);
 const offers=tmdbOffers({results:{GB:{flatrate:[{provider_id:350},{provider_id:337},{provider_id:2243},{provider_id:2}],rent:[{provider_id:350}]}}},map,new Date().toISOString());assert.equal(offers.length,2);
 assert.equal(eligibleOffers({offers},{country:'GB',services:['netflix','prime']}).length,0);assert.equal(eligibleOffers({offers},{country:'GB',services:['apple']}).length,1);
});
test('Apple confirms only English AD in the UK visible audio section',()=>{
 const page='<html lang="en-GB"><h1>CODA</h1><dt data-testid="information-releaseDate">Released</dt><dd>2021</dd><dt data-testid="languages-audio">Audio</dt><dd>English (AD, AAC), French (AD)</dd></html>';
 const source='https://tv.apple.com/gb/movie/coda/umc.cmc.test',date=new Date().toISOString();assert.equal(screenProvider(page,source,date).status,'available');assert.equal(screenProvider(page,source,date).year,'2021');
 assert.equal(screenProvider(page.replace('English (AD, AAC)','English (AAC)'),source,date).status,'unknown');assert.equal(screenProvider(page.replace('en-GB','en-US'),source,date).status,'unknown');assert.equal(screenProvider(page,source.replace('/gb/','/us/'),date),null);
 const embedded='<html lang="en-GB"><h1>CODA</h1><script>English (AD)</script></html>';assert.equal(screenProvider(embedded,source,date).status,'unknown');
});
test('Disney badge has high ranking priority without claiming confirmed English AD',()=>{
 const source='https://www.disneyplus.com/en-gb/browse/entity-test',checkedAt=new Date().toISOString();const page='<img alt="Audio Description"><h1>Pretty Woman</h1><div data-section="Categories">Romantic Comedy, Romance</div>Release Date: 1990';const s=screenProvider(page,source,checkedAt);assert.equal(s.status,'possible');assert.equal(s.language,'und');assert.equal(matchesCategory({categoryEvidence:s.categoryEvidence},'Romantic comedy'),true);
 const title={adEvidence:[s],offers:[{country:'GB',service:'disney',type:'subscription',checkedAt}]},settings={country:'GB',services:['disney'],adMaxAge:30*DAY};assert.equal(s.kind,'provider-ad-badge');assert.equal(adConfidence(title,settings).level,3);assert.equal(adConfidence(title,{...settings,services:['apple']}).level,0);
 assert.equal(screenProvider(page.replace('<img alt="Audio Description">','<script>alt="Audio Description"</script>'),source,checkedAt).status,'unknown');
});
test('discovery queries selected new subscriptions and exact offer checks reject rentals',async()=>{
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async raw=>{const u=new URL(raw);calls.push(u);if(u.pathname.endsWith('/genre/movie/list'))return Response.json({genres:[]});if(u.pathname.endsWith('/watch/providers/movie'))return Response.json({results:[{provider_id:8,provider_name:'Netflix'},{provider_id:9,provider_name:'Amazon Prime Video'},{provider_id:350,provider_name:'Apple TV'},{provider_id:337,provider_name:'Disney Plus'},{provider_id:2,provider_name:'Apple TV Store'}]});if(u.pathname.endsWith('/discover/movie'))return Response.json({results:[{id:881188}],total_pages:1});if(u.pathname.endsWith('/watch/providers'))return Response.json({results:{GB:{flatrate:[{provider_id:350},{provider_id:2}],rent:[{provider_id:337}]}}});return Response.json({id:881188,title:'Selected subscription film',genres:[],keywords:{keywords:[]},credits:{cast:[],crew:[]}});};
 try{const response=await worker.fetch(new Request('https://tonight.example/api/candidates?services=apple,disney'),{TMDB_READ_TOKEN:'test'});assert.equal(response.status,200);const result=await response.json();assert.deepEqual(result.titles[0].offers.map(o=>o.service),['apple']);assert.equal(calls.find(u=>u.pathname.endsWith('/discover/movie')).searchParams.get('with_watch_providers'),'350|337');assert.equal((await worker.fetch(new Request('https://tonight.example/api/candidates?services=store'),{TMDB_READ_TOKEN:'test'})).status,400);}finally{globalThis.fetch=original;}
});
