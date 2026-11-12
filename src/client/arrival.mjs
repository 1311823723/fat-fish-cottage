export function arrivalCandidate(previous,next,now){
 const event=next?.travel?.lastReturn;
 if(previous?.travel?.phase!=='away'||next?.travel?.phase!=='home'||!event?.tripId)return null;
 if(previous.travel.tripId&&previous.travel.tripId!==event.tripId)return null;
 if(!Number.isFinite(event.at)||now<event.at||now-event.at>90000)return null;
 if(next.activity?.manual&&next.activity.startedAt>=event.at)return null;
 return {tripId:String(event.tripId),place:String(event.place||'外面'),at:event.at,souvenir:event.souvenir?{label:String(event.souvenir.label||''),id:String(event.souvenir.id||'')}:null};
}
export function arrivalPose(elapsed,entry,desk,idle){
 const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
 if(elapsed<0||elapsed>=6000)return null;
 if(elapsed<2200)return {...mix(entry,desk,elapsed/2200),action:entry.x<desk.x?'walk_right':'walk_left',phase:'enter',carrying:true};
 if(elapsed<4400)return {...desk,action:'idle',phase:elapsed<3200?'unpack':'show',carrying:false};
 return {...mix(desk,idle,(elapsed-4400)/1600),action:desk.x<idle.x?'walk_right':'walk_left',phase:'settle',carrying:false};
}
