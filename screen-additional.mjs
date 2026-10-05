import {readFile,writeFile} from 'node:fs/promises';
import {screenProvider,linkedProviderPages} from './src/provider-screen.mjs';
const starts={apple:['https://tv.apple.com/gb/movie/coda/umc.cmc.3eh9r5iz32ggdm4ccvw5igiir','https://tv.apple.com/gb/movie/fingernails/umc.cmc.5kr10v39ex4n13rrwxjzm3jy7','https://tv.apple.com/gb/movie/ghosted/umc.cmc.6nodv9rf3ltfk2ar3pfc8hced'],disney:['https://www.disneyplus.com/en-gb/browse/entity-d4cddf96-fc7c-4a1a-ab19-f70f51e66252','https://www.disneyplus.com/en-gb/browse/entity-46af23cb-79bc-4e57-90c0-1fc9661f8afe','https://www.disneyplus.com/en-gb/browse/entity-595405af-f3c4-48ab-8fce-9633d0be25db']};
const checkedAt=new Date().toISOString(),index=[],report={checkedAt,scope:'Bounded public UK title-page crawl, starting with romance/comedy references. Not exhaustive catalogue coverage; no playback check.',services:{}};
const normal=s=>s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g,'');
async function tmdb(path,params={}){const url=new URL('https://api.themoviedb.org/3/'+path);for(const [k,v]of Object.entries(params))url.searchParams.set(k,v);const r=await fetch(url,{headers:{Authorization:'Bearer '+process.env.TMDB_READ_TOKEN},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Catalogue request failed');return r.json();}
for(const service of ['apple','disney']){
 const queue=[...starts[service]],seen=new Set(),stats={attempted:0,failed:0,matched:0,available:0,possible:0,unknown:0};
 while(queue.length&&seen.size<100){
  const batch=queue.splice(0,3).filter(url=>!seen.has(url));batch.forEach(url=>seen.add(url));
  const found=await Promise.all(batch.map(async url=>{stats.attempted++;try{const r=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Title unavailable');const html=await r.text();for(const link of linkedProviderPages(html,service))if(!seen.has(link)&&!queue.includes(link))queue.push(link);const s=screenProvider(html,r.url,checkedAt);if(!s||!s.year)return null;const search=await tmdb('search/movie',{query:s.title,year:s.year,language:'en-GB'});const matches=search.results.filter(t=>normal(t.title)===normal(s.title)&&t.release_date?.startsWith(s.year));const names=service==='apple'?['Apple TV','Apple TV Plus']:['Disney Plus'];const included=[];for(const m of matches){const offers=await tmdb('movie/'+m.id+'/watch/providers');if(offers.results?.GB?.flatrate?.some(p=>names.includes(p.provider_name)))included.push(m);}if(included.length!==1)return null;return {id:included[0].id,...s};}catch{stats.failed++;return null;}}));
  for(const seed of found.filter(Boolean))if(!index.some(s=>s.id===seed.id&&s.service===seed.service)){index.push(seed);stats.matched++;stats[seed.status]++;}
  if(stats.attempted%15<3)console.log(service,JSON.stringify(stats));
 }
 report.services[service]=stats;
}
const old=JSON.parse(await readFile('src/additional-ad-seeds.json','utf8'));
const merged=[...new Map([...old,...index].map(s=>[s.service+':'+s.id,s])).values()].filter(s=>s.status!=='unknown'||s.categoryEvidence?.length);
await writeFile('src/additional-ad-seeds.json',JSON.stringify(merged,null,2)+'\n');await writeFile('src/additional-screening-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
