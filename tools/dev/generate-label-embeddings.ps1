param(
  [switch]$Force
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$defsPath = Join-Path $root 'data\fixed-label-prototypes.json'
$outPath = Join-Path $root 'data\fixed-label-embeddings.tinyclip-int8.generated.json'
$modelRoot = Join-Path $root 'models\TinyCLIP-ViT-8M-16-Text-3M-YFCC15M-ONNX'
$runtimeRoot = Join-Path $root 'vendor\transformers'
$tempHtml = Join-Path ([IO.Path]::GetTempPath()) ('smart-image-sorter-label-gen-' + [guid]::NewGuid().ToString('n') + '.html')
$modelId = 'TinyCLIP-ViT-8M-16-Text-3M-YFCC15M-ONNX'

function Get-Sha256([string]$Path) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try { $s=[IO.File]::OpenRead($Path); try{$h=$sha.ComputeHash($s)}finally{$s.Dispose()}; return([BitConverter]::ToString($h)).Replace('-','').ToLowerInvariant() } finally { $sha.Dispose() }
}
function Assert-RealFile([string]$Path,[long]$MinBytes=1) {
  if (-not (Test-Path $Path)) { throw "Missing asset: $Path`nRun setup-assets.bat first." }
  $info = Get-Item $Path
  if ($info.Length -lt $MinBytes) { throw "Asset is unexpectedly small: $Path ($($info.Length) bytes). Run setup-assets.bat again." }
  $fs=[IO.File]::OpenRead($Path)
  try { $buf=New-Object byte[] 160; $n=$fs.Read($buf,0,$buf.Length); $first=[Text.Encoding]::UTF8.GetString($buf,0,$n) } finally { $fs.Dispose() }
  if ($first.StartsWith('version https://git-lfs.github.com/spec/v1')) { throw "Git LFS pointer is not materialized: $Path`nRun setup-assets.bat or git lfs pull." }
}
function Encode-Asset([string]$Path,[string]$Mime,[string]$Compression='auto') {
  $raw=[IO.File]::ReadAllBytes($Path); $stored=$raw; $kind='none'
  $shouldTry = $Compression -eq 'gzip' -or $Compression -eq 'auto'
  if($shouldTry) {
    $ms=[IO.MemoryStream]::new()
    $gz=[IO.Compression.GZipStream]::new($ms,[IO.Compression.CompressionLevel]::Optimal,$true)
    try{$gz.Write($raw,0,$raw.Length)}finally{$gz.Dispose()}
    $candidate=$ms.ToArray();$ms.Dispose()
    if($Compression -eq 'gzip' -or $candidate.Length -lt [int]($raw.Length*0.98)){$stored=$candidate;$kind='gzip'}
  }
  return [ordered]@{mime=$Mime;compression=$kind;originalBytes=$raw.Length;storedBytes=$stored.Length;sha256=(Get-Sha256 $Path);base64=[Convert]::ToBase64String($stored)}
}
function Find-Browser {
  foreach ($cmd in @('msedge','chrome','google-chrome','chromium','chromium-browser')) {
    $c = Get-Command $cmd -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
  }
  foreach ($path in @(
    "$Env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$Env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe",
    "$Env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "$Env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe"
  )) { if (Test-Path $path) { return $path } }
  throw 'Could not find Microsoft Edge or Google Chrome for headless label-embedding generation.'
}

Assert-RealFile $defsPath 256
$defsParsed = Get-Content -Raw -Encoding UTF8 $defsPath | ConvertFrom-Json -ErrorAction Stop
$expectedCategories = @($defsParsed.categories).Count
if ($expectedCategories -lt 2) { throw 'At least two fixed categories are required.' }
$keys = @($defsParsed.categories | ForEach-Object { $_.key })
if (($keys | Sort-Object -Unique).Count -ne $keys.Count) { throw 'fixed-label-prototypes.json contains duplicate category keys.' }
foreach ($category in $defsParsed.categories) {
  if (-not $category.key -or -not $category.ja -or -not $category.en) { throw 'Every category needs key, ja, and en.' }
  if (-not $category.prototypes -or @($category.prototypes).Count -lt 1) { throw "Category '$($category.key)' needs at least one prototype prompt." }
}

if ((-not $Force) -and (Test-Path $outPath)) {
  $outInfo = Get-Item $outPath
  $defsInfo = Get-Item $defsPath
  if ($outInfo.Length -gt 1024 -and $outInfo.LastWriteTimeUtc -ge $defsInfo.LastWriteTimeUtc) {
    try {
      $existing = Get-Content -Raw -Encoding UTF8 $outPath | ConvertFrom-Json -ErrorAction Stop
      if (@($existing.categories).Count -eq $expectedCategories) {
        Write-Host "[skip] $(Split-Path -Leaf $outPath)" -ForegroundColor Yellow
        Write-Host $outPath
        exit 0
      }
    } catch {}
  }
}

foreach($p in @(
  (Join-Path $runtimeRoot 'transformers.min.js'),
  (Join-Path $runtimeRoot 'ort-wasm-simd-threaded.mjs'),
  (Join-Path $runtimeRoot 'ort-wasm-simd-threaded.wasm'),
  (Join-Path $modelRoot 'config.json'),
  (Join-Path $modelRoot 'preprocessor_config.json'),
  (Join-Path $modelRoot 'tokenizer.json'),
  (Join-Path $modelRoot 'tokenizer_config.json'),
  (Join-Path $modelRoot 'special_tokens_map.json'),
  (Join-Path $modelRoot 'merges.txt'),
  (Join-Path $modelRoot 'vocab.json')
)) { Assert-RealFile $p 32 }
Assert-RealFile (Join-Path $modelRoot 'onnx\model_quantized.onnx') 1MB

$bundle=[ordered]@{schemaVersion=1;dependencies=[ordered]@{
  runtime=[ordered]@{assets=[ordered]@{
    transformers=(Encode-Asset (Join-Path $runtimeRoot 'transformers.min.js') 'text/javascript' 'auto')
    'ort-mjs'=(Encode-Asset (Join-Path $runtimeRoot 'ort-wasm-simd-threaded.mjs') 'text/javascript' 'auto')
    'ort-wasm'=(Encode-Asset (Join-Path $runtimeRoot 'ort-wasm-simd-threaded.wasm') 'application/wasm' 'gzip')
  }}
  model=[ordered]@{assets=[ordered]@{
    config=(Encode-Asset (Join-Path $modelRoot 'config.json') 'application/json' 'auto')
    preprocessor=(Encode-Asset (Join-Path $modelRoot 'preprocessor_config.json') 'application/json' 'auto')
    tokenizer=(Encode-Asset (Join-Path $modelRoot 'tokenizer.json') 'application/json' 'auto')
    'tokenizer-config'=(Encode-Asset (Join-Path $modelRoot 'tokenizer_config.json') 'application/json' 'auto')
    'special-tokens'=(Encode-Asset (Join-Path $modelRoot 'special_tokens_map.json') 'application/json' 'auto')
    merges=(Encode-Asset (Join-Path $modelRoot 'merges.txt') 'text/plain' 'auto')
    vocab=(Encode-Asset (Join-Path $modelRoot 'vocab.json') 'application/json' 'auto')
    'model-file'=(Encode-Asset (Join-Path $modelRoot 'onnx\model_quantized.onnx') 'application/octet-stream' 'gzip')
  }}
}}
$defsJson = Get-Content -Raw -Encoding UTF8 $defsPath
$bundleJson = $bundle | ConvertTo-Json -Depth 30 -Compress
$contextJson = ([ordered]@{modelId=$modelId} | ConvertTo-Json -Compress)

$helperTemplate = @'
<!doctype html>
<html><head><meta charset="utf-8"><title>Generate fixed label embeddings</title></head>
<body><pre id="output">running...</pre>
<script>
const FIXED_CATEGORY_DEFS = __DEFS_JSON__;
const EMBEDDED_ASSET_BUNDLE = __BUNDLE_JSON__;
const EMBED_CONTEXT = __CONTEXT_JSON__;
const bytesCache=new Map(),blobUrlCache=new Map();
const StandaloneAssets={
  root:EMBEDDED_ASSET_BUNDLE,
  entry(id,key){const dep=this.root.dependencies?.[id];if(!dep||!dep.assets||!dep.assets[key])throw new Error(`Missing embedded asset: ${id}/${key}`);return dep.assets[key]},
  decodeBase64(b){const bin=atob(b),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u},
  async bytes(id,key){const k=`${id}/${key}`;if(bytesCache.has(k))return bytesCache.get(k);const e=this.entry(id,key);let u=this.decodeBase64(e.base64);if(e.compression==='gzip'){const ds=new DecompressionStream('gzip');const stream=new Blob([u]).stream().pipeThrough(ds);u=new Uint8Array(await new Response(stream).arrayBuffer())}bytesCache.set(k,u);return u},
  async blobUrl(id,key){const k=`${id}/${key}`;if(blobUrlCache.has(k))return blobUrlCache.get(k);const e=this.entry(id,key);const url=URL.createObjectURL(new Blob([await this.bytes(id,key)],{type:e.mime||'application/octet-stream'}));blobUrlCache.set(k,url);return url},
  async importModule(id,key){return import(await this.blobUrl(id,key))}
};
function normalize(v){let s=0;for(const x of v)s+=x*x;const d=Math.sqrt(s)||1;return v.map(x=>Number((x/d).toFixed(8)))}
async function installEmbeddedFetch(){
  const nativeFetch=globalThis.fetch.bind(globalThis);
  const base=`https://smart-image-sorter.invalid/models/${EMBED_CONTEXT.modelId}/`;
  const map=(url)=>{
    if(!url.startsWith(base))return null;
    const path=url.slice(base.length).split('?')[0].replace(/^\/+/, '');
    if(path==='config.json')return['model','config','application/json'];
    if(path==='preprocessor_config.json')return['model','preprocessor','application/json'];
    if(path==='tokenizer.json')return['model','tokenizer','application/json'];
    if(path==='tokenizer_config.json')return['model','tokenizer-config','application/json'];
    if(path==='special_tokens_map.json')return['model','special-tokens','application/json'];
    if(path==='merges.txt')return['model','merges','text/plain'];
    if(path==='vocab.json')return['model','vocab','application/json'];
    if(/^onnx\/model_quantized\.onnx$/i.test(path))return['model','model-file','application/octet-stream'];
    return null;
  };
  globalThis.fetch=async(input,init)=>{
    const url=typeof input==='string'?input:(input instanceof Request?input.url:String(input));
    const spec=map(url);
    if(!spec)return nativeFetch(input,init);
    const [id,key,mime]=spec;
    return new Response(await StandaloneAssets.bytes(id,key),{status:200,headers:{'content-type':mime,'cache-control':'no-store'}})
  };
}
(async()=>{
  try{
    await installEmbeddedFetch();
    const hf=await StandaloneAssets.importModule('runtime','transformers');
    const {env,AutoTokenizer,AutoProcessor,CLIPModel,RawImage}=hf;
    env.allowRemoteModels=false;env.allowLocalModels=true;env.localModelPath='https://smart-image-sorter.invalid/models/';if('useBrowserCache' in env)env.useBrowserCache=false;
    const wasmUrl=await StandaloneAssets.blobUrl('runtime','ort-wasm');
    const mjsUrl=await StandaloneAssets.blobUrl('runtime','ort-mjs');
    if(env.backends?.onnx?.wasm){env.backends.onnx.wasm.numThreads=1;env.backends.onnx.wasm.proxy=false;env.backends.onnx.wasm.wasmPaths={wasm:wasmUrl,mjs:mjsUrl}}
    const prompts=[];
    for(const cat of FIXED_CATEGORY_DEFS.categories||[]){for(const text of cat.prototypes||[]){prompts.push(text)}}
    const tokenizer=await AutoTokenizer.from_pretrained(EMBED_CONTEXT.modelId);
    const processor=await AutoProcessor.from_pretrained(EMBED_CONTEXT.modelId);
    const model=await CLIPModel.from_pretrained(EMBED_CONTEXT.modelId,{device:'wasm',dtype:'q8'});
    const textInputs=tokenizer(prompts,{padding:true,truncation:true});
    let out;
    try { out = await model(textInputs); }
    catch {
      const raw = new RawImage(new Uint8ClampedArray([255,255,255]),1,1,3);
      const imageInputs = await processor(raw);
      out = await model({...textInputs,...imageInputs});
    }
    if(!out?.text_embeds)throw new Error('TinyCLIP full model did not return text_embeds.');
    const vectors=out.text_embeds.tolist().map(normalize);
    let cursor=0;
    const result={schemaVersion:2,generatedAtUtc:new Date().toISOString(),model:EMBED_CONTEXT.modelId,categories:[]};
    for(const cat of FIXED_CATEGORY_DEFS.categories||[]){
      const next={key:cat.key,ja:cat.ja,en:cat.en,recommended:Boolean(cat.recommended),group:cat.group,prototypes:[]};
      for(const text of cat.prototypes||[]){next.prototypes.push({text,vector:vectors[cursor++]})}
      result.categories.push(next);
    }
    const json=JSON.stringify(result);
    const utf8=new TextEncoder().encode(json);
    let binary=''; const chunk=0x8000;
    for(let i=0;i<utf8.length;i+=chunk){binary+=String.fromCharCode(...utf8.subarray(i,Math.min(i+chunk,utf8.length)))}
    document.getElementById('output').textContent='B64:'+btoa(binary);
    document.title='LABEL_EMBEDDINGS_DONE';
  }catch(err){
    document.getElementById('output').textContent='ERROR: '+(err?.stack||err?.message||String(err));
    document.title='LABEL_EMBEDDINGS_ERROR';
  }
})();
</script>
</body></html>
'@
$helperHtml = $helperTemplate.Replace('__DEFS_JSON__',$defsJson).Replace('__BUNDLE_JSON__',$bundleJson).Replace('__CONTEXT_JSON__',$contextJson)
[IO.File]::WriteAllText($tempHtml,$helperHtml,[Text.UTF8Encoding]::new($false))
$browser = Find-Browser
$uri = (New-Object System.Uri($tempHtml)).AbsoluteUri
Write-Host "[Smart Image Sorter] Generating label embeddings for $expectedCategories categories..." -ForegroundColor Cyan
Write-Host "[Smart Image Sorter] Headless browser: $browser" -ForegroundColor Cyan
try {
  $dom = & $browser --headless=new --disable-gpu --allow-file-access-from-files --virtual-time-budget=300000 --dump-dom $uri 2>&1 | Out-String
} finally {
  if (Test-Path $tempHtml) { Remove-Item -Force $tempHtml }
}
$match = [regex]::Match($dom,'<pre id="output">(?<json>[\s\S]*?)</pre>')
if (-not $match.Success) { throw "Could not parse helper output.`n$dom" }
$content = [System.Net.WebUtility]::HtmlDecode($match.Groups['json'].Value).Trim()
if ($content.StartsWith('ERROR:')) { throw $content }
if (-not $content.StartsWith('B64:')) { throw "Unexpected helper output: $content" }
try {
  $jsonBytes=[Convert]::FromBase64String($content.Substring(4))
  $jsonText=[Text.Encoding]::UTF8.GetString($jsonBytes)
  $parsed=$jsonText | ConvertFrom-Json -ErrorAction Stop
} catch { throw "Generated label embedding JSON is invalid: $($_.Exception.Message)" }
if (-not $parsed.categories -or @($parsed.categories).Count -ne $expectedCategories) {
  throw "Generated label embedding JSON has $(@($parsed.categories).Count) categories; expected $expectedCategories."
}
foreach ($category in $parsed.categories) {
  if (-not $category.prototypes -or @($category.prototypes).Count -lt 1) { throw "Category '$($category.key)' has no label prototypes." }
  foreach ($prototype in $category.prototypes) {
    if (-not $prototype.vector -or @($prototype.vector).Count -ne 512) { throw "Category '$($category.key)' has an invalid embedding dimension; expected 512." }
  }
}
[IO.File]::WriteAllText($outPath,$jsonText,[Text.UTF8Encoding]::new($false))
Write-Host "[Smart Image Sorter] Generated $expectedCategories category embeddings." -ForegroundColor Green
Write-Host $outPath
