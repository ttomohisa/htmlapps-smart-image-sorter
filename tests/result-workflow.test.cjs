// Synthetic metadata and minimal DOM harness: no browser, image decoding or model execution.
// Run: node --test tests/result-workflow.test.cjs
// Also accepts SORTER_HTML=/absolute/path/to/generated.html.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SORTER_HTML || path.join(root, 'src/index.template.html'), 'utf8');
const categoryDefs = JSON.parse(fs.readFileSync(path.join(root, 'data/fixed-label-prototypes.json'))).categories;
function sourceFunction(name) {
  const start = new RegExp(`^\\s*(?:async )?function ${name}\\(`, 'm').exec(html);
  if (!start) return '';
  const lines = html.slice(start.index).trimStart().split('\n');
  let code = '';
  for (const line of lines) {
    code += line + '\n';
    try { new vm.Script(`(${code})`); return code; } catch {}
  }
  throw new Error(`Cannot extract ${name}`);
}
const noop = () => {};
function element(tag = 'div') {
  const classes = new Set();
  return {tagName:tag.toUpperCase(),children:[],dataset:{},style:{},value:'',hidden:false,disabled:false,textContent:'',attributes:{},
    classList:{add:(...xs)=>xs.forEach(x=>classes.add(x)),remove:(...xs)=>xs.forEach(x=>classes.delete(x)),contains:x=>classes.has(x),toggle:(x,flag)=>flag?classes.add(x):classes.delete(x)},
    append(...xs){this.children.push(...xs)},replaceChildren(...xs){this.children=[...xs]},
    setAttribute(key,value){this.attributes[key]=String(value)},getAttribute(key){return this.attributes[key]},
    get options(){return this.children},querySelector(){return null},scrollIntoView:noop,
    focus(){this.focused=true},addEventListener:noop};
}
function file(extra = {}) { return {name:'photo.png',type:'image/png',size:1024,lastModified:1700000000000,webkitRelativePath:'album/A/photo.png',...extra}; }
function legacyRecord(f, category = 'food', extra = {}) {
  const p = f.webkitRelativePath || f.name;
  return {key:`${p.replaceAll('\\','/').toLowerCase()}|${f.size}|${f.lastModified}`,looseKey:`${f.name.toLowerCase()}|${f.size}|${f.lastModified}`,path:p,name:f.name,size:f.size,lastModified:f.lastModified,
    autoCategoryId:category,manualCategoryId:category,review:false,scores:[{categoryId:category,prob:.9,similarity:.42}],...extra};
}
function entry(f, id = 'one', extra = {}) { return {id,file:f,scores:null,autoCategoryId:null,manualCategoryId:null,review:false,...extra}; }
function harness(extra = {}, names = []) {
  const elements = new Map(), messages = [];
  const $ = key => {if (!elements.has(key)) elements.set(key,element());return elements.get(key)};
  const context = vm.createContext({console,Blob,TextEncoder,Uint8Array,DataView,Date,Math,JSON,Number,Set,Map,Array,Object,String,Boolean,
    $,$$:()=>[],document:{createElement:element},CSS:{escape:x=>x},requestAnimationFrame:fn=>fn(),setTimeout:fn=>fn(),clearTimeout:noop,
    images:[],categories:[{id:'food',label:'Food'},{id:'scenery',label:'Scenery'}],filter:'all',resultSearchQuery:'',visibleLimit:60,lastReviewJumpId:null,resultViewGeneration:0,
    selectedImageIds:new Set(),mobileExpandedImageIds:new Set(),classificationDirty:false,classificationGeneration:0,textEmbeddingCache:null,textEmbeddingCacheKey:'',
    workSessionPending:null,workSessionRestoredIds:new Set(),workSessionRestoredRecordIndexes:new Set(),workSessionAmbiguousCount:0,workSessionAutosaveSuppressed:false,
    WORK_SESSION_SCHEMA_VERSION:1,APP_CONFIG:{version:'1.0.0'},URL:{createObjectURL:()=>`blob:${Math.random()}`,revokeObjectURL:noop},
    findCategoryDef:k=>categoryDefs.find(c=>c.key===k)||null,categoryLabel:k=>k,catalogLabel:c=>c.en,currentModelLabel:()=> 'TinyCLIP ViT-8M/16 · vision-only INT8',activeCategoryDefs:()=>categoryDefs.filter(c=>['food','scenery'].includes(c.key)),
    renderImagePreview:noop,renderResults:noop,updateClassifyButton:noop,scheduleWorkSessionSave:noop,updateWorkSessionUi:noop,updateWorkflowUi:noop,
    updateResultEmptyState:noop,renderResultState:noop,updateBulkSelect:noop,updateReclassifyNote:noop,applyWorkSessionSettings:noop,deleteLocalWorkSession:noop,
    confirmBox:async()=>true,toast:m=>messages.push(m),tr:(key,values={})=>key+JSON.stringify(values),
    renderImageCard:x=>({id:x.id}),renderFailedCard:x=>({id:x.id}),processingErrorText:x=>x.processingError,
    ...extra});
  const helpers = ['workFilePath','workFileRelativePath','workFileKey','workFileLooseKey','workRecordFile','isValidWorkSession','restoreScoreList','restoreMatchingWorkRecords','addFiles','effectiveCategory','assignedCategory','matchesResultSearch','matchesResultView','resultViewItems','resetResultSearch','setResultSearch','clearResultSearch'];
  vm.runInContext(`const accepted=/\\.(jpe?g|png|webp|avif)$/i;\n${[...new Set([...helpers,...names])].map(sourceFunction).join('\n')}`,context);
  return {ctx:context,$,messages,elements};
}
function restore(records, files) {
  const h = harness({images:files.map((f,i)=>entry(f,`i${i}`)),workSessionPending:{schemaVersion:1,categoryKeys:['food','scenery'],records}});
  assert.equal(h.ctx.isValidWorkSession(h.ctx.workSessionPending),true);
  h.restored=h.ctx.restoreMatchingWorkRecords();return h;
}
function ids(xs) {return Array.from(xs,x=>x.id)}
const a = file(), b = file({webkitRelativePath:'album/B/photo.png'}), plain = file({webkitRelativePath:''});

test('intake retains separate original Files with identical metadata in different folders', () => {
  const {ctx}=harness();ctx.addFiles([a,b]);assert.equal(ctx.images.length,2);assert.equal(ctx.images[0].file,a);assert.equal(ctx.images[1].file,b);assert.notEqual(ctx.images[0].id,ctx.images[1].id);
});
test('successive folder intake retains distinct paths and rejects exact duplicates', () => {
  const {ctx}=harness();ctx.addFiles([a]);ctx.addFiles([b,a]);assert.equal(ctx.images.length,2);
});
test('case-only paths and filenames are not destructively folded during intake', () => {
  const {ctx}=harness();ctx.addFiles([a,file({webkitRelativePath:'album/a/photo.png'}),file({name:'PHOTO.png',webkitRelativePath:'album/A/PHOTO.png'})]);assert.equal(ctx.images.length,3);
});
test('normalized backslashes dedupe the same path; pathless and known files remain distinct', () => {
  const {ctx}=harness();ctx.addFiles([a,file({webkitRelativePath:'album\\A\\photo.png'}),plain,plain]);assert.equal(ctx.images.length,2);
});
test('metadata and extension controls remain intact', () => {
  const {ctx}=harness();ctx.addFiles([a,file({size:1025}),file({lastModified:1}),file({name:'other.png'}),file({name:'photo.txt',type:'text/plain'})]);assert.equal(ctx.images.length,4);
});
test('legacy raw paths restore their own scores and manual categories', () => {
  const h=restore([legacyRecord(a,'food'),legacyRecord(b,'scenery')],[b,a]);assert.equal(h.restored,2);assert.deepEqual(Array.from(h.ctx.images,x=>x.manualCategoryId),['scenery','food']);assert.equal(h.ctx.images[0].scores[0].similarity,.42);
});
test('known different paths never inherit a loose record', () => {
  const h=restore([legacyRecord(a)],[b]);assert.equal(h.restored,0);assert.equal(h.ctx.images[0].scores,null);
});
test('unique pathless reselection still restores schema-v1 records', () => {
  const h=restore([legacyRecord(a)],[plain]);assert.equal(h.restored,1);assert.equal(h.ctx.images[0].manualCategoryId,'food');
});
test('ambiguous pathless fallback restores nothing and explains folder reselection', () => {
  const h=restore([legacyRecord(a),legacyRecord(b,'scenery')],[plain]);assert.equal(h.restored,0);assert.equal(h.ctx.images[0].scores,null);assert.equal(h.ctx.workSessionAmbiguousCount,1);assert.ok(h.messages.some(m=>m.startsWith('workSessionAmbiguous')));
});
test('one pathless saved record is not assigned arbitrarily among known files', () => {
  const h=restore([legacyRecord(plain)],[a,b]);assert.equal(h.restored,0);assert.equal(h.ctx.workSessionAmbiguousCount,2);
});
test('exact matches take priority over fallback regardless of image order', () => {
  for(const files of [[plain,a],[a,plain]]) {const h=restore([legacyRecord(a)],[...files]);assert.equal(h.restored,1);assert.equal(h.ctx.images.find(x=>x.file===a).manualCategoryId,'food');assert.equal(h.ctx.images.find(x=>x.file===plain).scores,null);}
});
test('duplicate saved identity stays ambiguous instead of last-write-wins', () => {
  const h=restore([legacyRecord(a),legacyRecord(a,'scenery')],[a]);assert.equal(h.restored,0);
});
test('a consumed record cannot restore a later file while other records are pending', () => {
  const other=file({name:'other.png',webkitRelativePath:'album/other.png'});
  const h=restore([legacyRecord(a),legacyRecord(other,'scenery')],[a]);assert.equal(h.restored,1);h.ctx.images.push(entry(plain,'later'));assert.equal(h.ctx.restoreMatchingWorkRecords(),0);assert.equal(h.ctx.images[1].scores,null);
});
test('known case-only paths use raw schema-v1 metadata even though old keys collide', () => {
  const lower=file({webkitRelativePath:'album/a/photo.png'});const h=restore([legacyRecord(a),legacyRecord(lower,'scenery')],[a,lower]);assert.equal(h.restored,2);assert.deepEqual(Array.from(h.ctx.images,x=>x.manualCategoryId),['food','scenery']);
});
test('Unicode, spaces, backslashes and pipe characters retain separate identities', () => {
  const f=file({name:'写真 | 1.png',webkitRelativePath:'旅行 A\\写真 | 1.png'}),g=file({name:'写真 | 1.png',webkitRelativePath:'旅行 B/写真 | 1.png'});
  const h=restore([legacyRecord(f),legacyRecord(g,'scenery')],[f,g]);assert.equal(h.restored,2);assert.deepEqual(Array.from(h.ctx.images,x=>x.manualCategoryId),['food','scenery']);
});
test('structured identity cannot collide on pipe-separated fields', () => {
  const {ctx}=harness();const left=file({name:'a|1',webkitRelativePath:'root/a|1',size:2,lastModified:3}),right=file({name:'a',webkitRelativePath:'root/a',size:1,lastModified:2});
  assert.notEqual(ctx.workFileKey(left),ctx.workFileKey(right));assert.notEqual(ctx.workFileLooseKey(left),ctx.workFileLooseKey(right));
  assert.notEqual(ctx.workFileKey(file({webkitRelativePath:'same',name:'one.png'})),ctx.workFileKey(file({webkitRelativePath:'same',name:'two.png'})));
});
test('different file metadata does not restore', () => {
  assert.equal(restore([legacyRecord(a)],[file({size:1025})]).restored,0);assert.equal(restore([legacyRecord(a)],[file({lastModified:1})]).restored,0);
});

function classified(f, id, extra={}) {return entry(f,id,{scores:[{categoryId:'food',label:'Food',prob:.9,similarity:.42}],autoCategoryId:'food',...extra})}
function viewHarness(extra={}) {return harness(extra,['renderResults','visibleClassified','selectVisible','jumpToReview','jumpToNextReview','jumpToPreviousReview','afterReviewDecision'])}
const mixed = () => [
  classified(file({name:'Dinner [1].PNG',webkitRelativePath:'Trip Tokyo/Dinner [1].PNG'}),'food'),
  classified(file({name:'写真.png',webkitRelativePath:'旅行 京都/写真.png'}),'review',{review:true}),
  classified(file({name:'other.png',webkitRelativePath:'Trip Tokyo/other.png'}),'scenery',{autoCategoryId:'scenery'}),
  entry(file({name:'bad.png',webkitRelativePath:'Trip Tokyo/bad.png'}),'failed',{processingError:'decode'}),
  entry(file({name:'pending.png',webkitRelativePath:'Trip Tokyo/pending.png'}),'pending')
];
test('search filters actual rendered results by basename, folder, case, literal punctuation and Japanese',()=>{
  for(const [query,expected] of [[' DINNER [1] ',['food']],['trip tokyo',['food','scenery','failed']],['旅行',['review']],['.*',[]],['   ',['food','review','scenery','failed']]]) {
    const h=viewHarness({images:mixed(),resultSearchQuery:query});h.ctx.renderResults();assert.deepEqual(ids(h.$('#imageGrid').children),expected);
  }
});
test('search intersects all/category/review/failed without exposing pending files or mutating decisions',()=>{
  const images=mixed(),before=JSON.stringify(images);const h=viewHarness({images,resultSearchQuery:'Trip'});
  for(const [filter,expected] of [['all',['food','scenery','failed']],['food',['food']],['scenery',['scenery']],['__review__',[]],['__failed__',['failed']]]) {h.ctx.filter=filter;h.ctx.renderResults();assert.deepEqual(ids(h.$('#imageGrid').children),expected)}
  assert.equal(JSON.stringify(images),before);assert.equal(h.$('#sortingReviewCount').textContent,1);
});
test('zero matches retain query and filter, display count/clear state and keep global review counts',()=>{
  const h=viewHarness({images:mixed(),filter:'__review__',resultSearchQuery:'absent'});h.ctx.renderResults();assert.equal(h.ctx.filter,'__review__');assert.equal(h.ctx.resultSearchQuery,'absent');assert.equal(h.$('#resultSearchEmpty').hidden,false);assert.equal(h.$('#resultSearchCount').textContent,'resultSearchCount{"count":0}');assert.equal(h.$('#sortingReviewCount').textContent,1);
  for(const id of ['previousReviewButton','nextReviewButton','reviewFocusButton'])assert.equal(h.$(`#${id}`).disabled,true);
});
test('paging keeps order and selection adds only classified cards actually on the rendered page',()=>{
  const images=Array.from({length:75},(_,i)=>classified(file({name:`match-${i}.png`}),`m${i}`));images.splice(5,0,entry(file({name:'match-fail.png'}),'failed',{processingError:'decode'}));images.unshift(classified(file({name:'hidden.png'}),'hidden'));
  const h=viewHarness({images,resultSearchQuery:'match',selectedImageIds:new Set(['hidden'])});h.ctx.renderResults();const first=ids(h.$('#imageGrid').children);assert.equal(first.length,60);assert.equal(first.at(-1),'m58');h.ctx.selectVisible();assert.equal(h.ctx.selectedImageIds.size,60);assert.equal(h.ctx.selectedImageIds.has('hidden'),true);assert.equal(h.ctx.selectedImageIds.has('m59'),false);assert.equal(h.ctx.selectedImageIds.has('failed'),false);
  h.ctx.visibleLimit+=60;h.ctx.renderResults();assert.equal(h.$('#imageGrid').children.length,76);assert.deepEqual(ids(h.$('#imageGrid').children).slice(0,60),first);assert.equal(h.$('#loadMoreButton').hidden,true);
});
test('review previous/next stays search-scoped and labels position against matching reviews',()=>{
  const images=[classified(file({name:'yes-1.png'}),'r1',{review:true}),classified(file({name:'no.png'}),'hidden',{review:true}),classified(file({name:'yes-2.png'}),'r2',{review:true})];
  const h=viewHarness({images,resultSearchQuery:'yes'});h.ctx.jumpToNextReview();assert.equal(h.ctx.lastReviewJumpId,'r1');h.ctx.jumpToNextReview();assert.equal(h.ctx.lastReviewJumpId,'r2');assert.equal(h.$('#reviewPositionLabel').textContent,'reviewPosition{"current":2,"total":2}');h.ctx.jumpToPreviousReview();assert.equal(h.ctx.lastReviewJumpId,'r1');assert.equal(h.$('#sortingReviewCount').textContent,3);
});
test('resolving last matching review never advances to a hidden review or claims all review is done',()=>{
  const shown=classified(file({name:'yes.png'}),'shown',{review:true}),hidden=classified(file({name:'no.png'}),'hidden',{review:true});
  const h=viewHarness({images:[shown,hidden],resultSearchQuery:'yes',filter:'__review__',lastReviewJumpId:'shown'});shown.manualCategoryId='food';h.ctx.afterReviewDecision(true);assert.notEqual(h.ctx.lastReviewJumpId,'hidden');assert.equal(h.ctx.filter,'__review__');assert.equal(h.$('#imageGrid').children.length,0);assert.equal(h.$('#nextReviewButton').disabled,true);h.ctx.jumpToNextReview();assert.equal(h.ctx.filter,'__review__');assert.ok(!h.messages.some(m=>m.startsWith('noReviewLeft')));
});
test('query change and Clear reset paging/cursor, retain hidden selection and return keyboard focus',()=>{
  const h=viewHarness({images:mixed(),selectedImageIds:new Set(['scenery']),visibleLimit:120,lastReviewJumpId:'review'});
  assert.equal(typeof h.ctx.setResultSearch,'function');h.ctx.setResultSearch('旅行');assert.equal(h.ctx.visibleLimit,60);assert.equal(h.ctx.lastReviewJumpId,null);assert.equal(h.ctx.resultSearchQuery,'旅行');assert.equal(h.ctx.selectedImageIds.has('scenery'),true);
  h.ctx.clearResultSearch();assert.equal(h.ctx.resultSearchQuery,'');assert.equal(h.$('#resultSearchInput').value,'');assert.equal(h.$('#resultSearchInput').focused,true);assert.deepEqual(ids(h.$('#imageGrid').children),['food','review','scenery','failed']);
});
test('clearing the batch and beginning a valid restore reset ephemeral search state',async()=>{
  const h=harness({images:mixed(),resultSearchQuery:'trip',visibleLimit:120,lastReviewJumpId:'review'},['clearImages','beginWorkSessionRestore']);
  await h.ctx.clearImages();assert.equal(h.ctx.resultSearchQuery,'');assert.equal(h.ctx.visibleLimit,60);
  h.ctx.resultSearchQuery='again';h.ctx.visibleLimit=120;h.ctx.lastReviewJumpId='old';h.ctx.beginWorkSessionRestore({schemaVersion:1,categoryKeys:['food','scenery'],records:[]});assert.equal(h.ctx.resultSearchQuery,'');assert.equal(h.ctx.lastReviewJumpId,null);assert.equal(h.ctx.visibleLimit,60);
});
test('search is absent from work-session exports and leaves CSV/JSON rows unchanged',()=>{
  const images=mixed();const h=harness({images},['scoreForSession','makeWorkSession','exportRows']);const before=JSON.stringify(h.ctx.exportRows());h.ctx.resultSearchQuery='absent';assert.equal(JSON.stringify(h.ctx.exportRows()),before);const session=h.ctx.makeWorkSession();assert.equal(session.schemaVersion,1);assert.equal(session.records.length,images.length);assert.equal(Object.hasOwn(session,'resultSearchQuery'),false);assert.equal(Object.hasOwn(session,'search'),false);assert.equal(session.records[0].hasRelativePath,true);
});
test('search controls are labeled, localizable and wired without filename HTML interpolation',()=>{
  assert.match(html,/<label[^>]+for="resultSearchInput"/);assert.match(html,/<input[^>]+id="resultSearchInput"[^>]+type="search"/);assert.match(html,/id="resultSearchClearButton"[^>]+type="button"/);assert.match(html,/id="resultSearchCount"[^>]+(?:role="status"|aria-live="polite")/);assert.match(html,/\$\('#resultSearchInput'\)\.oninput=/);assert.match(html,/\$\('#resultSearchClearButton'\)\.onclick=clearResultSearch/);assert.match(html,/\$\('#resultSearchEmptyClearButton'\)\.onclick=clearResultSearch/);
  assert.match(sourceFunction('renderImageCard'),/name\.textContent=x\.file\.name/);assert.match(sourceFunction('renderFailedCard'),/name\.textContent=x\.file\.name/);
});

test('ZIP preserves whole-batch original bytes and collision names regardless of search',async()=>{
  const firstBytes=Uint8Array.from([1,2,3,4]),secondBytes=Uint8Array.from([9,8,7]);
  const images=[classified(file({size:4,arrayBuffer:async()=>firstBytes.buffer}),'a'),classified(file({webkitRelativePath:'other/photo.png',size:3,arrayBuffer:async()=>secondBytes.buffer}),'b'),entry(file({arrayBuffer:()=>{throw new Error('failed bytes must not be read')}}),'fail',{processingError:'decode'}),entry(file({arrayBuffer:()=>{throw new Error('pending bytes must not be read')}}),'pending')];
  const downloads=[];const h=harness({images,downloadBlob:(blob,name)=>downloads.push({blob,name})});
  const start=html.indexOf('const crcTable='),end=html.indexOf('const ACCURACY_TEST_CATEGORIES=',start);assert.ok(start>=0&&end>start);vm.runInContext(html.slice(start,end),h.ctx);
  await h.ctx.saveZip();h.ctx.resultSearchQuery='does not match';await h.ctx.saveZip();assert.equal(downloads.length,2);
  const before=Buffer.from(await downloads[0].blob.arrayBuffer()),after=Buffer.from(await downloads[1].blob.arrayBuffer());assert.deepEqual(after,before);
  let offset=0;const entries=[];while(before.readUInt32LE(offset)===0x04034b50){const bytes=before.readUInt32LE(offset+18),nameLength=before.readUInt16LE(offset+26),extraLength=before.readUInt16LE(offset+28),from=offset+30+nameLength+extraLength;entries.push({name:before.subarray(offset+30,offset+30+nameLength).toString(),bytes:before.subarray(from,from+bytes)});offset=from+bytes}
  assert.deepEqual(entries.map(x=>x.name),['food/photo.png','food/photo_2.png']);assert.deepEqual(entries[0].bytes,Buffer.from(firstBytes));assert.deepEqual(entries[1].bytes,Buffer.from(secondBytes));
  images[0].file.size=750*1024*1024;await h.ctx.saveZip();assert.equal(downloads.length,2);assert.ok(h.messages.some(m=>m.startsWith('zipTooLarge')));
});
test('CSV and JSON downloads keep all statuses even when no result matches search',async()=>{
  const downloads=[];const h=harness({images:mixed(),downloadBlob:(blob,name)=>downloads.push({blob,name})},['exportRows','csvEscape','saveCsv','saveJson']);
  h.ctx.saveCsv();h.ctx.saveJson();h.ctx.resultSearchQuery='absent';h.ctx.saveCsv();h.ctx.saveJson();assert.equal(downloads.length,4);assert.equal(await downloads[0].blob.text(),await downloads[2].blob.text());assert.equal(await downloads[1].blob.text(),await downloads[3].blob.text());
});
test('late review auto-advance does not override a changed query or category view',()=>{
  const callbacks=[];const images=[classified(file({name:'yes.png'}),'one',{review:true}),classified(file({name:'yes-two.png'}),'two',{review:true})];
  const h=viewHarness({images,filter:'__review__',resultSearchQuery:'yes',lastReviewJumpId:'one',requestAnimationFrame:fn=>callbacks.push(fn)});h.ctx.afterReviewDecision(true);h.ctx.setResultSearch('two');callbacks.shift()();assert.equal(h.ctx.lastReviewJumpId,null);
  h.ctx.afterReviewDecision(true);h.ctx.filter='food';callbacks.shift()();assert.equal(h.ctx.filter,'food');assert.equal(h.ctx.lastReviewJumpId,null);
});
test('restoring the original folders resolves previously ambiguous pathless records safely',()=>{
  const h=restore([legacyRecord(a),legacyRecord(b,'scenery')],[plain]);assert.equal(h.restored,0);h.ctx.images.push(entry(a,'a'),entry(b,'b'));assert.equal(h.ctx.restoreMatchingWorkRecords(),2);assert.equal(h.ctx.images[0].scores,null);assert.deepEqual(Array.from(h.ctx.images.slice(1),x=>x.manualCategoryId),['food','scenery']);assert.equal(h.ctx.workSessionPending,null);assert.equal(h.ctx.workSessionAmbiguousCount,0);
});
test('translation keys, static IDs, CSP and application JavaScript stay valid',()=>{
  const start=html.indexOf('const translations='),end=html.indexOf('let language=',start);assert.ok(start>=0&&end>start);
  const ctx=vm.createContext({});vm.runInContext(html.slice(start,end)+';globalThis.i18n=translations;',ctx);assert.deepEqual(Object.keys(ctx.i18n.ja).sort(),Object.keys(ctx.i18n.en).sort());
  for(const lang of ['ja','en'])for(const key of ['resultSearchLabel','resultSearchPlaceholder','resultSearchClear','resultSearchHelp','resultSearchCount','resultSearchNoMatches','workSessionAmbiguous'])assert.ok(ctx.i18n[lang][key]);
  const markup=html.slice(0,html.indexOf('<script>'));const ids=[...markup.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
  const csp=/<meta[^>]+http-equiv="Content-Security-Policy"[^>]+content="([^"]+)"/.exec(markup)?.[1];assert.ok(csp);assert.match(csp,/connect-src blob:/);assert.match(csp,/'wasm-unsafe-eval'/);assert.doesNotMatch(csp,/connect-src[^;]*(?:https?:|\*)/);
  const placeholders=['__APP_CONFIG_JSON__','__BUILD_MANIFEST_JSON__','__EMBEDDED_ASSET_BUNDLE_JSON__','__FIXED_CATEGORY_CATALOG_JSON__','__ACCURACY_REGRESSION_CONFIG_JSON__'];
  let script=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>'));
  for(const placeholder of placeholders) {if(process.env.SORTER_HTML)assert.ok(!html.includes(placeholder),placeholder);script=script.replaceAll(placeholder,'{}')}
  new vm.Script(script);
});

// Native focus transfer/blur and click bubbling are modeled here; layout and real
// download navigation remain browser QA. Production handlers run unchanged.
function bootApp({retainInvalidFocus=false,retainClosedDetailsRects=false}={}) {
  const nodes=new Map(),staticNodes=[],documentListeners=new Map(),downloads=[],nativeFocusUpdates=[];
  const document={documentElement:{},activeElement:null,
    addEventListener(type,fn){if(!documentListeners.has(type))documentListeners.set(type,[]);documentListeners.get(type).push(fn)},
    dispatch(type,event){for(const fn of documentListeners.get(type)||[])fn(event)}};
  function createElement(tag) {
    const node=element(tag),listeners=new Map();node.isConnected=true;node.parentElement=null;
    node.contains=other=>{for(let at=other;at;at=at.parentElement)if(at===node)return true;return false};
    node.getClientRects=()=>{
      if(!node.isConnected)return[];
      for(let at=node;at;at=at.parentElement){
        if(at.hidden||at.tagName==='DIALOG'&&!at.open)return[];
        if(!retainClosedDetailsRects&&at.tagName==='DETAILS'&&!at.open&&at!==node&&node!==at.children.find(x=>x.tagName==='SUMMARY'))return[];
      }
      return[{}];
    };
    node.focus=()=>{if(!node.disabled&&node.getClientRects().length){node.focused=true;document.activeElement=node}};
    for(const key of ['disabled','hidden','open']) {
      let value=false;Object.defineProperty(node,key,{get:()=>value,set(next){value=next;
        if(key==='open'&&!next&&node.tagName==='DETAILS'&&retainClosedDetailsRects&&!retainInvalidFocus){
          const previous=document.activeElement;
          if(node.contains(previous)&&previous!==node.querySelector('summary'))nativeFocusUpdates.push(()=>{if(document.activeElement===previous)document.activeElement=document.body});
        }
        if(!retainInvalidFocus&&node.contains(document.activeElement)&&
          (node.disabled||!document.activeElement.getClientRects().length))document.activeElement=document.body;
      }});
    }
    node.append=(...children)=>{for(const child of children){child.parentElement=node;child.isConnected=true;node.children.push(child)}};
    node.replaceChildren=(...children)=>{for(const child of node.children){if(child.contains?.(document.activeElement)&&!retainInvalidFocus)document.activeElement=document.body;child.parentElement=null;child.isConnected=false}node.children=[];node.append(...children)};
    node.addEventListener=(type,fn)=>{if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn)};
    node.dispatch=(type,event={})=>{for(const fn of listeners.get(type)||[])fn(event)};
    node.showModal=()=>{node.returnFocus=document.activeElement;node.open=true;(node.children.flatMap(x=>x.children).find(x=>x.tagName==='BUTTON')||node).focus()};
    node.close=()=>{node.open=false;node.returnFocus?.focus();node.dispatch('close')};
    node.querySelector=selector=>selector==='summary'?node.children.find(x=>x.tagName==='SUMMARY')||null:null;
    node.click=()=>{const result=node.onclick?.({target:node,stopPropagation:noop});if(node.tagName==='A')downloads.push(node);document.dispatch('click',{target:node});return result};
    node.remove=()=>{node.isConnected=false;if(document.activeElement===node)document.activeElement=document.body};
    return node;
  }
  document.createElement=createElement;
  const markup=html.slice(0,html.indexOf('<script>')),stack=[];
  for(const match of markup.matchAll(/<(\/?)([a-z][a-z0-9-]*)\b([^>]*)>/gi)) {
    const [,closing,tag,attributes]=match;
    if(closing){while(stack.length&&stack.pop().tagName!==tag.toUpperCase()){}continue}
    const node=createElement(tag);for(const attribute of attributes.matchAll(/([\w-]+)="([^"]*)"/g)) {const [,name,value]=attribute;node.attributes[name]=value;if(name==='id')nodes.set('#'+value,node);if(name.startsWith('data-'))node.dataset[name.slice(5).replace(/-([a-z])/g,(_,x)=>x.toUpperCase())]=value}
    if(tag==='body'){document.body=node;document.activeElement=node}
    if(stack.length)stack.at(-1).append(node);
    staticNodes.push(node);
    if(!/\/$/.test(attributes)&&!['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'].includes(tag))stack.push(node);
  }
  const $=selector=>{
    if(selector==='dialog[open]')return staticNodes.find(x=>x.tagName==='DIALOG'&&x.open)||null;
    if(selector==='.export-more')return staticNodes.find(x=>x.tagName==='DETAILS'&&x.attributes.class==='export-more')||null;
    if(selector==='.export-more>summary')return $('.export-more').querySelector('summary');
    if(!nodes.has(selector))nodes.set(selector,createElement('div'));return nodes.get(selector);
  };
  const $$=selector=>{const attr=/^\[([\w-]+)\]$/.exec(selector)?.[1];return attr?staticNodes.filter(x=>Object.hasOwn(x.attributes,attr)):[]};
  document.querySelector=$;document.querySelectorAll=$$;
  const saved=new Map();let requestedAssets=0;
  const context=vm.createContext({console,Blob,TextEncoder,TextDecoder,URL,Uint8Array,Uint32Array,DataView,Date,Math,JSON,Number,Set,Map,Array,Object,String,Boolean,URLSearchParams,
    document,
    window:{addEventListener:noop,scrollTo:noop,fetch:()=>{requestedAssets++;throw new Error('No runtime network in test')}},
    localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value),removeItem:key=>saved.delete(key)},
    navigator:{language:'en'},location:{hash:'',search:''},requestAnimationFrame:fn=>fn(),setTimeout:()=>1,clearTimeout:noop,CSS:{escape:x=>x},innerWidth:375});
  let script=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>'));
  const replacements={__APP_CONFIG_JSON__:JSON.stringify(JSON.parse(fs.readFileSync(path.join(root,'app.config.json')))),__BUILD_MANIFEST_JSON__:'{}',__EMBEDDED_ASSET_BUNDLE_JSON__:'{}',__FIXED_CATEGORY_CATALOG_JSON__:JSON.stringify({categories:categoryDefs}),__ACCURACY_REGRESSION_CONFIG_JSON__:fs.readFileSync(path.join(root,'tests/accuracy/regression-config.json'),'utf8')};
  for(const [key,value] of Object.entries(replacements))script=script.replaceAll(key,value);
  script=script.replace(/const assetBundle=[^\n]+;/,'const assetBundle={};');
  const close=script.lastIndexOf('})();');assert.ok(close>0);
  script=script.slice(0,close)+`globalThis.testApi={setImages(value){images=value},getQuery(){return resultSearchQuery},getFilter(){return filter},getImages(){return images},renderResults,beginWorkSessionRestore,makeWorkSession};`+script.slice(close);
  vm.runInContext(script,context);return{ctx:context,api:context.testApi,$,document,downloads,finishNativeFocusUpdates(){for(const update of nativeFocusUpdates.splice(0))update()},requestedAssets:()=>requestedAssets};
}
test('full app event wiring preserves typed search through EN/JA switching and Clear',()=>{
  const h=bootApp();h.api.setImages(mixed());h.api.renderResults();const input=h.$('#resultSearchInput');input.value='旅行';input.oninput({target:input});assert.equal(h.api.getQuery(),'旅行');assert.equal(h.$('#imageGrid').children.length,1);assert.equal(h.$('#resultSearchCount').textContent,'1 matching results');
  h.$('#languageButton').onclick();assert.equal(h.api.getQuery(),'旅行');assert.equal(input.value,'旅行');assert.equal(h.$('#resultSearchCount').textContent,'一致する結果: 1枚');assert.equal(h.$('#resultSearchClearButton').textContent,'検索をクリア');
  h.$('#resultSearchClearButton').onclick();assert.equal(h.api.getQuery(),'');assert.equal(input.focused,true);assert.equal(h.$('#imageGrid').children.length,4);assert.equal(h.requestedAssets(),0);
});
test('full app keeps a localized ambiguity notice while waiting for the original folder',()=>{
  const h=bootApp();h.api.setImages([entry(plain)]);h.api.beginWorkSessionRestore({schemaVersion:1,categoryKeys:['food','scenery'],records:[legacyRecord(a),legacyRecord(b,'scenery')]});assert.match(h.$('#workSessionRestoreCopy').textContent,/Reselect the original folder/);assert.equal(h.$('#restoreChooseFolderButton').hidden,false);
  h.$('#languageButton').onclick();assert.match(h.$('#workSessionRestoreCopy').textContent,/元のフォルダを選び直して/);assert.equal(h.api.getImages()[0].scores,null);assert.equal(h.requestedAssets(),0);
});

test('an older review callback cannot skip past a newer manual navigation',()=>{
  const callbacks=[];const images=['one','two','three'].map(id=>classified(file({name:`yes-${id}.png`}),id,{review:true}));
  const h=viewHarness({images,filter:'__review__',resultSearchQuery:'yes',lastReviewJumpId:'one',requestAnimationFrame:fn=>callbacks.push(fn)});images[0].manualCategoryId='food';h.ctx.afterReviewDecision(true);h.ctx.jumpToNextReview();assert.equal(h.ctx.lastReviewJumpId,'two');callbacks.shift()();assert.equal(h.ctx.lastReviewJumpId,'two');
});
test('an older review callback cannot undo a query reset even if the query returns to the same value',()=>{
  const callbacks=[];const images=['one','two'].map(id=>classified(file({name:`yes-${id}.png`}),id,{review:true}));
  const h=viewHarness({images,filter:'__review__',resultSearchQuery:'yes',requestAnimationFrame:fn=>callbacks.push(fn)});h.ctx.afterReviewDecision(true);h.ctx.setResultSearch('absent');h.ctx.setResultSearch('yes');callbacks.shift()();assert.equal(h.ctx.lastReviewJumpId,null);
});


function assertFocus(h,expected,message='focus target') {assert.ok(h.document.activeElement===expected,`${message}: expected ${expected?.attributes.id||expected?.tagName}, got ${h.document.activeElement?.attributes.id||h.document.activeElement?.tagName}`)}
function selectedBulkApp(options) {
  const h=bootApp(options);h.api.setImages(mixed().slice(0,2));h.api.renderResults();
  h.$('#selectVisibleButton').click();const select=h.$('#bulkCategorySelect');select.value='document';select.onchange();
  h.$('#bulkApplyButton').focus();return h;
}
test('actual bulk-confirm completion leaves focus on Select visible after Apply becomes disabled',async()=>{
  for(const retainInvalidFocus of [false,true]) {
    const h=selectedBulkApp({retainInvalidFocus}),pending=h.$('#bulkApplyButton').click();
    assert.equal(h.$('#confirmDialog').open,true);h.$('#confirmOk').focus();h.$('#confirmOk').click();await pending;
    assertFocus(h,h.$('#selectVisibleButton'));
    assert.equal(h.$('#bulkApplyButton').disabled,true);assert.equal(h.$('#bulkCategorySelect').value,'document');
    assert.deepEqual(Array.from(h.api.getImages(),x=>x.manualCategoryId),['document','document']);
    assert.equal(h.api.getQuery(),'');assert.equal(h.api.getFilter(),'all');assert.equal(h.requestedAssets(),0);
  }
});
test('bulk cancellation and native Escape keep selection, values, and opener focus',async()=>{
  for(const cancel of ['#confirmCancel','#confirmClose','escape']) {
    const h=selectedBulkApp(),before=JSON.stringify(h.api.getImages()),pending=h.$('#bulkApplyButton').click();
    if(cancel==='escape')h.$('#confirmDialog').dispatch('cancel',{preventDefault:noop});else h.$(cancel).click();await pending;
    assertFocus(h,h.$('#bulkApplyButton'));assert.equal(h.$('#bulkApplyButton').disabled,false);
    assert.equal(h.$('#selectionCount').textContent,'2 selected');assert.equal(h.$('#bulkCategorySelect').value,'document');assert.equal(JSON.stringify(h.api.getImages()),before);
  }
});
test('bulk completion preserves newer modal focus, valid input focus, and unavailable fallback controls',async()=>{
  for(const next of ['modal','modal with body focus','input','disabled fallback','hidden fallback','hidden results panel','removed fallback']) {
    const h=selectedBulkApp(),pending=h.$('#bulkApplyButton').click();h.$('#confirmOk').click();
    let expected=h.document.body;
    if(next.startsWith('modal')){h.$('#helpButton').click();h.$('#closeHelpButton').focus();expected=h.$('#closeHelpButton');if(next==='modal with body focus'){h.document.activeElement=h.document.body;expected=h.document.body}}
    if(next==='input'){h.$('#resultSearchInput').value='keep this';h.$('#resultSearchInput').focus();expected=h.$('#resultSearchInput')}
    if(next==='disabled fallback')h.$('#selectVisibleButton').disabled=true;
    if(next==='hidden fallback')h.$('#selectVisibleButton').hidden=true;
    if(next==='hidden results panel')h.$('#resultContent').parentElement.hidden=true;
    if(next==='removed fallback')h.$('#selectVisibleButton').isConnected=false;
    await pending;assertFocus(h,expected,next);
    if(next==='input')assert.equal(h.$('#resultSearchInput').value,'keep this');
    if(next.startsWith('modal'))assert.equal(h.$('#helpDialog').open,true);
    assert.equal(h.$('#bulkApplyButton').disabled,true);
  }
});
for(const id of ['csvButton','jsonButton']) {
  test(`actual ${id} download closes More and focuses its visible summary`,()=>{
    for(const retainInvalidFocus of [false,true]) {
      const h=selectedBulkApp({retainInvalidFocus}),more=h.$('.export-more');more.open=true;h.$('#'+id).focus();
      h.$('#'+id).click();assert.equal(more.open,false);assertFocus(h,more.querySelector('summary'));
      assert.equal(h.downloads.length,1);assert.equal(h.downloads[0].download,`smart-image-sorter.${id==='csvButton'?'csv':'json'}`);assert.equal(h.requestedAssets(),0);
    }
  });
  test(`actual ${id} download does not steal newer modal or unrelated focus`,()=>{
    for(const retainClosedDetailsRects of [false,true])for(const next of ['modal','modal with body focus','input','disabled fallback','hidden fallback','removed fallback']) {
      const h=selectedBulkApp({retainClosedDetailsRects}),more=h.$('.export-more');more.open=true;h.$('#'+id).focus();let expected=h.document.body;
      h.document.addEventListener('click',event=>{
        if(event.target.tagName!=='A')return;
        if(next.startsWith('modal')){h.$('#helpButton').onclick();h.$('#closeHelpButton').focus();expected=h.$('#closeHelpButton');if(next==='modal with body focus'){h.document.activeElement=h.document.body;expected=h.document.body}}
        if(next==='input'){h.$('#resultSearchInput').focus();expected=h.$('#resultSearchInput')}
        if(next==='disabled fallback')more.querySelector('summary').disabled=true;
        if(next==='hidden fallback')more.hidden=true;
        if(next==='removed fallback')more.querySelector('summary').isConnected=false;
      });
      h.$('#'+id).click();h.finishNativeFocusUpdates();assertFocus(h,expected,next);assert.equal(h.downloads.length,1);
    }
  });
}
test('actual EN/JA language switching localizes the bulk destination accessible name without changing its selection',()=>{
  const h=selectedBulkApp(),select=h.$('#bulkCategorySelect');
  for(const expected of ['Bulk destination','一括変更先','Bulk destination','一括変更先']) {
    assert.equal(select.getAttribute('aria-label'),expected);assert.equal(select.value,'document');assert.equal(h.$('#selectionCount').textContent.startsWith('2'),true);
    h.$('#languageButton').click();
  }
});

test('bulk completion recovers dialog-owned or detached-opener focus after the native close',async()=>{
  for(const next of ['dialog','removed opener']) {
    const h=selectedBulkApp({retainInvalidFocus:true}),pending=h.$('#bulkApplyButton').click();h.$('#confirmOk').click();
    if(next==='dialog')h.document.activeElement=h.$('#confirmOk');else h.$('#bulkApplyButton').isConnected=false;
    await pending;assertFocus(h,h.$('#selectVisibleButton'),next);
  }
});
test('repeated exports and bulk confirmations keep keyboard continuation available',async()=>{
  const h=selectedBulkApp();
  for(let i=0;i<2;i++) {
    h.$('#selectVisibleButton').click();h.$('#bulkApplyButton').focus();const pending=h.$('#bulkApplyButton').click();h.$('#confirmOk').click();await pending;
    assertFocus(h,h.$('#selectVisibleButton'));
    for(const id of ['csvButton','jsonButton']){h.$('.export-more').open=true;h.$('#'+id).focus();h.$('#'+id).click();assertFocus(h,h.$('.export-more').querySelector('summary'))}
  }
  assert.equal(h.downloads.length,4);assert.equal(h.$('#selectionCount').textContent,'0 selected');
});

test('all publishing workflows run Results regressions against the generated standalone HTML',()=>{
  for(const name of ['build-standalone.yml','deploy-pages.yml','preview.yml']) {
    const original=fs.readFileSync(path.join(root,'.github/workflows',name),'utf8');
    for(const newline of ['\n','\r\n']) {
    const yaml=original.replace(/\r?\n/g,newline);
    assert.match(yaml.replace(/\r\n/g,'\n'),/node \.\/tests\/help-dialog\.test\.cjs[^\n]*\n\s+if \(\$LASTEXITCODE -ne 0\)[^\n]*\n\s+\$env:SORTER_HTML = '\.\/dist\/index\.html'\n\s+node --test \.\/tests\/result-workflow\.test\.cjs\n\s+if \(\$LASTEXITCODE -ne 0\) \{ throw "Results workflow regression failed\." \}\n\s+Remove-Item Env:SORTER_HTML/,`${name}: ${JSON.stringify(newline)}`);
    }
  }
});

// Native Chromium QA showed closed More children keep nonzero layout rects;
// focus cleanup can follow the download click rather than the open=false write.
for(const id of ['csvButton','jsonButton']) {
  test(`actual ${id} restores closed-More ownership even while its hidden button retains layout rects`,()=>{
    for(const retainInvalidFocus of [false,true]) {
      const h=selectedBulkApp({retainInvalidFocus,retainClosedDetailsRects:true}),more=h.$('.export-more'),opener=h.$('#'+id);
      more.open=true;opener.focus();opener.click();
      assert.equal(more.open,false);assert.equal(opener.getClientRects().length,1);
      h.finishNativeFocusUpdates();assertFocus(h,more.querySelector('summary'));
      assert.equal(h.downloads.length,1);assert.equal(more.open,false);
    }
  });
}
