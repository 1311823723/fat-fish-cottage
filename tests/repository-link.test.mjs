import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ROOT} from '../src/config.mjs';
import {linkBridge} from '../scripts/link-bridge.mjs';
import {Store} from '../src/core/store.mjs';
import {makeServer} from '../src/server.mjs';
import {installGameCore} from '../adapters/game-core-adapter.mjs';
import {removeTestDirectory} from './helpers.mjs';
function fixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fatfish-split-')),game=path.join(dir,'cottage'),bridge=path.join(dir,'chat');
 fs.mkdirSync(path.join(game,'adapters'),{recursive:true});fs.mkdirSync(path.join(bridge,'src'),{recursive:true});fs.mkdirSync(path.join(bridge,'state'));
 for(const name of ['game-core-adapter.mjs','game-public-adapter.mjs','game-bridge-hooks.mjs'])fs.copyFileSync(path.join(ROOT,'adapters',name),path.join(game,'adapters',name));
 fs.writeFileSync(path.join(bridge,'src/bridge.js'),"// installGameCore startGameBridge fixture\n");fs.writeFileSync(path.join(bridge,'src/room-public-server.mjs'),'// routeGame installGameEvents fixture\n');
 const config={port:3197,adapterSecret:'fixture-only-'.repeat(4),relaySecret:'relay-only-'.repeat(4),allowedOrigins:['http://127.0.0.1:3197'],bridge:{enabled:false,gatewayUrl:'http://127.0.0.1:3196'}};
 fs.writeFileSync(path.join(game,'config.local.json'),JSON.stringify(config));
 return {dir,game,bridge,config};
}
test('split link previews without writes, applies with backup, preserves settings and is idempotent',()=>{
 const f=fixture();
 try{
   const preview=linkBridge({gameRoot:f.game,bridgeRoot:f.bridge});assert.equal(preview.applied,false);assert(!fs.existsSync(path.join(f.bridge,'state/game-core-link.json')));
   const result=linkBridge({gameRoot:f.game,bridgeRoot:f.bridge,apply:true});assert(result.backup);
   const link=JSON.parse(fs.readFileSync(path.join(f.bridge,'state/game-core-link.json'))),config=JSON.parse(fs.readFileSync(path.join(f.game,'config.local.json')));
   assert.equal(link.secret,f.config.adapterSecret);assert.equal(config.bridge.gatewayUrl,'http://127.0.0.1:3196');assert.equal(config.bridge.enabled,true);assert(!('photoDirectory' in link));
   assert.equal(linkBridge({gameRoot:f.game,bridgeRoot:f.bridge,apply:true}).changedFiles,0);
   assert(!JSON.stringify(result).includes(f.config.adapterSecret));
   link.secret='mismatch-'.repeat(5);fs.writeFileSync(path.join(f.bridge,'state/game-core-link.json'),JSON.stringify(link));
   const before=fs.readFileSync(path.join(f.game,'config.local.json'));assert.throws(()=>linkBridge({gameRoot:f.game,bridgeRoot:f.bridge,apply:true}),/凭据不同/);assert(fs.readFileSync(path.join(f.game,'config.local.json')).equals(before));
 }finally{removeTestDirectory(f.dir);}
});
test('partial integration is rejected without modifying either repository',()=>{
 const f=fixture();try{fs.writeFileSync(path.join(f.bridge,'src/room-public-server.mjs'),'// incomplete');assert.throws(()=>linkBridge({gameRoot:f.game,bridgeRoot:f.bridge,apply:true}),/部分接入/);assert(!fs.existsSync(path.join(f.bridge,'state/game-core-link.json')));}finally{removeTestDirectory(f.dir);}
});
test('versioned photo transport requires adapter authentication and never needs a shared photo path',async()=>{
 const f=fixture(),store=new Store(),secret=f.config.adapterSecret,photoDirectory=path.join(f.dir,'photos');fs.mkdirSync(photoDirectory);
 const id='a'.repeat(36),bytes=Buffer.alloc(2048,42);fs.writeFileSync(path.join(photoDirectory,id+'.img'),bytes);
 const world=store.raw();world.photos.push({photoId:id});store.db.prepare('UPDATE world SET json=? WHERE id=1').run(JSON.stringify(world));
 const {server}=makeServer({adapterSecret:secret,allowedOrigins:[]},{store,photoDirectory});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 fs.writeFileSync(path.join(f.bridge,'state/game-core-link.json'),JSON.stringify({enabled:true,url:'http://127.0.0.1:'+server.address().port,secret}));
 const core=installGameCore({data:{visitors:{}}},{root:f.bridge});
 try{
  const health=await(await fetch('http://127.0.0.1:'+server.address().port+'/health')).json();assert.deepEqual(health.protocol,{name:'fatfish-life',version:1});
  const denied=await fetch('http://127.0.0.1:'+server.address().port+'/internal/photo',{method:'POST',body:JSON.stringify({id:'a'.repeat(36)})});assert.equal(denied.status,403);
  await assert.rejects(core.readPhoto('../private'),/图片编号/);await assert.rejects(core.readPhoto('b'.repeat(36)),/暂不可用/);assert((await core.readPhoto(id)).equals(bytes));
  const snapshot=await(await fetch('http://127.0.0.1:'+server.address().port+'/internal/snapshot',{method:'POST',headers:{'x-game-adapter':secret},body:'{}'})).json();assert.equal(snapshot.protocolVersion,1);
 }finally{core.stop();await new Promise(r=>server.close(r));store.close();removeTestDirectory(f.dir);}
});
