import test from 'node:test';import assert from 'node:assert/strict';
import {Store} from '../src/core/store.mjs';import {makeServer} from '../src/server.mjs';import {tripDetails,publicWish} from '../src/core/trip-details.mjs';
import {departureCandidate,departurePose} from '../src/client/departure.mjs';
const id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',now=Date.parse('2026-11-13T10:00:00+08:00');
test('trip detail freezes travel facts and excludes private actors, causes and coordinates',()=>{
 const store=new Store(':memory:',()=>now);try{
  const w=store.raw();w.wardrobe.outfit='cat_paw';w.travel.history.push({id,place:{label:'小公园',latitude:12,longitude:34},outfit:'whale_pajamas',outfitName:'那天的鲸鱼睡衣',intent:{wish:'想看一看树叶',reason:'PRIVATE_CAUSE'},departedAt:now-7200000,returnedAt:now-3600000,backpack:['camera','map'],food:{id:'tomato',label:'番茄炒蛋',giver:{qq:'987654321'}},photoScene:{capturedAt:now-5400000,phase:'morning',weather:{kind:'clear',temperature:18,latitude:12,longitude:34},intent:{reason:'PRIVATE_SCENE'}}});
  w.souvenirs.push({tripId:id,id:'leaf',label:'小叶子',owner:'PRIVATE_OWNER'});w.photos.push({photoId:id,place:'小公园',capturedAt:now-5400000,caption:'树荫下歇了一会儿'});
  const detail=tripDetails(w,id),json=JSON.stringify(detail);assert.equal(detail.outfit.name,'那天的鲸鱼睡衣');assert.equal(detail.wish,'想看一看树叶');assert.equal(detail.capture.weather.kind,'clear');assert.equal(detail.souvenirs[0].label,'小叶子');
  for(const secret of ['PRIVATE','987654321','latitude','longitude','giver'])assert(!json.includes(secret));
  assert.equal(tripDetails(w,'../private'),null);
  w.travel.current={...w.travel.history[0],returnedAt:undefined,souvenir:{label:'尚未获得'}};w.souvenirs=[];assert.deepEqual(tripDetails(w,id).souvenirs,[]);
 }finally{store.close();}
});
test('photo-only old records and unavailable weather are not reconstructed from present state',()=>{
 const store=new Store(':memory:',()=>now);try{const w=store.raw();w.photos.push({photoId:id,place:'老街',capturedAt:now,caption:'街边坐了一会儿',scene:{weather:{available:false,kind:'rain'}}});const detail=tripDetails(w,id);assert.equal(detail.phase,'archived');assert.equal(detail.departedAt,null);assert.equal(detail.returnedAt,null);assert.equal(detail.outfit,null);assert.equal(detail.backpack,null);assert.equal(detail.capture.weather,null);assert.equal(publicWish('主人在私聊里告诉我一个秘密'),'');}finally{store.close();}
});
test('public trip endpoint has only public detail and keeps origin and missing-record errors',async()=>{
 const store=new Store(':memory:',()=>now),w=store.raw();w.photos.push({photoId:id,place:'老街',capturedAt:now,caption:'看看街景'});store.db.prepare('UPDATE world SET json=? WHERE id=1').run(JSON.stringify(w));
 const {server}=makeServer({allowedOrigins:['http://test.local']},{store});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const post=(body,origin)=>fetch('http://127.0.0.1:'+server.address().port+'/api/room-trip',{method:'POST',headers:{'content-type':'application/json',...(origin?{origin}:{})},body:JSON.stringify(body)});const good=await post({id});assert.equal(good.status,200);assert.equal((await good.json()).trip.place,'老街');assert.equal((await post({id:'invalid'})).status,404);assert.equal((await post({id},'http://foreign.local')).status,403);}finally{await new Promise(resolve=>server.close(resolve));store.close();}
});
test('departure is presentation-only after confirmation, never replayed on entry or stale snapshots',()=>{
 const home={travel:{phase:'home'}},away={travel:{phase:'away',tripId:id,departedAt:now,returnAt:now+60000,destination:'小公园'}};
 assert.equal(departureCandidate(null,away,now),null);assert.equal(departureCandidate(home,away,now).tripId,id);assert.equal(departureCandidate(away,away,now),null);assert.equal(departureCandidate(home,away,now+91000),null);assert.equal(departureCandidate(home,{travel:{phase:'home'}},now),null);
 const from={x:230,y:700},bag={x:310,y:575},exit={x:-80,y:745};assert.equal(departurePose(0,from,bag,exit).phase,'approach');assert.equal(departurePose(1800,from,bag,exit).carrying,true);assert.equal(departurePose(3000,from,bag,exit).phase,'leave');assert.equal(departurePose(5200,from,bag,exit),null);assert.equal(away.travel.phase,'away');
});
