const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(process.env.SORTER_HTML||'src/index.template.html','utf8');
function fn(name){const at=new RegExp('^\\s*(?:async )?function '+name+'\\(','m').exec(source);assert.ok(at,name);let out='';for(const line of source.slice(at.index).trimStart().split('\n')){out+=line+'\n';try{new vm.Script('('+out+')');return out}catch{}}throw Error(name);}
test('failed autosave keeps work and an explicit error rather than old saved success',()=>{
 const c=vm.createContext({images:[{id:'image'}],workSessionPending:null,workSessionAutosaveSuppressed:false,workSessionSavedAtLoad:{savedAt:'old'},workSessionSaveState:'dirty',makeWorkSession:()=>({records:[{name:'photo'}]}),localStorage:{setItem(){throw Error('quota')}},WORK_SESSION_STORAGE_KEY:'work',updateWorkSessionUi(){},toast(){},tr:k=>k,console:{warn(){}}});
 vm.runInContext(fn('writeLocalWorkSession'),c);c.writeLocalWorkSession();assert.equal(c.workSessionSaveState,'error');assert.equal(c.workSessionSavedAtLoad.savedAt,'old');assert.equal(c.images.length,1);
});
test('cancelled saved-session deletion leaves stored and current work untouched',async()=>{
 let removed=false;const c=vm.createContext({images:[{id:'image'}],confirmBox:async()=>false,tr:k=>k,localStorage:{removeItem(){removed=true}},WORK_SESSION_STORAGE_KEY:'work',workSessionPending:null,workSessionSavedAtLoad:{savedAt:'old'},workSessionRestoredIds:new Set(),workSessionRestoredRecordIndexes:new Set(),workSessionAmbiguousCount:0,workSessionSaveTimer:1,clearTimeout(){},updateWorkSessionUi(){},toast(){}});
 vm.runInContext(fn('deleteLocalWorkSession'),c);await c.deleteLocalWorkSession(true);assert.equal(removed,false);assert.equal(c.images.length,1);assert.equal(c.workSessionSavedAtLoad.savedAt,'old');
});
test('classification cannot commit an embedding completed after a generation boundary',async()=>{
 const el=()=>({hidden:false,disabled:false,style:{},querySelector:()=>null,setAttribute(){},removeAttribute(){}}),nodes=new Map(),$=k=>{if(!nodes.has(k))nodes.set(k,el());return nodes.get(k)};
 let release;const pending=new Promise(r=>release=r),image={file:{name:'photo'},scores:null};
 const c=vm.createContext({$,images:[image],classificationGeneration:0,classificationBusy:false,classificationCancelRequested:false,classificationDirty:false,activeCategoryDefs:()=>[{},{}],loadModels:async()=>({}),getTextTermEmbeddings:async()=>({}),getImageEmbedding:()=>pending,rankFromEmbedding:()=>[{categoryId:'food'}],reviewStateForRanking:()=>({review:false}),clearProcessingFailure(){},updateRuntime(){},tr:k=>k,toast(){},renderResults(){},updateClassifyButton(){},updateReclassifyNote(){},scheduleWorkSessionSave(){},DOMException,console:{warn(){},error(){}},innerWidth:1000,setTimeout:f=>f(),language:'en',BrowserKittyUI:{setButtonState(){},text:k=>k}});
 vm.runInContext(fn('runClassification'),c);const run=c.runClassification();await new Promise(r=>setImmediate(r));c.classificationGeneration++;release({vector:[]});await run;assert.equal(image.scores,null);
});
test('invalid developer review import preserves every existing decision',async()=>{
 const decisions={existing:{reviewed:true}},c=vm.createContext({accuracyReviewDecisions:decisions,ACCURACY_CATEGORY_KEYS:new Set(['food']),saveAccuracyReviewDecisions(){},markAccuracyReportStale(){},updateAccuracyDatasetSummary(){},renderAccuracyReview(){},toast(){},tr:k=>k,confirmBox:async()=>true,console:{error(){}}});
 vm.runInContext(fn('importAccuracyReviewFile'),c);await c.importAccuracyReviewFile({text:async()=>JSON.stringify({schemaVersion:1,decisions:[{fileKey:'new',reviewed:true},null]})});
 assert.deepEqual(decisions,{existing:{reviewed:true}});
});
test('benchmark controls use the full collection and release busy after model failure',async()=>{
 const buttons=[{},{},{}],rows=[],node=()=>({hidden:false,textContent:'',prepend:x=>rows.push(x)}),nodes=new Map(),$=k=>{if(!nodes.has(k))nodes.set(k,node());return nodes.get(k)};
 const c=vm.createContext({benchmarkBusy:false,accuracyBusy:false,accuracyFiles:[{}],benchmarkCancelRequested:false,$,$$:()=>buttons,document:{createElement:()=>node()},BrowserKittyUI:{setButtonState:(button,state)=>button.state=state},performance:{now:()=>0},memoryMB:()=>null,loadModels:async()=>{throw Error('controlled model failure')},console:{error(){}},tr:k=>k,toast(){}});
 vm.runInContext(fn('runBenchmark'),c);await c.runBenchmark(1);assert.equal(c.benchmarkBusy,false);assert.equal($('#benchmarkCancelButton').hidden,true);assert.ok(buttons.every(button=>button.state==='ready'));assert.equal(rows[0].textContent,'benchmarkFailed');
});
test('ZIP read failure keeps a keyed persistent recovery state without raw transient copy',async()=>{
 const node=()=>({hidden:false,textContent:'',querySelector:()=>({textContent:'Save ZIP'})}),nodes=new Map(),$=k=>{if(!nodes.has(k))nodes.set(k,node());return nodes.get(k)};const messages=[];let rendered=0,handoffs=0;
 const image={scores:[{}],file:{name:'photo.jpg',size:10,arrayBuffer:async()=>{throw Error('read failed')}}},c=vm.createContext({zipBusy:false,classificationDirty:false,outputFailed:false,images:[image],outputName:()=> 'edited.zip',categoryLabel:()=> 'Food',effectiveCategory:()=> 'food',$,BrowserKittyUI:{setButtonState(){}},tr:k=>k,toast:message=>messages.push(message),console:{error(){}},reserveUniqueZipPath:()=> 'Food/photo.jpg',TextEncoder,Uint8Array,DataView,Set,downloadBlob(){handoffs++},renderOutputStatus(){rendered++}});
 vm.runInContext(fn('saveZip'),c);await c.saveZip();assert.equal(c.outputFailed,true);assert.equal(rendered,1);assert.equal(c.zipBusy,false);assert.equal(handoffs,0);assert.deepEqual(messages,[]);assert.equal(c.images[0],image);
});
