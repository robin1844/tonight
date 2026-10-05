import {netflixADEvidence} from './engine.mjs';
export function titleLinks(html){return [...new Set([...html.matchAll(/href="(?:https:\/\/www\.netflix\.com)?\/gb\/title\/(\d+)[^"]*"/g)].map(m=>m[1]))];}
export const normaliseTitle=t=>t.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&amp;/g,'&').replace(/[^a-z0-9]/g,'');
export function screenNetflix(html,url,checkedAt){
  const evidence=netflixADEvidence(html,url,checkedAt);
  const metadata=[...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{try{return [JSON.parse(m[1])];}catch{return [];}}).find(m=>m['@type']==='Movie' && m.url===url);
  if(!metadata||evidence.status!=='available')return null;
  const genreSection=html.match(/<h4\b[^>]*>\s*Genres\s*<\/h4>([\s\S]*?)(?:<h4\b|<\/section>)/i)?.[1]?.slice(0,8000)||'';
  return {title:metadata.name,year:Number(metadata.dateCreated?.slice(0,4)),netflix:url.split('/').at(-1),checkedAt,
    categoryEvidence:/Romantic Comedy (?:Films|Movies)/i.test(genreSection)?[{category:'Romantic comedy',source:url}]:[]};
}
export function identityMatch(record, results){
  const hits=results.filter(m=>[m.title,m.original_title].some(t=>t&&normaliseTitle(t)===normaliseTitle(record.title)) && Number(m.release_date?.slice(0,4))===record.year);
  return hits.length===1 ? hits[0] : null;
}
