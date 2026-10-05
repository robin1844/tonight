const text=html=>html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&#(?:x27|39);|&apos;/g,"'").replace(/&quot;/g,'"').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
export function screenProvider(html,source,checkedAt){
 const title=text(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'');
 const service=/^https:\/\/tv\.apple\.com\/gb\/movie\//.test(source)?'apple':/^https:\/\/www\.disneyplus\.com\/en-gb\/browse\/entity-/.test(source)?'disney':null;
 if(!service||!title)return null;
 const visible=text(html),year=service==='apple'?text(html.match(/data-testid="information-releaseDate"[^>]*>[\s\S]*?<\/dd>/)?.[0]||'').match(/\b(?:19|20)\d{2}\b/)?.[0]:visible.match(/Release Date:\s*((?:19|20)\d{2})/)?.[1];
 const appleAudio=html.match(/<dt\b[^>]*data-testid="languages-audio"[^>]*>[\s\S]*?<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/i)?.[1];
 const englishAD=service==='apple'&&/<html\b[^>]*lang="en-GB"/i.test(html)&&/(?:^|,\s*)English\s*\([^)]*\bAD\b/.test(text(appleAudio||''));
 // Disney's badge does not identify a language. Never call it confirmed English AD.
 const primary=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').split(/<h1\b/i)[0];
 const badge=service==='disney'&&/\balt="Audio Description"/.test(primary);
 const categories=service==='disney'?text(html.match(/data-section="Categories"[^>]*>([\s\S]*?)<\/div>/)?.[1]||''):'';
 return {title,year,service,country:'GB',language:englishAD?'en':'und',scope:'movie',status:englishAD?'available':badge?'possible':'unknown',...(badge?{kind:'provider-ad-badge'}:{}),source,checkedAt,note:service==='apple'?'English AD listed in the UK title audio section; public metadata, not playback verification.':'UK title AD badge; language not identified. English AD remains unconfirmed.',categoryEvidence:/\bRomantic Comedy\b/i.test(categories)?[{category:'Romantic comedy',source}]:[]};
}
export function linkedProviderPages(html,service){
 const pattern=service==='apple'?/https:\/\/tv\.apple\.com\/gb\/movie\/[^\s"<>?\\]+/g:/\/en-gb\/browse\/entity-[a-z0-9-]+/g;
 return [...new Set(html.match(pattern)||[])].map(url=>service==='apple'?url:'https://www.disneyplus.com'+url);
}

