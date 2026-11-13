import {randomUUID} from 'node:crypto';
const hour=3600000;
export function publicText(value,max=80){
 if(typeof value!=='string')return '';
 const text=value.replace(/[\x00-\x1f\x7f]/g,' ').trim();
 if(!text||text.length>max||/\d{5,}|https?:|@|[<>]|QQ|私聊|群聊|群友|主人|账号|验证|密码|密钥|指令|系统提示/i.test(text))return '';
 return text;
}
export function lifeState(w,now){return w.life??={since:now,records:[],plans:[],nextPlanAt:0};}
export function homeOptions(w){
 const wet=w.weather?.available&&!w.weather.stale&&['rain','snow','thunder'].includes(w.weather.kind);
 return [
  {id:'book',name:'read',anchor:'desk',hint:'翻一会桌上的书'},
  {id:'quiet',name:'rest',anchor:'rest',hint:'安静坐一会'},
  ...(w.energy>=45?[{id:'stretch',name:'walk',anchor:'walk',hint:'在屋里走走，活动一下'},{id:'hum',name:'sing',anchor:'idle',hint:'轻轻哼一小段，不编造歌名或歌词'}]:[]),
  ...(w.photos.length?[{id:'photos',name:'read',anchor:'desk',hint:'翻翻已有的旅行相册'}]:[]),
  ...(w.souvenirs.length?[{id:'souvenir',name:'rest',anchor:'desk',hint:'在桌边看看带回来的小东西'}]:[]),
  ...(wet?[{id:'weather',name:'rest',anchor:'rest',hint:'听听外面的雨雪，留在屋里歇一会'}]:[]),
 ];
}
export function queueHomePlan(w,now,emit){
 const life=lifeState(w,now),h=new Date(now+8*hour).getUTCHours();
 life.plans=life.plans.filter(plan=>plan.expiresAt>now);
 if(w.travel.current||h<8||h>=23||w.hunger<35||w.energy<25||w.activity?.name==='sleep'||(w.activity?.manual&&w.activity.until>now)||life.plans.length||life.nextPlanAt>now)return;
 life.nextPlanAt=now+hour;life.requestId=randomUUID();
 emit('home_plan_due',{id:life.requestId});
}
export function saveHomePlans(w,args,now){
 const life=lifeState(w,now);
 if(args.id!==life.requestId||life.resolvedId===args.id)return false;
 life.resolvedId=args.id;
 const h=new Date(now+28800000).getUTCHours();
 if(w.travel.current||h<7||h>=23){life.plans=[];return true;}
 const options=homeOptions(w),seen=new Set();
 life.plans=(Array.isArray(args.plans)?args.plans:[]).slice(0,2).flatMap(raw=>{
  const choice=options.find(item=>item.id===raw?.id),reason=publicText(raw?.reason,65);
  if(!choice||!reason||seen.has(choice.id))return [];seen.add(choice.id);
  return [{...choice,reason,createdAt:now,expiresAt:now+2*hour}];
 });
 return true;
}
export function takeHomePlan(w,now){
 const life=lifeState(w,now),h=new Date(now+8*hour).getUTCHours();
 if(w.travel.current||h<7||h>=23||w.energy<25||w.hunger<35)return null;
 while(life.plans.length){const plan=life.plans.shift();
  if(plan.expiresAt<=now||!homeOptions(w).some(option=>option.id===plan.id))continue;
  const duration=({read:5,rest:6,walk:0.5,sing:0.75})[plan.name]*60000;
  return {name:plan.name,reason:plan.reason,anchor:plan.anchor,plan:plan.id,automatic:true,startedAt:now,until:now+duration};
 }
 return null;
}
const labels={read:'翻起了书',rest:'坐下歇一会',walk:'在屋里走走',sing:'轻轻哼歌',sleep:'睡觉了',wake:'醒来了'};
export function recordLife(w,events,now,outfits,menu){
 const life=lifeState(w,now);
 for(const e of events){
  let text='',tripId;
  if(e.type==='outfit_changed'){const outfit=outfits.find(x=>x.id===e.data.outfit);if(outfit)text='换上了'+outfit.name.replace('（试验）','');}
  if(e.type==='meal')text='吃了'+(menu.find(x=>x[0]===e.data.item)?.[1]||'一份食物');
  if(e.type==='travel_meal')text='在路上吃了带的饭';
  if(['departed','returned','photo_ready'].includes(e.type)){
   const trip=[w.travel.current,...w.travel.pending,...w.travel.history].find(t=>t?.id===e.data.tripId);tripId=trip?.id;
   const place=publicText(trip?.place?.label,45)||'外面';
   text=e.type==='departed'?'去'+place+'转转':e.type==='returned'?'从'+place+'回家了':'收好了'+place+'的旅行照片';
  }
  if(e.type==='activity_started'){
   text=labels[e.data.name]||'';
   const reason=publicText(e.data.reason,65);if(text&&reason)text+=' · '+reason;
   const previous=life.records.at(-1);if(previous?.text===text&&e.at-previous.at<20*60000)continue;
  }
  if(!text||life.records.some(r=>r.id===e.id))continue;
  life.records.push({id:e.id,at:e.at,kind:e.type,text,...(tripId?{tripId}:{})});
 }
 life.records=life.records.filter(r=>r.at>=now-3*24*hour).sort((a,b)=>a.at-b.at).slice(-160);
}
export function publicLife(w,now){
 const life=w.life;return {since:life?.since||now,records:(life?.records||[]).filter(r=>r.at>=now-24*hour).slice(-60)};
}
