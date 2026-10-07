export const normaliseTitle = value => String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function titleDistance(a,b){
 const rows=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
 for(let i=0;i<=a.length;i++)rows[i][0]=i;
 for(let j=0;j<=b.length;j++)rows[0][j]=j;
 for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){
  rows[i][j]=Math.min(rows[i-1][j]+1,rows[i][j-1]+1,rows[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])rows[i][j]=Math.min(rows[i][j],rows[i-2][j-2]+1);
 }
 return rows[a.length][b.length];
}
export async function searchTitles(query,filmsOnly,lookup){
 const q=normaliseTitle(query),kinds=filmsOnly?['movie']:['movie','tv'];
 if(!q)return [];
 const pool=new Map(),limit=Math.min(3,Math.max(1,Math.floor(q.length*.2)));
 const score=t=>{const names=[t.title,t.originalTitle].filter(Boolean).map(normaliseTitle);return Math.min(...names.map(n=>n===q?0:n.startsWith(q)?10:n.includes(q)?20:titleDistance(q,n)<=limit?30+titleDistance(q,n):100));};
 async function collect(term,required){
  const results=await Promise.allSettled(kinds.map(async kind=>({kind,data:await lookup('search/'+kind,{query:term,language:'en-GB',include_adult:false})})));
  if(required&&results.every(r=>r.status==='rejected'))throw results[0].reason;
  for(const r of results)if(r.status==='fulfilled')for(const x of r.value.data.results||[]){const kind=r.value.kind;pool.set(kind+':'+x.id,{id:x.id,kind,title:x.title||x.name,originalTitle:x.original_title||x.original_name,year:(x.release_date||x.first_air_date)?.slice(0,4),overview:x.overview||'',poster:x.poster_path?`https://image.tmdb.org/t/p/w342${x.poster_path}`:null,popularity:x.popularity||0});}
 }
 await collect(q,true);
 if(![...pool.values()].some(t=>score(t)<100)&&q.length>=4){
  const tokens=[...new Set(q.split(' ').filter(w=>w.length>=3))];
  const terms=tokens.length>1?[tokens[0],tokens.at(-1)]:[q.slice(0,Math.max(3,q.length-2))];
  const originalKeys=new Set(pool.keys());
  await Promise.all([...new Set(terms)].filter(t=>t!==q).map(t=>collect(t,false)));
  for(const [key,t] of pool)if(!originalKeys.has(key)&&score(t)>=100)pool.delete(key);
 }
 return [...pool.values()].sort((a,b)=>score(a)-score(b)||b.popularity-a.popularity).slice(0,8).map(({originalTitle,popularity,...t})=>t);
}
