// No AI: deterministic eligibility and weighted, explainable feature matching.
export const DAY = 86400000;
export const SERVICES = [{id:'netflix',name:'Netflix',watchName:'Netflix',providerNames:['Netflix']},{id:'prime',name:'Prime Video',watchName:'Prime',providerNames:['Amazon Prime Video']},{id:'apple',name:'Apple TV',watchName:'Apple TV',providerNames:['Apple TV','Apple TV Plus']},{id:'disney',name:'Disney+',watchName:'Disney+',providerNames:['Disney Plus']}];
export function providerMap(providers){const map=new Map();for(const p of providers){const s=SERVICES.find(s=>s.providerNames.includes(p.provider_name));if(s)map.set(p.provider_id,s.id);}return map;}
export async function fillEmptySelection(state,{fetchPage,hasMatches,isCurrent=()=>true}) {
  while(!hasMatches(state.titles)&&state.page<state.totalPages&&isCurrent()) {
    const next=await fetchPage(state.page+1);
    if(!isCurrent())return null;
    state={page:next.page,totalPages:next.totalPages,titles:[...new Map([...state.titles,...next.titles].map(t=>[t.id,t])).values()]};
  }
  return isCurrent()?state:null;
}
export const CATEGORIES = [
  {id:'romantic-comedy',name:'Romantic comedy',genres:['Romance','Comedy'],mode:'all'},
  {id:'romance',name:'Romance',genres:['Romance']},
  {id:'comedy',name:'Comedy',genres:['Comedy']},
  {id:'drama',name:'Drama',genres:['Drama']},
  {id:'crime',name:'Crime',genres:['Crime']},
  {id:'thriller',name:'Thriller',genres:['Thriller']},
  {id:'mystery',name:'Mystery',genres:['Mystery']},
  {id:'horror',name:'Horror',genres:['Horror']},
  {id:'science-fiction',name:'Science fiction',genres:['Science Fiction']},
  {id:'fantasy',name:'Fantasy',genres:['Fantasy']},
  {id:'documentary',name:'Documentary',genres:['Documentary']},
  {id:'action-adventure',name:'Action & adventure',genres:['Action','Adventure']},
  {id:'animation',name:'Animation',genres:['Animation']},
  {id:'family',name:'Family',genres:['Family']},
  {id:'history',name:'History',genres:['History']},
  {id:'war',name:'War',genres:['War']},
  {id:'musical',name:'Musical',genres:[]},
  {id:'music',name:'Music',genres:['Music']}
];
const normaliseTag = value => value.toLowerCase().trim().replace(/[-_\s]+/g,' ');
export function isRomcomTag(value) {
  return ['romcom','rom com','romantic comedy','romantic comedies'].includes(normaliseTag(value));
}
export function normaliseCategory(value) {
  if(!value) return '';
  if(['action','adventure'].includes(value.toLowerCase()))return 'Action & adventure';
  return CATEGORIES.find(c=>c.id===value || c.name.toLowerCase()===value.toLowerCase())?.name || '';
}
export function matchesCategory(title, value) {
  if(!value)return true;
  const category=CATEGORIES.find(c=>c.name===normaliseCategory(value));
  if(!category)return false;
  if((title.categoryEvidence||[]).some(e=>e.category===category.name && /^https:\/\/(?:(?:www|media)\.netflix\.com\/|www\.disneyplus\.com\/en-gb\/browse\/|www\.apple\.com\/uk\/tv-pr\/)/.test(e.source||'')))return true;
  const genres=title.genres || [];
  if(category.id==='musical')return (title.tags||[]).some(t=>['musical','musicals','rock musical','broadway musical','musical theater','musical comedy','jukebox musical','musical revue','chinese musical'].includes(normaliseTag(t)));
  if(category.id==='romantic-comedy' && [...genres,...(title.tags||[])].some(isRomcomTag))return true;
  return category.mode==='all' ? category.genres.every(g=>genres.includes(g)) : category.genres.some(g=>genres.includes(g));
}
export function discoveryBranches(value, sourceGenres) {
  if(!value)return [{}];
  const category=CATEGORIES.find(c=>c.name===normaliseCategory(value));
  if(!category)throw new Error('Unknown film category.');
  // Exact musical keyword identities verified against TMDB on 7 Oct 2026.
  if(category.id==='musical')return [{with_keywords:'4344|355890|155710|165241|220201|240462|286529|188715|288062'}];
  const ids=category.genres.map(name=>sourceGenres.find(g=>g.name===name)?.id);
  if(ids.some(id=>!id))throw new Error('This category could not be checked. Please try again later.');
  const branches=[{with_genres:ids.join(category.mode==='all'?',':'|')}];
  // TMDB /search/keyword returned id 9799, exact name "romcom", checked 5 Oct 2026.
  if(category.id==='romantic-comedy')branches.push({with_keywords:'9799'});
  return branches;
}
export function filmCategoryLabels(title, selectedCategory='') {
  const selected=normaliseCategory(selectedCategory);
  return [...new Set([
    ...(selected&&matchesCategory(title,selected)?[selected]:[]),
    ...(matchesCategory(title,'Musical')?['Musical']:[]),
    ...(title.genres||[])
  ])];
}
export function discoveryWindow(page, branchCount) {
  const size=Math.floor(20/branchCount),sections=Math.ceil(20/size);
  return {sourcePage:Math.ceil(page/sections),start:((page-1)%sections)*size,size,sections};
}
export function fresh(at, now, maxAge = DAY) {
  const t = Date.parse(at);
  // A fresh server response can arrive a little ahead of the device clock.
  return Number.isFinite(t) && t <= now + 60000 && now - t <= maxAge;
}

export function eligibleOffers(title, settings, now = Date.now()) {
  return (title.offers || []).filter(o =>
    o.country === settings.country && settings.services.includes(o.service) &&
    o.type === 'subscription' && !o.addon && !o.price &&
    fresh(o.checkedAt, now, settings.maxAge ?? DAY) &&
    (!o.expiresAt || (Number.isFinite(Date.parse(o.expiresAt)) && Date.parse(o.expiresAt) > now)) &&
    (!settings.adOnly || (title.adEvidence || []).some(a =>
      a.status === 'available' && a.service === o.service && a.country === o.country &&
      a.language === 'en' && a.source && a.scope === 'movie' &&
      fresh(a.checkedAt, now, settings.adMaxAge ?? settings.maxAge ?? DAY)))
  );
}

// Confidence describes the track on an eligible service, not subscription availability.
export function adConfidence(title, settings, now=Date.now()) {
  const offers=eligibleOffers(title,{...settings,adOnly:false},now);
  let best={level:0,label:'AD unknown',source:null};
  for(const a of title.adEvidence||[]) {
    if(!(a.language==='en'||(a.language==='und'&&a.status==='possible'))||!a.source||!fresh(a.checkedAt,now,settings.adMaxAge??30*DAY))continue;
    const same=offers.some(o=>o.service===a.service);
    let level=0;
    if(same&&a.country===settings.country&&a.scope==='movie'&&a.status==='available'&&a.language==='en')level=4;
    else if(same&&a.country===settings.country&&a.scope==='movie'&&a.kind==='provider-ad-badge'&&a.status==='possible')level=3;
    else if(same&&a.scope==='movie'&&a.status==='likely')level=2;
    else if(offers.length&&['available','likely','possible'].includes(a.status))level=1;
    if(level>best.level)best={level,label:['AD unknown','AD possible · version unverified','AD likely · UK track unverified','Provider advertises AD · language unverified','English AD confirmed'][level],source:a.source,service:a.service};
  }
  return best;
}

// Feature families keep a long cast list from overwhelming genre/theme evidence.
export function features(title) {
  return [...new Set([
    ...(title.genres || []).map(x => `genre:${x}`),
    ...(title.tags || []).map(x => `tag:${x}`),
    ...(title.cast || []).map(x => `cast:${x}`),
    ...(title.directors || []).map(x => `director:${x}`)
  ])];
}
const ratings = { loved: 2, liked: 1, disliked: -2 };
const importance = { genre: 1, tag: 2, cast: 0.4, director: 0.7 };

export function tasteWeights(anchors, feedback) {
  const totals = new Map();
  for (const title of anchors) {
    const rating = ratings[feedback[title.id]];
    if (!rating) continue; // Unseen, skipped and "not tonight" are not dislikes.
    for (const feature of features(title)) {
      const entry = totals.get(feature) || { sum: 0, count: 0 };
      entry.sum += rating; entry.count += 1; totals.set(feature, entry);
    }
  }
  // Shrink weak evidence towards neutral rather than treating one rating as certainty.
  return new Map([...totals].map(([key, v]) => [key, v.sum / (v.count + 2)]));
}

export function rankTitles(catalogue, anchors, profile, now = Date.now()) {
  const weights = tasteWeights(anchors, profile.feedback || {});
  const seen = new Set(Object.entries(profile.feedback || {})
    .filter(([,r]) => ['loved','liked','disliked','seen'].includes(r)).map(([id]) => id));
  return catalogue.filter(t => t.kind === 'movie' && !seen.has(t.id) &&
    matchesCategory(t, profile.genre))
    .map(t => {
      const offers = eligibleOffers(t, {...profile,adOnly:false}, now);
      const ad = adConfidence(t,profile,now);
      const matched = features(t).filter(f => weights.has(f));
      const groups = new Map();
      for (const f of matched) {
        const family = f.split(':')[0];
        const g = groups.get(family) || [];
        g.push(weights.get(f)); groups.set(family, g);
      }
      const score = [...groups].reduce((sum, [family, values]) =>
        sum + importance[family] * values.reduce((a,b) => a+b, 0) / values.length, 0);
      const reasons = matched.filter(f => weights.get(f) > 0)
        .sort((a,b) => importance[b.split(':')[0]] * weights.get(b) - importance[a.split(':')[0]] * weights.get(a))
        .slice(0,3).map(f => `Matches your interest in ${f.slice(f.indexOf(':') + 1)}.`);
      return { ...t, offers, score, ad, reasons: reasons.length ? reasons : ['Still learning your taste in this category.'] };
    }).filter(t => t.offers.length)
    .sort((a,b) => (profile.favourAD?b.ad.level-a.ad.level:0) || b.score - a.score || a.title.localeCompare(b.title));
}

export function streamingOffers(show, checkedAt, country = 'GB') {
  return (show.streamingOptions?.[country.toLowerCase()] || []).map(o => ({
    country, service: o.service.id, type: o.type, addon: o.addon?.id || null,
    price: o.price || null, url: o.link, checkedAt,
    expiresAt: o.expiresOn ? new Date(o.expiresOn * 1000).toISOString() : null
  }));
}

export function tmdbOffers(response, providerMap, checkedAt, country = 'GB') {
  const region = response.results?.[country];
  if (!region) return [];
  // Only actual offers in flatrate qualify, never a title-level provider match.
  return (region.flatrate || []).flatMap(o => providerMap.has(o.provider_id) ? [{
    country, service: providerMap.get(o.provider_id), type: 'subscription',
    checkedAt, url: region.link, addon: null, price: null
  }] : []);
}

export function netflixADEvidence(html, source, checkedAt) {
  // Inspect the visible Audio section, not matches in embedded recommendation data.
  const audio = html.match(/<h4\b[^>]*>\s*Audio\s*<\/h4>\s*<span\b[^>]*>([\s\S]*?)<\/span>/i)?.[1]
    ?.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&');
  const uk = /<html\b[^>]*lang="en-GB"/i.test(html) && /^https:\/\/www\.netflix\.com\/gb\/title\/\d+$/.test(source);
  return {
    service: 'netflix', country: 'GB', language: 'en', scope: 'movie', source, checkedAt,
    status: uk && audio && /(?:^|,\s*)English\s*-\s*Audio Description(?:,|$)/i.test(audio) ? 'available' : 'unknown',
    audioSectionFound: Boolean(audio),
    note: 'Public-page metadata; not playback or membership availability verification. Missing AD remains unknown.'
  };
}
