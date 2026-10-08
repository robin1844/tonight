import {screenProvider} from './provider-screen.mjs';
export function screenRegionalProvider(html,requested,finalURL,country,checkedAt){
 const slug=country.toLowerCase();
 const apple=requested.startsWith(`https://tv.apple.com/${slug}/movie/`);
 const disney=requested.startsWith(`https://www.disneyplus.com/en-${slug}/browse/entity-`);
 if(finalURL!==requested||(!apple&&!disney))return null;
 const canonical=html.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1];
 if(canonical!==requested)return null;
 if(apple&&!new RegExp(`<html\\b[^>]*lang="en-${country}"`,'i').test(html))return null;
 // Disney Canada explicitly identifies the regional storefront in its title.
 // The US route currently redirects to an unlabelled global page: reject it.
 if(disney&&(country!=='CA'||!/<title[^>]*>[^<]*Disney\+ Canada<\/title>/i.test(html)))return null;
 const uk=requested.replace(`/${apple?slug:'en-'+slug}/`,apple?'/gb/':'/en-gb/');
 const record=screenProvider(html.replace(new RegExp(`lang="en-${country}"`,'i'),'lang="en-GB"'),uk,checkedAt);
 if(!record||!['available','possible'].includes(record.status))return null;
 return {...record,country,source:requested,note:apple?'English AD listed on the verified regional Apple storefront; public metadata, not playback verification.':'Canadian Disney storefront AD badge; language not identified.'};
}
