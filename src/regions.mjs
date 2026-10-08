export const COUNTRIES = [{id:'GB',name:'United Kingdom',flag:'🇬🇧'},{id:'US',name:'United States',flag:'🇺🇸'},{id:'CA',name:'Canada',flag:'🇨🇦'}];
export const validCountry = country => COUNTRIES.some(c=>c.id===country);
export const regionLanguage = country => `en-${country}`;
// Regional evidence is never borrowed from another country. Existing UK
// investigations with unspecified territory remain weaker UK-only evidence.
export function regionalEvidence(records,country) {
  return records.filter(a=>a.country===country || (country==='GB'&&a.country==='unknown'));
}
