import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {build} from 'esbuild';
import {observePage,applyWebAction,readOnlyUrl} from '../src/bridge/browser-research';
import {resultJsonSchema,ResultSchema} from '../src/shared/types';

test('reply schema no longer asks for either kind of translation',()=>{
 assert.ok(!('translations' in resultJsonSchema.properties));assert.ok(!('replyVi' in resultJsonSchema.properties));
 assert.ok(ResultSchema.safeParse({language:'en',reply:'Hi',questions:[],needsWebsite:false,searchTerms:[],warnings:[]}).success);
});
test('panel typing is isolated from hostile parent capture handlers, preserving React input and focus',async()=>{
 const compiled=await build({entryPoints:['src/extension/content.tsx'],bundle:true,write:false,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"production"'}});
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://www.instagram.com/**',route=>route.fulfill({contentType:'text/html',body:'<html><body><input id="instagram-composer"></body></html>'}));
  await page.addInitScript('globalThis.__name = (fn => fn)');
  await page.goto('https://www.instagram.com/direct/inbox/');
  await page.evaluate(()=>{
   (window as any).leaked=0;(window as any).chrome={storage:{local:{get:async()=>({})}},runtime:{onMessage:{addListener(){},removeListener(){}},sendMessage:async()=>({ok:false,error:'Pair first'})}};
   for(const name of ['pointerdown','mousedown','keydown','keyup','keypress','beforeinput','input','compositionstart','compositionend','paste'])window.addEventListener(name,()=>{(window as any).leaked++;(document.querySelector('#instagram-composer') as HTMLElement).focus();},true);
  });
  await page.addScriptTag({content:compiled.outputFiles[0].text});
  await page.waitForFunction(()=>document.getElementById('ig-shop-assistant-root'));
  const frame=page.frames().find(f=>f.parentFrame())!;
  const server=frame.locator('input').first();await server.fill('');await server.pressSequentially('https://example.test');
  assert.equal(await server.inputValue(),'https://example.test');
  await server.evaluate(el=>{el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,composed:true,data:'ệ'}));el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,composed:true,data:'ệ'}));});
  assert.equal(await server.evaluate(el=>el.ownerDocument.activeElement===el),true);
  assert.equal(await page.evaluate(()=>(window as any).leaked),0);
  await frame.getByRole('button',{name:'Kết nối',exact:true}).click();
  assert.ok((await frame.locator('.error').textContent())?.includes('Pair first'));
  await frame.getByTitle('Thu gọn').click();await frame.getByRole('button',{name:/Trợ lý IG/}).click();
  assert.equal(await server.inputValue(),'https://example.test');assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
test('web controls support filters, sorting, pagination and block purchase actions',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();
  await page.route('https://shop.test/**',route=>route.fulfill({contentType:'text/html',body:`<main>
   <label>Max price<input name="max" type="number"></label><label>Color<select><option value="all">All</option><option value="black">Black</option></select></label>
   <button onclick="document.querySelector('#products').textContent='Black shelf $40';history.replaceState({},'', '?max='+document.querySelector('input').value)">Apply filters</button>
   <div id="products">Products</div><a href="?page=2">Next</a><a href="/products/black-shelf">Black shelf</a><button>Add to cart</button><a href="/checkout">Checkout</a></main>`}));
  await page.goto('https://shop.test/collections/all');const allowed=(u:string)=>new URL(u).hostname==='shop.test';
  let view=await observePage(page);
  assert.ok(!view.controls.some(c=>/cart|checkout/i.test(c.label)));
  const price=view.controls.find(c=>c.kind==='fill')!;await applyWebAction(page,view.controls,{id:price.id,kind:'fill',value:'50'},allowed);
  const color=view.controls.find(c=>c.kind==='select')!;
  await assert.rejects(applyWebAction(page,view.controls,{id:color.id,kind:'select',value:'invented'},allowed));
  await applyWebAction(page,view.controls,{id:color.id,kind:'select',value:'black'},allowed);
  const apply=view.controls.find(c=>c.label==='Apply filters')!;await applyWebAction(page,view.controls,{id:apply.id,kind:'click',value:''},allowed);
  view=await observePage(page);assert.ok(view.source.text.includes('Black shelf $40'));assert.ok(view.source.url.includes('max=50'));
  await applyWebAction(page,view.controls,{id:view.controls.find(c=>c.label==='Next')!.id,kind:'open',value:''},allowed);
  assert.ok(page.url().includes('page=2'));
  await assert.rejects(applyWebAction(page,[{id:'bad',kind:'open',label:'Bad',url:'https://evil.test'}],{id:'bad',kind:'open',value:''},allowed));
  assert.equal(readOnlyUrl('https://shop.test/cart/add?id=1'),false);
 }finally{await browser.close();}
});
