import test from 'node:test';
import assert from 'node:assert/strict';
import {CATEGORIES,matchesCategory,normaliseCategory,discoveryBranches,discoveryWindow,rankTitles,filmCategoryLabels} from '../src/engine.mjs';
test('romcom membership accepts either metadata route, not romance or comedy alone',()=>{
  for(const t of [{genres:['Romance','Comedy']},{genres:['Drama'],tags:['romcom']},{tags:['Romantic-Comedy']},{genres:['Romcom']}])assert.equal(matchesCategory(t,'Romantic comedy'),true);
  for(const t of [{genres:['Romance']},{genres:['Comedy']},{tags:['romance','comedy']},{tags:['not a romcom']},{}])assert.equal(matchesCategory(t,'Romantic comedy'),false);
});
test('romcom discovery independently queries both routes',()=>{
  assert.deepEqual(discoveryBranches('Romantic comedy',[{id:10749,name:'Romance'},{id:35,name:'Comedy'}]),[{with_genres:'10749,35'},{with_keywords:'9799'}]);
});
test('balanced pagination covers every film in both source pages',()=>{
  const genres=Array.from({length:40},(_,i)=>`genre-${i}`), keywords=Array.from({length:40},(_,i)=>`tag-${i}`);
  const combined=[];
  for(let p=1;p<=4;p++){const w=discoveryWindow(p,2),offset=(w.sourcePage-1)*20;for(const stream of [genres,keywords])combined.push(...stream.slice(offset+w.start,offset+w.start+w.size));}
  assert.equal(new Set(combined).size,80);assert.equal(combined.length,80);
});
test('action and adventure uses OR, old category selections retain a valid meaning',()=>{
  assert.equal(matchesCategory({genres:['Action']},'Action & adventure'),true);
  assert.equal(matchesCategory({genres:['Adventure']},'Action & adventure'),true);
  assert.equal(matchesCategory({genres:['Drama']},'Action & adventure'),false);
  assert.deepEqual(discoveryBranches('Action & adventure',[{id:28,name:'Action'},{id:12,name:'Adventure'}]),[{with_genres:'28|12'}]);
  assert.equal(normaliseCategory('Action'),'Action & adventure');assert.equal(normaliseCategory('Science Fiction'),'Science fiction');assert.equal(normaliseCategory('TV Movie'),'');
  assert.ok(CATEGORIES.some(c=>c.name==='Romance'));assert.ok(!CATEGORIES.some(c=>c.name==='TV Movie'));
});
test('tag-only romcom is not lost during ranking and subscription checks still apply',()=>{
  const now=Date.now(),offer={country:'GB',service:'netflix',type:'subscription',checkedAt:new Date(now).toISOString()};
  const titles=[{id:'a',title:'Tagged only',kind:'movie',genres:['Drama'],tags:['romcom'],offers:[offer]},{id:'b',title:'Rental',kind:'movie',tags:['romcom'],offers:[{...offer,type:'rent'}]},{id:'c',title:'Romance only',kind:'movie',genres:['Romance'],offers:[offer]}];
  assert.deepEqual(rankTitles(titles,[],{genre:'Romantic comedy',country:'GB',services:['netflix']},now).map(x=>x.id),['a']);
});

test('every ordinary category requires its actual genre and discovery uses the same rule',()=>{
 const ordinary=CATEGORIES.filter(c=>!['romantic-comedy','musical'].includes(c.id));
 const source=[...new Set(ordinary.flatMap(c=>c.genres))].map((name,i)=>({name,id:i+1}));
 for(const c of ordinary){
  assert.equal(matchesCategory({genres:[],tags:c.genres},c.name),false,c.name);
  for(const name of c.genres)assert.equal(matchesCategory({genres:[name]},c.name),true,c.name);
  const expected=c.genres.map(n=>source.find(g=>g.name===n).id).join('|');
  assert.deepEqual(discoveryBranches(c.name,source),[{with_genres:expected}],c.name);
 }
});
test('musical identity and display distinguish film versions without confusing adaptations or music',()=>{
 const musical={title:'The Color Purple',year:'2023',genres:['Drama'],tags:['musical','based on play or musical']};
 const original={title:'The Color Purple',year:'1985',genres:['Drama'],tags:['jazz singer or musician']};
 const grease={title:'Grease',year:'1978',genres:['Romance','Comedy'],tags:['musical']};
 assert.equal(matchesCategory(musical,'Musical'),true);assert.equal(matchesCategory(original,'Musical'),false);
 assert.equal(matchesCategory({genres:['Music'],tags:['based on play or musical']},'Musical'),false);
 assert.deepEqual(filmCategoryLabels(grease,'Musical'),['Musical','Romance','Comedy']);
 assert.deepEqual(filmCategoryLabels(grease),['Musical','Romance','Comedy']);
 assert.deepEqual(filmCategoryLabels(original,'Musical'),['Drama']);
 assert.deepEqual(filmCategoryLabels(grease,'Romantic comedy'),['Romantic comedy','Musical','Romance','Comedy']);
 assert.deepEqual(filmCategoryLabels({genres:['Drama','Crime','Thriller']},'Thriller'),['Thriller','Drama','Crime']);
});
