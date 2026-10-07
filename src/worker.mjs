import html from '../public/index.html';
import css from '../public/style.css';
import client from '../public/app.js';
import engine from './engine.mjs?raw';
import seeds from './ad-seeds.json';
import primeSeeds from './prime-ad-seeds.json';
import reviewed from './prime-reviewed-evidence.json';
import additional from './additional-ad-seeds.json';
import {searchTitles} from './title-search.mjs';
import { tmdbOffers, CATEGORIES, SERVICES, providerMap, normaliseCategory, matchesCategory, discoveryBranches, discoveryWindow } from './engine.mjs';

const DEFAULT = {country:'GB',services:['netflix','prime'],genre:'Romantic comedy',adOnly:false,favourAD:false,feedback:{},anchors:[]};
const primeEvidence=[...primeSeeds,...reviewed];
const indexedIds=[...new Set([...seeds,...primeEvidence,...additional].map(s=>s.id))];
const ratings = ['loved','liked','disliked','seen','unseen','not-tonight'];
const headers = {'Content-Security-Policy':"default-src 'self'; img-src 'self' https://image.tmdb.org; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'self' https://*.chatgpt.com https://chatgpt.com; form-action 'self'",'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'};
const json = (data,status=200) => new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json','Cache-Control':'no-store'}});
const cache = new Map();
async function tmdb(path, env, params={}) {
  if(!env.TMDB_READ_TOKEN) throw new Error('The film catalogue is not connected.');
  const u=new URL(`https://api.themoviedb.org/3/${path}`);
  for(const [k,v] of Object.entries(params))u.searchParams.set(k,String(v));
  const key=u.href, stored=cache.get(key);
  if(stored && stored.until>Date.now()) return stored.value;
  const r=await fetch(u,{headers:{Authorization:`Bearer ${env.TMDB_READ_TOKEN}`},signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw new Error('The film catalogue is temporarily unavailable. Please try again.');
  const value=await r.json();
  if(cache.size>400)cache.clear();
  cache.set(key,{value,until:Date.now()+3600000});return value;
}
async function providers(env) {
  const r=await tmdb('watch/providers/movie',env,{watch_region:'GB',language:'en-GB'});
  const map=providerMap(r.results);
  if(!['netflix','prime'].every(s=>[...map.values()].includes(s)))throw new Error('Subscription providers could not be verified. Please try again later.');
  return map;
}
async function movie(id,env,kind='movie') {
  const d=await tmdb(`${kind}/${id}`,env,{language:'en-GB',append_to_response:'keywords,credits'});
  const s=kind==='movie'?seeds.find(x=>x.id===d.id):null;
  return {id:kind==='tv'?`tmdb:tv:${d.id}`:`tmdb:${d.id}`,tmdbId:d.id,title:d.title||d.name,kind,year:(d.release_date||d.first_air_date)?.slice(0,4),overview:d.overview,
    poster:d.poster_path?`https://image.tmdb.org/t/p/w342${d.poster_path}`:null,
    genres:d.genres.map(x=>x.name),tags:(d.keywords?.keywords||d.keywords?.results||[]).map(x=>x.name),
    cast:(d.credits?.cast||[]).slice(0,8).map(x=>x.name),directors:(d.credits?.crew||[]).filter(x=>x.job==='Director').map(x=>x.name),
    categoryEvidence:[...(s?.categoryEvidence||[]),...(kind==='movie'?additional.filter(x=>x.id===d.id).flatMap(x=>x.categoryEvidence||[]):[])],offers:[],adEvidence:[...(s?[{country:'GB',service:'netflix',language:'en',scope:'movie',status:'available',source:`https://www.netflix.com/gb/title/${s.netflix}`,checkedAt:s.checkedAt}]:[]),...(kind==='movie'?[...primeEvidence,...additional].filter(x=>x.id===d.id):[])]};
}
async function profile(env) {
  const r=await env.DB.prepare('SELECT profile, revision FROM household WHERE id = 1').first();
  return r?{profile:JSON.parse(r.profile),revision:r.revision}:{profile:DEFAULT,revision:0};
}
function validateProfile(p) {
  if(!p || p.country!=='GB' || !Array.isArray(p.services) || p.services.length>4 || p.services.some(s=>!SERVICES.some(x=>x.id===s)) ||
    typeof p.genre!=='string' || p.genre.length>40 || typeof p.adOnly!=='boolean' || !p.feedback || Array.isArray(p.feedback) ||
    Object.entries(p.feedback).length>500 || Object.entries(p.feedback).some(([k,v])=>!/^tmdb:(?:tv:)?\d+$/.test(k)||!ratings.includes(v)) ||
    !Array.isArray(p.anchors) || p.anchors.length>500) throw new Error('Invalid taste profile.');
  for(const a of p.anchors) {
    if(!/^tmdb:(?:tv:)?\d+$/.test(a.id)||typeof a.title!=='string'||a.title.length>300)throw new Error('Invalid film rating.');
    for(const key of ['genres','tags','cast','directors'])if(!Array.isArray(a[key])||a[key].length>100||a[key].some(x=>typeof x!=='string'||x.length>200))throw new Error('Invalid film metadata.');
  }
  if(p.favourAD!==undefined&&typeof p.favourAD!=='boolean')throw new Error('Invalid AD preference.');
  return {country:'GB',services:[...new Set(p.services)],genre:p.genre,adOnly:false,favourAD:p.favourAD??p.adOnly,feedback:p.feedback,
    anchors:p.anchors.map(a=>({id:a.id,title:a.title,year:a.year,genres:a.genres,tags:a.tags,cast:a.cast,directors:a.directors}))};
}
async function api(request,env) {
  const u=new URL(request.url);
  if(request.method==='POST') {
    if(request.headers.get('Origin')!==u.origin||!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'This request must come from Tonight.'},403);
    const body=await request.text();if(body.length>300000)return json({error:'The taste profile is too large.'},413);
    let input;try{input=JSON.parse(body);}catch{return json({error:'Invalid request.'},400);}
    if(u.pathname!=='/api/profile')return json({error:'Not found.'},404);
    let p;try{p=validateProfile(input.profile);}catch(e){return json({error:e.message},400);}
    if(!Number.isInteger(input.revision)||input.revision<0)return json({error:'Invalid profile version.'},400);
    const value=JSON.stringify(p);
    if(input.revision===0){const r=await env.DB.prepare('INSERT INTO household (id, profile, revision) VALUES (1, ?, 1) ON CONFLICT(id) DO NOTHING').bind(value).run();if(!r.meta.changes)return json({error:'Your taste changed in another tab. Reload before saving.'},409);}
    else{const r=await env.DB.prepare('UPDATE household SET profile = ?, revision = revision + 1 WHERE id = 1 AND revision = ?').bind(value,input.revision).run();if(!r.meta.changes)return json({error:'Your taste changed in another tab. Reload before saving.'},409);}
    return json({profile:p,revision:input.revision+1});
  }
  if(request.method!=='GET')return json({error:'Method not allowed.'},405);
  if(u.pathname==='/api/boot') {
    const saved=await profile(env);
    return json({...saved,profile:{...saved.profile,adOnly:false,favourAD:saved.profile.favourAD??saved.profile.adOnly,genre:normaliseCategory(saved.profile.genre)},genres:CATEGORIES,adCheckedAt:seeds[0].checkedAt,indexPages:Math.ceil(indexedIds.length/20)});
  }
  if(u.pathname==='/api/search') {
    const q=u.searchParams.get('q')?.trim();if(!q||q.length>100)return json({error:'Enter a film title (up to 100 characters).'},400);
    const filmsOnly=u.searchParams.get('movies')==='1';
    return json({results:await searchTitles(q,filmsOnly,(path,params)=>tmdb(path,env,params))});
  }
  if(u.pathname==='/api/availability') {
    const id=u.searchParams.get('id');if(!/^\d{1,10}$/.test(id||''))return json({error:'Invalid film.'},400);
    const [title,offers,map]=await Promise.all([movie(id,env),tmdb(`movie/${id}/watch/providers`,env),providers(env)]);
    title.offers=tmdbOffers(offers,map,new Date().toISOString());
    const seed=seeds.find(s=>String(s.id)===id);
    for(const offer of title.offers){if(offer.service==='netflix'&&seed)offer.directUrl=`https://www.netflix.com/gb/title/${seed.netflix}`;const extra=additional.find(s=>String(s.id)===id&&s.service===offer.service);if(extra)offer.directUrl=extra.source;}
    return json(title);
  }
  if(u.pathname==='/api/movie') {
    const id=u.searchParams.get('id');if(!/^\d{1,10}$/.test(id||''))return json({error:'Invalid film.'},400);
    const kind=u.searchParams.get('kind')||'movie';if(!['movie','tv'].includes(kind))return json({error:'Invalid title type.'},400);
    return json(await movie(id,env,kind));
  }
  if(u.pathname==='/api/candidates') {
    const page=Number(u.searchParams.get('page')||1), requested=u.searchParams.get('genre')||'', index=u.searchParams.get('index')==='1';
    if(!Number.isInteger(page)||page<1||page>1000)return json({error:'Invalid selection.'},400);
    const g=await tmdb('genre/movie/list',env,{language:'en-GB'});
    const legacy=/^\d+$/.test(requested)?g.genres.find(x=>String(x.id)===requested)?.name:null;
    const category=normaliseCategory(legacy||requested);
    if(requested&&!category)return json({error:'Invalid category.'},400);
    const map=await providers(env);
    const selected=(u.searchParams.get('services')??'netflix,prime').split(',').filter(Boolean);
    if(selected.some(s=>!SERVICES.some(x=>x.id===s)))return json({error:'Invalid services.'},400);
    const selectedMap=new Map([...map].filter(([,s])=>selected.includes(s)));
    if(!selected.length)return json({titles:[],page,totalPages:1,checkedAt:new Date().toISOString()});
    if(selected.some(s=>![...map.values()].includes(s)))return json({error:'A selected subscription service could not be checked. Please try again later.'},503);
    let ids, totalPages;
    if(index){const selectedIds=[...new Set([...(selected.includes('netflix')?seeds:[]),...[...primeEvidence,...additional].filter(s=>selected.includes(s.service))].map(s=>s.id))];ids=selectedIds.slice((page-1)*20,page*20);totalPages=Math.max(1,Math.ceil(selectedIds.length/20));}
    else{
      const branches=discoveryBranches(category,g.genres), supplemental=category==='Romantic comedy'?[...seeds,...additional].filter(s=>s.categoryEvidence?.some(e=>e.category===category)):[];
      const window=discoveryWindow(page,branches.length+(supplemental.length?1:0));
      if(window.sourcePage>500)return json({error:'Invalid selection.'},400);
      const results=await Promise.all(branches.map(branch=>tmdb('discover/movie',env,{watch_region:'GB',with_watch_providers:[...selectedMap.keys()].join('|'),with_watch_monetization_types:'flatrate',language:'en-GB',include_adult:false,...branch,page:window.sourcePage})));
      const extra=supplemental.slice((window.sourcePage-1)*20,window.sourcePage*20).map(s=>({id:s.id}));
      const streams=[...results.map(r=>r.results),...(supplemental.length?[extra]:[])];
      ids=[...new Set(streams.flatMap(r=>r.slice(window.start,window.start+window.size).map(x=>x.id)))];
      totalPages=Math.min(1000,Math.min(500,Math.max(...results.map(r=>r.total_pages),Math.ceil(supplemental.length/20)))*window.sections);
    }
    const titles=[];
    // At most 20 unique films and 44 catalogue calls per page, including both romcom routes.
    for(let start=0;start<ids.length;start+=4) {
      const chunk=await Promise.all(ids.slice(start,start+4).map(async id=>{
        const [t,p]=await Promise.all([movie(id,env),tmdb(`movie/${id}/watch/providers`,env)]);
        // Cache retrieval time is not underlying freshness. Limit it to one hour.
        const key=`https://api.themoviedb.org/3/movie/${id}/watch/providers`;
        const checkedAt=new Date((cache.get(key)?.until||Date.now()+3600000)-3600000).toISOString();
        t.offers=tmdbOffers(p,map,checkedAt);
        for(const o of t.offers){const s=seeds.find(x=>x.id===id);if(o.service==='netflix'&&s)o.directUrl=`https://www.netflix.com/gb/title/${s.netflix}`;const extra=additional.find(s=>s.id===id&&s.service===o.service);if(extra)o.directUrl=extra.source;}
        return t;
      }));titles.push(...chunk);
    }
    return json({titles:titles.filter(t=>matchesCategory(t,category)),page,totalPages,checkedAt:new Date().toISOString(),adIndexed:seeds.length,adCoverage:'Netflix romantic comedy and romance public browse lists; not the full catalogue. Prime AD remains unverified.'});
  }
  return json({error:'Not found.'},404);
}
export default {async fetch(request,env) {
  const path=new URL(request.url).pathname;
  try {
    if(path.startsWith('/api/'))return await api(request,env);
    const routes={'/':[html,'text/html; charset=utf-8'],'/style.css':[css,'text/css'],'/app.js':[client,'text/javascript'],'/engine.mjs':[engine,'text/javascript']};
    const item=routes[path];if(!item)return new Response('Not found',{status:404,headers});
    return new Response(item[0],{headers:{...headers,'Content-Type':item[1],'Cache-Control':'no-cache'}});
  }catch(e){console.error('Tonight request failed:',path,e.name);return json({error:path.startsWith('/api/')?e.message:'Tonight is temporarily unavailable.'},503);}
}};
