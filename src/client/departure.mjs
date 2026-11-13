export function departureCandidate(previous,next,now){
 const trip=next?.travel;
 if(previous?.travel?.phase!=='home'||trip?.phase!=='away'||!trip.tripId)return null;
 if(!Number.isFinite(trip.departedAt)||now<trip.departedAt||now-trip.departedAt>90000||trip.returnAt<=now)return null;
 return {tripId:String(trip.tripId),place:String(trip.destination||'外面'),at:trip.departedAt};
}
export function departurePose(elapsed,start,bag,exit){
 const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
 if(elapsed<0||elapsed>=5200)return null;
 if(elapsed<1700)return {...mix(start,bag,elapsed/1700),action:start.x<bag.x?'walk_right':'walk_left',phase:'approach',carrying:false,note:false};
 if(elapsed<2400)return {...bag,action:'idle',phase:'pickup',carrying:true,note:true};
 return {...mix(bag,exit,(elapsed-2400)/2800),action:bag.x<exit.x?'walk_right':'walk_left',phase:'leave',carrying:true,note:true};
}
