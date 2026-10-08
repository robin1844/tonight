import test from 'node:test';
import assert from 'node:assert/strict';
import {rankTitles,adConfidence,DAY} from '../src/engine.mjs';
const now=Date.parse('2026-10-05T14:00:00Z'),checkedAt=new Date(now).toISOString();
const profile={country:'GB',services:['prime'],feedback:{},favourAD:true};
const offer={country:'GB',service:'prime',type:'subscription',checkedAt};
const evidence=changes=>({country:'GB',service:'prime',language:'en',scope:'movie',status:'available',source:'https://www.primevideo.com/detail/test',checkedAt,...changes});
const movie=(id,adEvidence=[])=>({id,title:id,kind:'movie',offers:[offer],adEvidence});
test('favour AD keeps the same eligible titles and orders confidence groups',()=>{
 const catalogue=[movie('A unknown'),movie('B possible',[evidence({service:'netflix'})]),movie('C likely',[evidence({country:'unknown',status:'likely'})]),movie('D confirmed',[evidence()])];
 assert.deepEqual(rankTitles(catalogue,[],profile,now).map(t=>t.id),['D confirmed','C likely','B possible','A unknown']);
 const regular=rankTitles(catalogue,[],{...profile,favourAD:false},now);
 assert.deepEqual(regular.map(t=>t.id),catalogue.map(t=>t.id));
 assert.deepEqual(new Set(regular.map(t=>t.id)),new Set(rankTitles(catalogue,[],profile,now).map(t=>t.id)));
});
test('wrong territory or version never qualifies as confirmed; expired evidence becomes unknown',()=>{
 assert.equal(adConfidence(movie('x',[evidence({country:'US'})]),profile,now).level,0);
 assert.equal(adConfidence(movie('x',[evidence({scope:'alternate-version',status:'possible'})]),profile,now).level,1);
 for(const changes of [{language:'es'},{checkedAt:new Date(now-31*DAY).toISOString()},{checkedAt:new Date(now+DAY).toISOString()}])assert.equal(adConfidence(movie('x',[evidence(changes)]),profile,now).level,0);
});
test('AD preference cannot admit rentals and does not hide unknown AD',()=>{
 const rental={...movie('rent',[evidence()]),offers:[{...offer,type:'rent'}]};
 assert.deepEqual(rankTitles([rental,movie('unknown')],[],profile,now).map(t=>t.id),['unknown']);
});
test('taste remains the tie-break within an AD confidence group',()=>{
 const titles=[{...movie('A',[evidence()]),tags:['bleak']},{...movie('Z',[evidence()]),tags:['warm']}];
 assert.deepEqual(rankTitles(titles,[{id:'anchor',tags:['warm']}],{...profile,feedback:{anchor:'loved'}},now).map(t=>t.id),['Z','A']);
});

test('provider AD badges outrank inference while confirmed English remains first',()=>{
 const badge=evidence({service:'disney',language:'und',status:'possible',kind:'provider-ad-badge',source:'https://www.disneyplus.com/en-gb/browse/entity-test'});
 const advertised={...movie('badge',[badge]),offers:[{...offer,service:'disney'}]};
 const catalogue=[movie('unknown'),movie('possible',[evidence({service:'netflix'})]),movie('likely',[evidence({status:'likely'})]),advertised,movie('confirmed',[evidence()])];
 const selected={...profile,services:['prime','disney']};
 assert.deepEqual(rankTitles(catalogue,[],selected,now).map(t=>t.id),['confirmed','badge','likely','possible','unknown']);
 assert.equal(adConfidence(advertised,selected,now).label,'Provider advertises AD · language unverified');
 assert.equal(adConfidence({...advertised,adEvidence:[{...badge,country:'US'}]},selected,now).level,0);
 assert.equal(adConfidence({...advertised,adEvidence:[{...badge,language:'es'}]},selected,now).level,0);
 assert.deepEqual(new Set(rankTitles(catalogue,[],{...selected,favourAD:false},now).map(t=>t.id)),new Set(catalogue.map(t=>t.id)));
 const warm={...advertised,id:'warm',title:'Z',tags:['warm']},bleak={...advertised,id:'bleak',title:'A',tags:['bleak']};
 assert.deepEqual(rankTitles([bleak,warm],[{id:'anchor',tags:['warm']}],{...selected,feedback:{anchor:'loved'}},now).map(t=>t.id),['warm','bleak']);
});
