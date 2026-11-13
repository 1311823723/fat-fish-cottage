import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../src/client/room-bootstrap.js',import.meta.url),'utf8');
function run(fetcher){const elements=Object.fromEntries(['retryConnection','connection','weather','place','roomActivity'].map(id=>[id,{hidden:true,textContent:''}])),timers=new Map(),window={};let id=0;
 vm.runInNewContext(source,{window,document:{getElementById:key=>elements[key],querySelector:()=>({firstChild:{textContent:''}})},location:{reload(){}},fetch:fetcher,AbortController,Date,setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimeout:key=>timers.delete(key)});
 return {boot:window.__cottageBoot,elements,timers};
}
test('initial state can connect without engine or AbortSignal.timeout, stays transient and uses an abort signal',async()=>{
 const state={ok:true,weather:{available:false},activity:{name:'sleep'},travel:{phase:'home'}};let request;
 const {boot,elements}=run(async(url,opts)=>{request={url,opts};return {ok:true,json:async()=>state};});
 assert.equal(await boot.promise,state);assert.equal(request.url,'/api/room-state');assert.equal(request.opts.method,'POST');assert.ok(request.opts.signal instanceof AbortSignal);assert.equal(elements.connection.textContent,'状态已连接 · 正在加载角色');assert.equal(elements.roomActivity.textContent,'睡觉中');assert.ok(boot.receivedAt>0);boot.stop();
});
test('state failure shows retry and schedules recovery; handoff cancels timers',async()=>{
 const {boot,elements,timers}=run(async()=>({ok:false,json:async()=>({ok:false})}));
 assert.equal(await boot.promise,null);assert.equal(elements.retryConnection.hidden,false);assert.match(elements.connection.textContent,/连不上后台/);assert.ok([...timers.values()].some(t=>t.ms===5000));boot.stop();assert.equal(timers.size,0);
});
test('bootstrap build entry is a separate same-origin classic script compatible with the local CSP',async()=>{
 const {default:config}=await import('../vite.config.ts');const plugin=config.plugins[0],assets=[];plugin.buildStart.call({emitFile:asset=>assets.push(asset)});
 const built=plugin.transformIndexHtml('<img src="/assets/room-v5.webp">',{}),script=built.tags.find(tag=>tag.tag==='script');
 assert.match(script.attrs.src,/^\/assets\/room-bootstrap-[a-f0-9]{12}\.js$/);assert.equal(script.injectTo,'head-prepend');assert.equal(script.attrs.defer,true);assert.equal(script.children,undefined);assert.equal(assets[0].source,source);assert.equal('/'+assets[0].fileName,script.attrs.src);
});
