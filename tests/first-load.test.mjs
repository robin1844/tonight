import test from 'node:test';
import assert from 'node:assert/strict';
import {fillEmptySelection,rankTitles} from '../src/engine.mjs';
const profile={country:'GB',services:['netflix'],genre:'Romantic comedy',feedback:{seen:'seen'}};
const title=id=>({id,title:id,kind:'movie',genres:['Romance','Comedy'],offers:[{country:'GB',service:'netflix',type:'subscription',checkedAt:new Date().toISOString()}]});
const hasMatches=titles=>rankTitles(titles,[],profile).length>0;
test('first load skips watched and empty batches automatically until an eligible film is found',async()=>{
 const fetched=[];const r=await fillEmptySelection({titles:[title('seen')],page:1,totalPages:4},{hasMatches,fetchPage:async page=>{fetched.push(page);return {titles:page===3?[title('new')]:[],page,totalPages:4};}});
 assert.deepEqual(fetched,[2,3]);assert.equal(r.page,3);assert.equal(hasMatches(r.titles),true);
});
test('an empty catalogue is declared only after all pages have been checked',async()=>{
 const r=await fillEmptySelection({titles:[],page:1,totalPages:3},{hasMatches,fetchPage:async page=>({titles:[],page,totalPages:3})});
 assert.equal(r.page,3);assert.equal(r.titles.length,0);
});
test('a superseded selection cannot overwrite the new selection',async()=>{
 let current=true;const r=await fillEmptySelection({titles:[],page:1,totalPages:3},{hasMatches,isCurrent:()=>current,fetchPage:async page=>{current=false;return {titles:[title('old')],page,totalPages:3};}});
 assert.equal(r,null);
});
