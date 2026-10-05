// No AI: deterministic eligibility and weighted, explainable feature matching.
export const DAY = 86400000;
export function fresh(at, now, maxAge = DAY) {
  const t = Date.parse(at);
  return Number.isFinite(t) && t <= now && now - t <= maxAge;
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
    (!profile.genre || t.genres?.includes(profile.genre)))
    .map(t => {
      const offers = eligibleOffers(t, profile, now);
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
      return { ...t, offers, score, reasons: reasons.length ? reasons : ['Still learning your taste in this category.'] };
    }).filter(t => t.offers.length)
    .sort((a,b) => b.score - a.score || a.title.localeCompare(b.title));
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
