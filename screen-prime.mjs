import {readFile,writeFile} from 'node:fs/promises';
const sample=[
 [1032863,'The Love Hypothesis',2026,'0IH8VKXSSIAXGDCWKPS2UU3HZT'],
 [843527,'The Idea of You',2024,'0NRT15S2XG06SG5HBV5NQAW3E3'],
 [50646,'Crazy, Stupid, Love.',2011,'0JT9JCM6M8VO7QUTMPIJAF5000'],
 [930094,'Red, White & Royal Blue',2023,'0G09O3U0SEXYXD3GGQIDZEH32I'],
 [854,'The Mask',1994,'0U8HFS38945CNPERL16277W83S'],
 [10591,'The Girl Next Door',2004,'0LGXVI480R0GL9SFPQSZHOS5FJ'],
 [43347,'Love & Other Drugs',2010,'0GDRMOE2LABS4EMMXLI1473VWI'],
 [621,'Grease',1978,'0I9QBWJ0KXIRTPQNMCQSYWHTDW'],
 [993708,'The Threesome',2025,'0IEIQK6EWJW7SJNWH2IWZ00IOE'],
 [50546,'Just Go with It',2011,'0G0V1UTTF51715I96M0UTXQT0I'],
 [1515615,'Kissing Is the Easy Part',2026,null],
 [10096,'13 Going on 30',2004,'0GNRIM9L94Y3EBJ74G1JDYNX8K']
];
const h={Authorization:`Bearer ${process.env.TMDB_READ_TOKEN}`};
const get=async p=>{const r=await fetch('https://api.themoviedb.org/3/'+p,{headers:h,signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Catalogue unavailable');return r.json();};
const norm=s=>s.toLowerCase().replace(/&amp;/g,'&').replace(/[^a-z0-9]/g,'');
const rows=[];
for(const [id,title,year,asin]of sample){
 const providers=await get(`movie/${id}/watch/providers`);
 const included=(providers.results?.GB?.flatrate||[]).some(p=>p.provider_name==='Amazon Prime Video');
 const row={id,title,year,included,source:asin?`https://www.primevideo.com/detail/${asin}`:null,status:'unknown',checkedAt:new Date().toISOString()};
 if(asin)try{
  const r=await fetch(row.source,{signal:AbortSignal.timeout(15000)}),html=await r.text();
  const label=html.match(/<title>(.*?)<\/title>/s)?.[1]?.replace(/^Prime Video:\s*/,'');
  const i=html.indexOf('>Audio languages<'),end=html.indexOf('>Subtitles<',i);
  const audio=i>=0?html.slice(i,end>i?end:i+12000).replace(/<[^>]*>/g,' ').replace(/\s+/g,' '):'';
  row.pageAccessible=r.ok;row.identityMatched=norm(label||'')===norm(title)&&new RegExp(`\\b${year}\\b`).test(html.slice(0,i>0?i:html.length));
  row.audioSectionFound=Boolean(audio);
  if(r.ok&&row.identityMatched&&/English\s*\[Audio Description\]/.test(audio))row.status='likely';
  row.note=row.status==='likely'?'Official Prime page lists English AD; UK account/version not verified.':'No usable positive AD evidence. Missing metadata is not evidence of absence.';
 }catch{row.note='Public page could not be checked.';}
 rows.push(row);
}
const reviewed=JSON.parse(await readFile('src/prime-reviewed-evidence.json','utf8'));
for(const row of rows){const e=reviewed.find(e=>e.id===row.id);if(row.status==='unknown'&&e&&Date.now()-Date.parse(e.checkedAt)<30*86400000){row.status=e.status;row.source=e.source;row.note=e.note;row.evidenceCheckedAt=e.checkedAt;}}
const report={checkedAt:new Date().toISOString(),method:'First 12 TMDB popularity-ordered GB Prime subscription films tagged Romance AND Comedy on 5 Oct 2026. Per-film GB base Prime eligibility rechecked. Public Prime title pages identified by title/year; visible English AD only. Public page region is not UK-account verification. A convenience sample, not an estimate of the entire catalogue.',sampleSize:rows.length,included:rows.filter(r=>r.included).length,likely:rows.filter(r=>r.included&&r.status==='likely').length,possible:rows.filter(r=>r.included&&r.status==='possible').length,confirmed:0,rows};
await writeFile('src/prime-screening-report.json',JSON.stringify(report,null,2)+'\n');
await writeFile('src/prime-ad-seeds.json',JSON.stringify(rows.filter(r=>r.status==='likely'&&!reviewed.some(e=>e.id===r.id)).map(r=>({id:r.id,title:r.title,year:r.year,service:'prime',country:'unknown',language:'en',scope:'movie',status:'likely',source:r.source,checkedAt:r.checkedAt,note:r.note})),null,2)+'\n');
console.log(JSON.stringify(report));
