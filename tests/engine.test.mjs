import test from 'node:test';
import assert from 'node:assert/strict';
import { eligibleOffers, rankTitles, streamingOffers, tmdbOffers, netflixADEvidence, DAY } from '../src/engine.mjs';
const now = Date.parse('2026-10-05T12:00:00Z');
const checkedAt = new Date(now).toISOString();
const settings = {country:'GB',services:['netflix','prime']};
const offer = (changes={}) => ({country:'GB',service:'prime',type:'subscription',checkedAt,...changes});
const ad = (changes={}) => ({country:'GB',service:'prime',language:'en',scope:'movie',status:'available',source:'https://example.org/evidence',checkedAt,...changes});

test('base subscription is eligible',()=> assert.equal(eligibleOffers({offers:[offer()]},settings,now).length,1));
for (const [label,changes] of Object.entries({rent:{type:'rent'},purchase:{type:'buy'},channel:{addon:'starz'},
  trial:{type:'trial'},wrongCountry:{country:'US'},wrongService:{service:'paramount'},charged:{price:{amount:'3.99'}},
  stale:{checkedAt:new Date(now-DAY-1).toISOString()},future:{checkedAt:new Date(now+60001).toISOString()},
  missingDate:{checkedAt:null},expired:{expiresAt:checkedAt},invalidExpiry:{expiresAt:'not a date'}})) {
  test(`rejects ${label}`,()=>assert.equal(eligibleOffers({offers:[offer(changes)]},settings,now).length,0));
}
test('fresh server checks tolerate small device clock differences',()=>assert.equal(eligibleOffers({offers:[offer({checkedAt:new Date(now+500).toISOString()})]},settings,now).length,1));
test('AD unknown is excluded only when required',()=>{
  assert.equal(eligibleOffers({offers:[offer()]},settings,now).length,1);
  assert.equal(eligibleOffers({offers:[offer()]},{...settings,adOnly:true},now).length,0);
});
test('AD must belong to the eligible service, country, language and movie',()=>{
  for (const changes of [{service:'netflix'},{country:'US'},{language:'es'},{scope:'series-summary'},
    {status:'unknown'},{source:null},{checkedAt:new Date(now-DAY-1).toISOString()}]) {
    assert.equal(eligibleOffers({offers:[offer()],adEvidence:[ad(changes)]},{...settings,adOnly:true},now).length,0);
  }
  assert.equal(eligibleOffers({offers:[offer()],adEvidence:[ad()]},{...settings,adOnly:true},now).length,1);
});
test('Netflix AD cannot admit Prime when Netflix is a rental',()=>{
  const title={offers:[offer(),offer({service:'netflix',type:'rent'})],adEvidence:[ad({service:'netflix'})]};
  assert.equal(eligibleOffers(title,{...settings,adOnly:true},now).length,0);
});
test('TMDB provider/type cross-match does not leak a rental',()=>{
  const response={results:{GB:{link:'https://www.themoviedb.org/movie/1/watch',flatrate:[{provider_id:99}],rent:[{provider_id:8}]}}};
  assert.deepEqual(tmdbOffers(response,new Map([[8,'netflix']]),checkedAt),[]);
});
test('streaming adapter retains paid channels',()=>{
  const show={streamingOptions:{gb:[{service:{id:'prime'},type:'addon',addon:{id:'starz'},link:'https://example.org'}]}};
  assert.equal(eligibleOffers({offers:streamingOffers(show,checkedAt)},settings,now).length,0);
});
const html = audio => `<html lang="en-GB"><h4 class="x">Audio</h4><span>${audio}</span></html>`;
const source = 'https://www.netflix.com/gb/title/80200642';
test('visible English AD is recognised',()=> assert.equal(netflixADEvidence(html('English - Audio Description, English [Original]'),source,checkedAt).status,'available'));
test('ordinary English plus Spanish AD remains unknown',()=> assert.equal(netflixADEvidence(html('English, Spanish - Audio Description'),source,checkedAt).status,'unknown'));
test('embedded unrelated AD does not qualify',()=> assert.equal(netflixADEvidence(html('English')+'<script>English - Audio Description</script>',source,checkedAt).status,'unknown'));
test('wrong region and missing Audio section remain unknown',()=>{
  assert.equal(netflixADEvidence(html('English - Audio Description').replace('en-GB','en-US'),source,checkedAt).status,'unknown');
  assert.equal(netflixADEvidence('<html lang="en-GB"></html>',source,checkedAt).status,'unknown');
});
test('ratings rank matches and dislikes, unseen is neutral',()=>{
  const anchors=[{id:'love',tags:['witty']},{id:'hate',tags:['bleak']},{id:'unseen',tags:['gentle']}];
  const catalogue=['witty','bleak','gentle'].map(tag=>({id:tag,title:tag,kind:'movie',tags:[tag],offers:[offer()]}));
  const ranked=rankTitles(catalogue,anchors,{...settings,feedback:{love:'loved',hate:'disliked',unseen:'unseen'}},now);
  assert.deepEqual(ranked.map(t=>t.id),['witty','gentle','bleak']);
  assert.match(ranked[0].reasons[0],/witty/);
  assert.equal(ranked[1].score,0);
});
test('seen and series are excluded; no eligible titles means empty results',()=>{
  const t={id:'seen',title:'Seen',kind:'movie',offers:[offer()]};
  assert.deepEqual(rankTitles([t,{...t,id:'series',kind:'series'}],[],{...settings,feedback:{seen:'seen'}},now),[]);
  assert.deepEqual(rankTitles([{...t,offers:[]}],[],settings,now),[]);
});
