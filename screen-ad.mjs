import {readFile,writeFile} from 'node:fs/promises';
import {titleLinks,screenNetflix,identityMatch} from './src/netflix-screen.mjs';
const indexURLs=['https://www.netflix.com/gb/browse/genre/5475','https://www.netflix.com/gb/browse/genre/8883'];
const old=JSON.parse(await readFile('src/ad-seeds.json','utf8'));
async function get(url,auth=false){const r=await fetch(url,{signal:AbortSignal.timeout(15000),headers:auth?{Authorization:`Bearer ${process.env.TMDB_READ_TOKEN}`}:{}});if(!r.ok)throw Error(`HTTP ${r.status}`);return auth?r.json():r.text();}
const ids=new Set(['81504327',...old.map(x=>x.netflix)]);
for(const url of indexURLs){for(const id of titleLinks(await get(url)))ids.add(id);}
const stats={discovered:ids.size,checked:0,positiveAD:0,matched:0,unknownIdentity:0,failed:0};
const records=[];const entries=[...ids];
for(let i=0;i<entries.length;i+=3){
  const batch=await Promise.all(entries.slice(i,i+3).map(async netflix=>{
    try{
      const url=`https://www.netflix.com/gb/title/${netflix}`;
      const html=await get(url),r=screenNetflix(html,url,new Date().toISOString());stats.checked++;
      if(!r)return null;stats.positiveAD++;
      const u=new URL('https://api.themoviedb.org/3/search/movie');u.searchParams.set('query',r.title);u.searchParams.set('year',String(r.year));
      const result=await get(u,true),hit=identityMatch(r,result.results||[]);
      if(!hit){stats.unknownIdentity++;return null;}
      if(netflix==='81504327')r.categoryEvidence=[{category:'Romantic comedy',source:'https://media.netflix.com/en/only-on-netflix/81504327'}];
      stats.matched++;return {...r,id:hit.id};
    }catch{stats.failed++;return null;}
  }));records.push(...batch.filter(Boolean));
  if(i%30===0)console.log(JSON.stringify(stats));
}
const unique=[...new Map(records.map(r=>[r.id,r])).values()];
if(!unique.some(r=>r.netflix==='81504327')||unique.length<old.length)throw Error('Screening incomplete; previous index preserved.');
await writeFile('src/ad-seeds.json',JSON.stringify(unique,null,2)+'\n');
await writeFile('src/ad-screening-report.json',JSON.stringify({...stats,indexed:unique.length,checkedAt:new Date().toISOString(),sources:indexURLs,
  scope:'Public UK Netflix romantic comedy and romance browse lists, plus known references. Not the whole Netflix catalogue; Prime AD not screened. Only explicit English AD on movie pages with exact title/year identity matches is included.'},null,2)+'\n');
console.log(JSON.stringify({...stats,indexed:unique.length,complete:true}));
