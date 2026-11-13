type Entry={id:string;at:number;text:string;tripId?:string};
export function mountLife({button,hint,open,body,openTrip,getWorld}:{button:HTMLButtonElement;hint:HTMLElement;open:(title:string)=>number;body:HTMLElement;openTrip:(id:string)=>void;getWorld:()=>any}){
 const key='cottage-last-presence-v1',enteredAt=Date.now();
 let since=0;
 try{const value=Number(localStorage.getItem(key));if(Number.isFinite(value)&&value>0&&value<enteredAt)since=value;}catch{}
 const save=()=>{if(document.hidden)return;try{localStorage.setItem(key,String(getWorld()?.serverTime||Date.now()));}catch{}};
 window.addEventListener('pagehide',()=>{try{localStorage.setItem(key,String(getWorld()?.serverTime||Date.now()));}catch{}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){try{localStorage.setItem(key,String(getWorld()?.serverTime||Date.now()));}catch{}}else save();});
 window.setInterval(save,30000);
 const dayStart=(now:number)=>Math.floor((now+28800000)/86400000)*86400000-28800000;
 const records=(today=false):Entry[]=>{const w=getWorld();return (w?.life?.records||[]).filter((r:Entry)=>r.at>(today||!since?dayStart(w?.serverTime||Date.now()):Math.max(since,(w?.serverTime||Date.now())-86400000)));};
 button.onclick=()=>{
  open(since?'你不在的时候':'今天的小日常');
  let today=!since;
  const draw=()=>{
   body.replaceChildren();
   const top=document.createElement('div');top.className='life-history-toolbar';
   const label=document.createElement('p');label.className='subtle';label.textContent=today?'北京时间 · 今天的真实记录':'最近 24 小时内，你上次离开后的记录';top.append(label);
   if(since){const toggle=document.createElement('button');toggle.textContent=today?'只看离开以后':'看看今天';toggle.onclick=()=>{today=!today;draw();};top.append(toggle);}
   body.append(top);
   const entries=records(today).slice().reverse();
   if(!entries.length){const empty=document.createElement('p');empty.className='life-empty';empty.textContent='还没有新的小日常，坐一会儿吧。';body.append(empty);}
   const list=document.createElement('ol');list.className='life-history';
   for(const entry of entries){const item=document.createElement('li'),time=document.createElement('time'),text=document.createElement('p');time.dateTime=new Date(entry.at).toISOString();time.textContent=new Date(entry.at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});text.textContent=entry.text;item.append(time,text);
    if(entry.tripId){const trip=document.createElement('button');trip.textContent='看看这趟旅行';trip.onclick=()=>openTrip(entry.tripId!);item.append(trip);}list.append(item);
   }body.append(list);
  };draw();
 };
 return {refresh(){const w=getWorld(),count=records().length;button.textContent=(since?'你不在的时候':'今天的小日常')+(count?' · '+count:'');const reason=w?.travel?.phase==='away'?'':w?.activity?.reason||'';hint.textContent=reason;hint.hidden=!reason;}};
}
