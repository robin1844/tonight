import worker from './worker.mjs';
import {CATEGORIES} from './engine.mjs';
import seeds from './ad-seeds.json';
import primeSeeds from './prime-ad-seeds.json';
import reviewed from './prime-reviewed-evidence.json';
import additional from './additional-ad-seeds.json';
const origin='https://robin1844.github.io';
const allowed=new Set(['/api/search','/api/movie','/api/availability','/api/candidates','/api/meta']);
export default {async fetch(request,env){
 const url=new URL(request.url),cors={'Access-Control-Allow-Origin':origin,'Vary':'Origin','Cache-Control':'no-store'};
 if(!allowed.has(url.pathname))return Response.json({error:'Not found.'},{status:404,headers:cors});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...cors,'Access-Control-Allow-Methods':'GET','Access-Control-Allow-Headers':'Content-Type'}});
 if(request.method!=='GET')return Response.json({error:'Read-only catalogue.'},{status:405,headers:cors});
 if(url.pathname==='/api/meta')return Response.json({genres:CATEGORIES,indexPages:Math.ceil(new Set([...seeds,...primeSeeds,...reviewed,...additional].map(s=>s.id)).size/20)},{headers:cors});
 const response=await worker.fetch(request,{TMDB_READ_TOKEN:env.TMDB_READ_TOKEN});
 const headers=new Headers(response.headers);for(const [k,v]of Object.entries(cors))headers.set(k,v);
 return new Response(response.body,{status:response.status,headers});
}};
