import test from 'node:test';import assert from 'node:assert/strict';
import {Store} from '../src/core/store.mjs';import {initial,settle,apply,publicWorld} from '../src/core/world.mjs';
import {saveHomePlans,takeHomePlan,queueHomePlan,recordLife,publicLife} from '../src/core/life.mjs';
const noon=Date.parse('2026-11-13T12:00:00+08:00'),system={id:'system',system:true};
test('life records persist and deduplicate actual events without identity or private details',()=>{
 const store=new Store(':memory:',()=>noon);
 try{const cmd={type:'activity',args:{name:'read'},requestId:'life-action-test'};store.transact(cmd,{id:'private-visitor',verifiedQQ:'123456789'});store.transact(cmd,{id:'private-visitor'});
  const records=store.snapshot().life.records;assert.equal(records.filter(r=>r.kind==='activity_started').length,1);assert.equal(records[0].text,'翻起了书');
  assert.ok(!JSON.stringify(records).includes('123456789'));assert.ok(!JSON.stringify(records).includes('private-visitor'));
  assert.equal(store.raw().life.records.length,records.length);
 }finally{store.close();}
});
test('unknown/private events do not enter public life; retention and travel links are bounded',()=>{
 const w=initial(noon);w.travel.history.push({id:'trip-id',place:{label:'公园'}});
 const events=[{id:'a',type:'returned',at:noon,data:{tripId:'trip-id',qq:'123456789',text:'private'}},{id:'b',type:'private_chat',at:noon,data:{text:'secret'}},{id:'c',type:'activity_started',at:noon,data:{name:'read',reason:'私聊中的123456789'}}];
 recordLife(w,events,noon,[],[]);recordLife(w,events,noon,[],[]);
 assert.equal(w.life.records.length,2);assert.equal(w.life.records[0].tripId,'trip-id');assert.ok(!JSON.stringify(publicLife(w,noon)).match(/secret|123456789|private/));
 assert.equal(publicLife(w,noon+25*3600000).records.length,0);
  recordLife(w,[{id:'older-meal',at:noon-1000,type:'meal',data:{item:'tomato'}}],noon,[],[['tomato','番茄炒蛋']]);assert.equal(w.life.records[0].id,'older-meal');
});
test('one home planning opportunity per hour, no queue while sleeping, away or manually busy',()=>{
 const w=initial(noon),events=[];queueHomePlan(w,noon,(type,data)=>events.push({type,data}));queueHomePlan(w,noon+60000,()=>events.push('duplicate'));assert.equal(events.length,1);
 for(const change of [s=>s.travel.current={id:'away'},s=>s.activity={name:'sleep',until:noon+60000},s=>s.activity={name:'read',manual:true,until:noon+60000}]){const state=initial(noon);change(state);queueHomePlan(state,noon,()=>assert.fail('must not queue'));}
});
test('models can suggest but cannot add inventory, invent anchors or inject public reasons',()=>{
 const w=initial(noon);queueHomePlan(w,noon,()=>{});const id=w.life.requestId;
 saveHomePlans(w,{id,plans:[{id:'souvenir',reason:'想看看刚带回的东西'},{id:'book',reason:'想翻一会儿书，歇歇眼睛',anchor:'secret',name:'eat'}]},noon);
 assert.equal(w.life.plans.length,1);assert.equal(w.life.plans[0].anchor,'desk');assert.equal(w.life.plans[0].name,'read');
 const activity=takeHomePlan(w,noon);assert.equal(activity.plan,'book');assert.equal(activity.reason,'想翻一会儿书，歇歇眼睛');assert.equal(w.stock.tomato,0);
 saveHomePlans(w,{id,plans:[{id:'quiet',reason:'changed'}]},noon);assert.equal(w.life.plans.length,0);
 assert.throws(()=>apply(w,{type:'home_plan',args:{id,plans:[]}},{id:'guest'},noon,[]));
 const other=initial(noon);queueHomePlan(other,noon,()=>{});saveHomePlans(other,{id:other.life.requestId,plans:[{id:'book',reason:'主人私聊123456789'}]},noon);assert.equal(other.life.plans.length,0);
});
test('only executed plans become records; manual activity, travel and survival rules take priority',()=>{
 const w=initial(noon);queueHomePlan(w,noon,()=>{});saveHomePlans(w,{id:w.life.requestId,plans:[{id:'book',reason:'想看看书里的图案'}]},noon);
 assert.equal(w.life.records.length,0);
 w.activity={name:'rest',manual:true,startedAt:noon,until:noon+60000};settle(w,noon+1000,[]);assert.equal(w.activity.name,'rest');assert.equal(w.life.plans.length,1);
 const events=[];settle(w,noon+61000,events);assert.equal(w.activity.name,'read');assert.equal(w.activity.reason,'想看看书里的图案');assert.ok(events.some(e=>e.type==='activity_started'&&e.data.reason));
 assert.equal(publicWorld(w,noon+61000).activity.reason,w.activity.reason);
 const state=initial(noon);queueHomePlan(state,noon,()=>{});saveHomePlans(state,{id:state.life.requestId,plans:[{id:'book',reason:'想翻书'}]},noon);state.hunger=20;state.stock.tomato=1;settle(state,noon+60000,[]);assert.equal(state.activity.name,'eat');assert.equal(state.life.plans.length,1);
 state.travel.current={id:'away'};assert.equal(takeHomePlan(state,noon),null);state.travel.current=null;assert.equal(takeHomePlan(state,noon+3*3600000),null);
});
