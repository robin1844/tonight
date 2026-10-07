import test from 'node:test';
import assert from 'node:assert/strict';
import {searchTitles} from '../src/title-search.mjs';
import {matchesCategory,discoveryBranches,normaliseCategory} from '../src/engine.mjs';
test('case is normalised and exact Big is not crowded out by popular TV matches',async()=>{
 const calls=[],lookup=async(path,{query})=>{calls.push(query);return {results:path==='search/movie'?[{id:1,title:query==='big'?'Big':'Sully',release_date:'1988-01-01'}]:Array.from({length:20},(_,i)=>({id:i+10,name:'Big Brother '+i,popularity:1000}))};};
 assert.equal((await searchTitles('BIG',false,lookup))[0].title,'Big');
 assert.deepEqual(await searchTitles('sully',true,lookup),await searchTitles('Sully',true,lookup));
 assert.ok(calls.every(q=>q===q.toLowerCase()));
});
test('bounded fallback finds Forrest Gump in both searches and rejects unrelated token hits',async()=>{
 let count=0;const lookup=async(path,{query})=>{count++;return {results:query==='gump'&&path==='search/movie'?[{id:13,title:'Forrest Gump',overview:'A life story.',poster_path:'/poster.jpg'},{id:14,title:'The Gump Family'}]:[]};};
 for(const movies of [true,false]){const hits=await searchTitles('Forest Gump',movies,lookup);assert.deepEqual(hits.map(t=>t.title),['Forrest Gump']);assert.equal(hits[0].overview,'A life story.');assert.equal(hits[0].kind,'movie');}
 assert.ok(count<=9);
});
test('duplicate movie and TV identities remain distinct and normal searches avoid fallback',async()=>{
 let count=0;const hits=await searchTitles('Emily',false,async(path)=>{count++;return {results:[{id:42,title:path.endsWith('movie')?'Emily':undefined,name:'Emily',overview:'Synopsis'}]};});
 assert.equal(count,2);assert.deepEqual(new Set(hits.map(t=>t.kind)),new Set(['movie','tv']));
});
test('Musical uses musical tags, not music documentary genre alone',()=>{
 assert.equal(normaliseCategory('musical'),'Musical');
 assert.equal(matchesCategory({genres:['Music'],tags:['musical']},'Musical'),true);
 assert.equal(matchesCategory({genres:['Documentary','Music'],tags:['concert']},'Musical'),false);
 assert.ok(discoveryBranches('Musical',[])[0].with_keywords.includes('4344'));
 assert.equal(discoveryBranches('Musical',[])[0].with_genres,undefined);
});
