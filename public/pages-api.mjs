const KEY='tonight-taste-v1';
const defaults=()=>({country:'GB',services:['netflix','prime'],genre:'Romantic comedy',adOnly:false,favourAD:false,feedback:{},anchors:[]});
export function createPagesAPI({backend,storage=localStorage,fetchImpl=fetch}) {
  const catalogueURL=path=>{const url=new URL(path,backend);if(!url.searchParams.has('country'))url.searchParams.set('country',read().profile.country||'GB');url.searchParams.set('client','countries-20261008');return url;};
  const read=()=>{try{return JSON.parse(storage.getItem(KEY))||{profile:defaults(),revision:0};}catch{throw Error('Your saved taste could not be read.');}};
  return async function api(path,options={}){
    if(path==='/api/boot'){const saved=read();const response=await fetchImpl(catalogueURL('/api/meta'),{credentials:'omit',cache:'no-store'});if(!response.ok)throw Error('The catalogue could not be checked.');const meta=await response.json();return {...saved,...meta};}
    if(path==='/api/profile'){
      const input=JSON.parse(options.body),saved=read();
      if(saved.revision!==input.revision)throw Error('Your taste changed in another tab. Reload before saving.');
      const next={profile:input.profile,revision:saved.revision+1};
      try{storage.setItem(KEY,JSON.stringify(next));}catch{throw Error('Your browser could not save your taste.');}
      return next;
    }
    const response=await fetchImpl(catalogueURL(path),{...options,credentials:'omit',cache:'no-store'});
    const result=await response.json();if(!response.ok)throw Error(result.error||'The catalogue could not be checked.');return result;
  };
}
