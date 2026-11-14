import test from 'node:test';
import assert from 'node:assert/strict';
import {travelDecisionContext} from '../adapters/game-core-adapter.mjs';
const now=Date.parse('2026-11-14T17:00:00+08:00');
const trip=(id,place,at)=>({id,place:{id:'named',label:place},departedAt:Date.parse(at),returnedAt:Date.parse(at)+60000,
 intent:{wish:'看看花纹',reason:'旧照片失败想补拍'},photoScene:{description:'旧照片的描述'},photo:{status:'failed'}});
test('decision context orders departures rather than photo/archive order and exposes Beijing-day repetition',()=>{
 const a=trip('a','示例城·河边茶社','2026-11-14T13:00:00+08:00');
 const b=trip('b','示例城河边茶社','2026-11-14T16:00:00+08:00');
 const yesterday=trip('c','示例城河边茶社','2026-11-13T23:50:00+08:00');
 const old=trip('d','示例城河边茶社','2026-11-01T13:00:00+08:00');
 const other=trip('e','示例城小巷','2026-11-14T09:00:00+08:00');
 const w={travel:{current:null,pending:[a],history:[b,other,yesterday,old,a]},weather:{city:'示例城'},stock:{tomato:2},backpack:['camera']};
 const context=travelDecisionContext(w,now);
 assert.deepEqual(context.recentTrips.map(t=>t.departedAt),[b,a,other,yesterday,old].map(t=>t.departedAt));
 const visits=context.recentPlaceVisits.find(v=>v.place.includes('茶社'));
 assert.equal(visits.today,2);assert.equal(visits.last7Days,3);
 assert.equal(context.recentPlaceVisits.length,2);
 assert.equal(context.stock.tomato,2);assert.equal(context.atHome,true);
 assert.ok(!JSON.stringify(context).includes('failed'));
 assert.ok(!JSON.stringify(context).includes('补拍'));
 assert.ok(!JSON.stringify(context).includes('旧照片的描述'));
});
