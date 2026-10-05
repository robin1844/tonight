import test from 'node:test';
import assert from 'node:assert/strict';
import {screenNetflix,identityMatch,titleLinks} from '../src/netflix-screen.mjs';
import {matchesCategory,discoveryWindow} from '../src/engine.mjs';
const url='https://www.netflix.com/gb/title/1234';
function html(type='Movie',audio='English - Audio Description',genres='Romantic Comedy Films') {return `<html lang="en-GB"><script type="application/ld+json">${JSON.stringify({'@type':type,url,name:'A Film',dateCreated:'2023-9-15'})}</script><h4>Genres</h4><span>${genres}</span><h4>Audio</h4><span>${audio}</span></html>`;}
test('screening needs movie identity and explicit English AD',()=>{
  const r=screenNetflix(html(),url,new Date().toISOString());assert.equal(r.title,'A Film');assert.equal(r.year,2023);assert.equal(r.categoryEvidence[0].category,'Romantic comedy');
  assert.equal(screenNetflix(html('TVSeries'),url,'2026-10-05'),null);
  assert.equal(screenNetflix(html('Movie','English, Spanish - Audio Description'),url,'2026-10-05'),null);
  assert.equal(screenNetflix(html().replace('en-GB','en-US'),url,'2026-10-05'),null);
});
test('identity matching rejects wrong year and ambiguous matches',()=>{
  const record={title:'A Film',year:2023},movie={id:1,title:'A Film',release_date:'2023-09-15'};
  assert.equal(identityMatch(record,[movie]).id,1);assert.equal(identityMatch(record,[{...movie,release_date:'2022-09-15'}]),null);
  assert.equal(identityMatch(record,[movie,{...movie,id:2}]),null);
});
test('official Netflix category evidence catches missing TMDB genre labels',()=>{
  assert.equal(matchesCategory({genres:['Romance','Drama'],categoryEvidence:[{category:'Romantic comedy',source:'https://media.netflix.com/en/only-on-netflix/81504327'}]},'Romantic comedy'),true);
  assert.equal(matchesCategory({genres:['Romance','Drama'],categoryEvidence:[{category:'Romantic comedy',source:'https://other.example/'}]},'Romantic comedy'),false);
});
test('three-route windows cover source pages without loss or exceeding twenty candidates',()=>{
  const streams=Array.from({length:3},(_,s)=>Array.from({length:40},(_,i)=>`${s}:${i}`));const all=[];
  for(let page=1;page<=8;page++){const w=discoveryWindow(page,3),offset=(w.sourcePage-1)*20;const items=streams.flatMap(s=>s.slice(offset,offset+20).slice(w.start,w.start+w.size));assert.ok(items.length<=20);all.push(...items);}
  assert.equal(all.length,120);assert.equal(new Set(all).size,120);
});
test('browse discovery accepts only title links and deduplicates',()=>assert.deepEqual(titleLinks('<a href="/gb/title/1234">a</a><a href="/gb/title/1234?x=1">b</a><a href="https://other.example/title/5">c</a>'),['1234']));
