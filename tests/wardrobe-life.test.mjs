import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../src/core/store.mjs';
import {arrivalCandidate,arrivalPose} from '../src/client/arrival.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {makeServer} from '../src/server.mjs';
import {installGameCore} from '../adapters/game-core-adapter.mjs';
import {removeTestDirectory} from './helpers.mjs';
const event={tripId:'fixture-trip',place:'小公园',at:10000,souvenir:{id:'leaf',label:'一片叶子'}};
test('confirmed outfit state includes appearance and time, without inventing an initial change',()=>{
 const now=Date.parse('2026-11-13T12:00:00+08:00'),store=new Store(':memory:',()=>now);
 try{
  assert.equal(store.snapshot().wardrobe.changedAt,null);
  const result=store.transact({type:'outfit_set',args:{id:'cat_paw'},requestId:'outfit-life-001'},{id:'visitor'});
  assert.equal(result.wardrobe.current.id,'cat_paw');assert(result.wardrobe.current.description.includes('猫爪'));assert.equal(result.wardrobe.changedAt,now);assert.equal(result.wardrobe.automatic,false);
  assert(!JSON.stringify(result.wardrobe).includes('visitor'));
 }finally{store.close();}
});
test('arrival uses actual return and souvenir once, and is independent of queued photos',()=>{
 let now=Date.parse('2026-11-13T12:00:00+08:00');const store=new Store(':memory:',()=>now);
 try{
  const w=store.raw();w.travel.current={id:event.tripId,place:{label:event.place},intent:{wish:'看看树叶'},departedAt:now-60000,returnAt:now+1000,souvenir:event.souvenir,photoScene:{frozen:true}};
  store.db.prepare('UPDATE world SET json=? WHERE id=1').run(JSON.stringify(w));const away=store.snapshot();now+=2000;const home=store.snapshot();
  assert.equal(home.travel.phase,'home');assert.equal(home.travel.lastReturn.tripId,event.tripId);assert.equal(home.travel.lastReturn.souvenir.label,event.souvenir.label);
  assert.equal(arrivalCandidate(away,home,now).tripId,event.tripId);assert.equal(arrivalCandidate(home,store.snapshot(),now),null);assert.equal(home.souvenirs.length,1);
  assert(!JSON.stringify(home.travel.lastReturn).includes('wish'));assert.equal(store.raw().travel.pending.length,1);
 }finally{store.close();}
});
test('arrival never replays old history or overrides a manual activity',()=>{
 const away={travel:{phase:'away',tripId:event.tripId}},home={travel:{phase:'home',lastReturn:event},activity:{name:'rest'}};
 assert.equal(arrivalCandidate(null,home,10010),null);
 assert.equal(arrivalCandidate(away,home,101000),null);
 assert.equal(arrivalCandidate({travel:{phase:'away',tripId:'other'}},home,10010),null);
 assert.equal(arrivalCandidate(away,{...home,activity:{manual:true,startedAt:10005}},10010),null);
 assert.equal(arrivalCandidate(away,{...home,travel:{...home.travel,lastReturn:{...event,souvenir:null}}},10010).souvenir,null);
 const entry={x:55,y:745},desk={x:450,y:690},idle={x:230,y:700};
 assert.equal(arrivalPose(0,entry,desk,idle).action,'walk_right');assert.equal(arrivalPose(2800,entry,desk,idle).phase,'unpack');assert.equal(arrivalPose(3600,entry,desk,idle).phase,'show');assert.equal(arrivalPose(5500,entry,desk,idle).action,'walk_left');assert.equal(arrivalPose(6000,entry,desk,idle),null);
});
test('QQ prompt and status use the current outfit while album lookup remains available',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fatfish-outfit-context-'));fs.mkdirSync(path.join(dir,'state'));
 const store=new Store(),secret='test-connection-only-'.repeat(3),{server}=makeServer({adapterSecret:secret,allowedOrigins:[]},{store});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 fs.writeFileSync(path.join(dir,'state/game-core-link.json'),JSON.stringify({enabled:true,url:'http://127.0.0.1:'+server.address().port,secret}));
 const room={data:{visitors:{}}},core=installGameCore(room,{root:dir});
 try{
  const w=store.raw();w.photos.push({photoId:'a'.repeat(36),place:'小公园',capturedAt:Date.now(),caption:'树荫里歇一会儿'});store.db.prepare('UPDATE world SET json=? WHERE id=1').run(JSON.stringify(w));
  const state=store.transact({type:'outfit_set',args:{id:'whale_pajamas'},requestId:'outfit-context-001'},{id:'fixture'});
  await core.refresh();const context=core.context();assert(context.includes(state.wardrobe.current.description));assert(!context.includes('经典女仆装'));assert(context.includes('不必主动报衣服'));
  assert.equal((await core.qqAction({action:'status'})).wardrobe.id,'whale_pajamas');
  const photos=await core.travelPhotos('小公园');assert.equal(photos.length,1);assert.equal((await core.travelPhoto(photos[0].photoId)).trip.photo.id,photos[0].photoId);
 }finally{core.stop();await new Promise(resolve=>server.close(resolve));store.close();removeTestDirectory(dir);}
});
