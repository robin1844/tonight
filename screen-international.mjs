import {readFile,writeFile} from 'node:fs/promises';
import {screenRegionalProvider} from './src/regional-screen.mjs';
import {normaliseTitle} from './src/netflix-screen.mjs';
const old=JSON.parse(await readFile('src/additional-ad-seeds.json','utf8'));
const records=[],stats={checked:0,accepted:0,rejected:0,failed:0};
for(const country of ['US','CA']){
 const sources=old.filter(s=>s.service==='apple'||s.service==='disney');
 for(let i=0;i<sources.length;i+=4){
  await Promise.all(sources.slice(i,i+4).map(async seed=>{
   const source=seed.source.replace('/gb/','/'+country.toLowerCase()+'/').replace('/en-gb/','/en-'+country.toLowerCase()+'/');
   try{const r=await fetch(source,{signal:AbortSignal.timeout(15000)});stats.checked++;if(!r.ok){stats.failed++;return;}
    const evidence=screenRegionalProvider(await r.text(),source,r.url,country,new Date().toISOString());
    if(!evidence||normaliseTitle(evidence.title)!==normaliseTitle(seed.title)||Number(evidence.year)!==Number(seed.year)){stats.rejected++;return;}
    records.push({...evidence,id:seed.id});stats.accepted++;
   }catch{stats.failed++;}
  }));
  console.log(JSON.stringify({country,...stats}));
 }
}
// Separately reviewed Canadian Netflix page, with explicit English AD and
// exact film/year identity. US redirects here are deliberately not accepted.
records.push({id:353577,title:'Love at First Sight',year:2023,country:'CA',service:'netflix',language:'en',scope:'movie',status:'available',source:'https://www.netflix.com/ca/title/81504327',checkedAt:new Date().toISOString(),note:'Canadian public title page explicitly lists English Audio Description; reviewed 8 October 2026.'});
await writeFile('src/international-ad-seeds.json',JSON.stringify(records,null,2)+'\n');
await writeFile('src/international-screening-report.json',JSON.stringify({...stats,indexed:records.length,checkedAt:new Date().toISOString(),scope:'Regional Apple and Canadian Disney pages corresponding to existing title references, plus one reviewed Canadian Netflix film. Not a complete catalogue. Redirected or region-unverified pages are rejected. No UK AD records copied.'},null,2)+'\n');
