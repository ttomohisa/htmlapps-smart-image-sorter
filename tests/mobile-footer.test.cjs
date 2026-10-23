const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/index.template.html'),'utf8');
test('main informational footer hides in existing smartphone layouts',()=>assert.ok(source.includes("@media (max-width:700px) { body > footer { display: none; } }")));
test('existing lower version is final Help metadata',()=>{const help=source.match(/<dialog id="helpDialog"[^>]*>([\s\S]*?)<\/dialog>/)[1];assert.match(help,/<p class="dialog-note">Smart Image Sorter · <span id="footerVersion">v1.0.5<\/span><\/p><\/div>$/);assert.equal((source.match(/id="footerVersion"/g)||[]).length,1);assert.doesNotMatch(source.match(/<footer>(.*?)<\/footer>/)[1],/footerVersion/);});
