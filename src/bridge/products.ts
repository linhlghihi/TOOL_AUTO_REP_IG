import * as cheerio from 'cheerio';
import {publicFetch} from './network';
import {normalizeProductLinks} from '../shared/product-links';
import type {Source} from '../shared/types';
export function productSource(html:string,url:string):Source {
 const d=cheerio.load(html);const title=d('title').text();
 const structured=d('script[type="application/ld+json"]').toArray().map(el=>d(el).text()).join('\n').slice(0,16000);
 const prices=d('meta[property^="product:price"],meta[property^="og:price"]').toArray().map(el=>`${d(el).attr('property')}: ${d(el).attr('content')}`).join('\n');
 d('script,style,nav,footer,header,noscript,svg,form').remove();
 const text=(d('main').length?d('main'):d('body')).text().replace(/\s+/g,' ').trim().slice(0,22000);
 if(text.length<80&&!structured)throw new Error('Trang không có đủ nội dung sản phẩm đọc được.');
 return {url,title,text:`PAGE CONTENT (prices may depend on currency/variant):\n${text}\nPRICE METADATA:\n${prices}\nSTRUCTURED DATA (may differ from displayed currency; do not mix currencies):\n${structured}`,fetchedAt:Date.now()};
}
export async function readProductLinks(values:string[],signal:AbortSignal):Promise<{sources:Source[];errors:string[]}>{
 const links=normalizeProductLinks(values);
 const results=await Promise.allSettled(links.map(async url=>{
  const host=new URL(url).hostname;
  const allowed=(target:string)=>{const u=new URL(target);return u.hostname===host&&!/\/(cart|checkout|account|login|logout|admin)(\/|$)/i.test(u.pathname);};
  const page=await publicFetch(url,allowed,signal);
  if(!/html|text/i.test(page.mime))throw new Error('Link không phải trang sản phẩm dạng HTML.');
  return productSource(page.body.toString('utf8'),page.url);
 }));
 signal.throwIfAborted();
 const sources:Source[]=[],errors:string[]=[];
 results.forEach((result,i)=>{if(result.status==='fulfilled')sources.push(result.value);else errors.push(`${links[i]} — ${String(result.reason?.message||result.reason).slice(0,250)}`);});
 return {sources,errors};
}
