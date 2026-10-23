// Focused informational-footer regression, not a release certification.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const cfg={"slug": "smart-image-sorter", "bp": 700, "end": "#footerVersion", "badge": "localBadge", "header": ".dialog-header", "close": "#closeHelpButton"};
const evidence=path.resolve('test-results/mobile-footer');
async function main(){
 fs.mkdirSync(evidence,{recursive:true});const browser=await chromium.launch();
 try{for(const language of ['ja','en'])for(const [width,height,touch]of [[1360,900,false],[cfg.bp+1,568,false],[cfg.bp,568,false],[320,568,false],[393,252,false],...(cfg.slug==='presentation-remote'?[[900,500,false]]:[])]){
 const context=await browser.newContext({viewport:{width,height},locale:language,reducedMotion:'reduce',hasTouch:touch});
 const page=await context.newPage(),errors=[],requests=[],label=`${language}-${width}x${height}${touch?'-coarse':''}`;
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 try{
 await page.goto(pathToFileURL(path.resolve(__dirname,'../dist/index.html')).href);
 await page.locator('#helpButton').waitFor();
 if(await page.locator('html').getAttribute('lang')!==language)await page.locator('#languageButton').click();
 const badge=page.locator('[data-i18n="'+cfg.badge+'"]');
 assert.equal((await badge.textContent()).trim(),cfg.slug==='presentation-remote'?(language==='ja'?'資料はアップロードしません':'The deck is not uploaded'):(language==='ja'?'完全ローカル処理':'Fully local processing'));
 const phone=width<=cfg.bp||(cfg.slug==='presentation-remote'&&width>height&&height<=560&&width<=1000);
 assert.equal(await page.locator('body > footer').isVisible(),!phone,label+': footer');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+': page width');
 if(cfg.slug==='markdown-preview-lab')assert.equal(await page.locator('.mobile-view-switch').isVisible(),width<=720,label+': workflow switch');
 if(cfg.slug==='smart-image-sorter')assert.equal(await page.locator('.mobile-bottom-bar').isVisible(),width<=600,label+': existing navigation breakpoint');
 await page.locator('#helpButton').click();
 await page.locator('#helpDialog .dialog-body').evaluate(el=>{el.scrollTop=el.scrollHeight;});
 const bounds=await page.locator(cfg.end).evaluate(el=>{const range=document.createRange(),t=el.firstChild;range.setStart(t,t.textContent.length-1);range.setEnd(t,t.textContent.length);const r=range.getBoundingClientRect();let top=0,bottom=innerHeight;for(let p=el.parentElement;p;p=p.parentElement){const s=getComputedStyle(p);if(/auto|scroll|hidden|clip/.test(s.overflowY)){const b=p.getBoundingClientRect();top=Math.max(top,b.top);bottom=Math.min(bottom,b.bottom);}}return{top:r.top,bottom:r.bottom,clipTop:top,clipBottom:bottom};});
 assert.ok(bounds.top>=bounds.clipTop-1&&bounds.bottom<=bounds.clipBottom+1,label+': Help end reachable '+JSON.stringify(bounds));
 if([1360,320].includes(width))await page.screenshot({path:path.join(evidence,label+'.png')});
 const header=await page.locator('#helpDialog '+cfg.header).boundingBox();assert.ok(header&&header.y>=0&&header.y+header.height<=height,label+': Help header visible');
 await page.keyboard.press('Escape');assert.equal(await page.locator('#helpDialog').isVisible(),false,label+': Escape closes Help');
 await page.locator('#helpButton').click();await page.locator(cfg.close).click();assert.equal(await page.locator('#helpDialog').isVisible(),false,label+': close');
 assert.deepEqual(errors,[],label+': runtime errors');assert.deepEqual(requests,[],label+': external requests');console.log('PASS '+label);
 }catch(error){await page.screenshot({path:path.join(evidence,'failure-'+label+'.png')}).catch(()=>{});throw error;}finally{await context.close();}
 }}finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
