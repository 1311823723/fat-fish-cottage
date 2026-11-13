type Options={body:HTMLElement;id:string;api:(route:string,args?:any)=>Promise<any>;active:()=>boolean;back:()=>void};
const node=<K extends keyof HTMLElementTagNameMap>(tag:K,text='',className='')=>{const e=document.createElement(tag);e.textContent=text;e.className=className;return e;};
const at=(value:number|null)=>value?new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'未记录';
const phases:Record<string,string>={night:'夜晚',dawn:'黎明',morning:'早晨',day:'白天',sunset:'黄昏'};
const weatherNames:Record<string,string>={clear:'晴',cloudy:'多云',overcast:'阴',rain:'雨',snow:'雪',fog:'雾',thunder:'雷雨'};
export function mountTrip(options:Options){
 let disposed=false,loading=false,detail:any=null;
 async function load(){
  if(disposed||loading||!options.active())return;loading=true;
  if(!detail)options.body.replaceChildren(node('p','正在翻这趟旅行…','subtle'));
  try{
   const response=await options.api('trip',{id:options.id});if(disposed||!options.active())return;detail=response.trip;render();
  }catch(error){if(!disposed&&options.active()){const message=node('p',(error as Error).message,'trip-error');message.setAttribute('role','alert');const retry=node('button','再试一次');retry.onclick=()=>void load();options.body.replaceChildren(message,retry,backButton());}}
  finally{loading=false;}
 }
 const backButton=()=>{const back=node('button','返回相册','trip-back');back.type='button';back.onclick=options.back;return back;};
 function render(){
  const root=node('article','','trip-detail'),header=node('div','','trip-heading');header.append(node('h3',detail.place||'一次旅行'),node('span',detail.phase==='away'?'正在外出':detail.phase==='returned'?'已经回家':'旅行旧照','trip-badge'));root.append(header);
  for(const photo of detail.photos){
   if(!/^[a-f0-9-]{36}$/.test(photo.photoId))continue;
   const figure=node('figure','','trip-photo'),image=node('img','','photo-large');image.alt=photo.place||detail.place;image.src='/room-photo/'+photo.photoId+'?v='+encodeURIComponent(photo.assetVersion);image.decoding='async';
   image.onerror=()=>{image.hidden=true;figure.prepend(node('p','照片暂时没加载好，可刷新这趟记录。','subtle'));};figure.append(image,node('figcaption',photo.caption||''));root.append(figure);
  }
  if(!detail.photos.length)root.append(node('p',detail.phase==='away'?'这趟还在路上，照片之后会收到相册。':detail.photoStatus==='pending'?'已经回家了，照片还在整理。':'这趟暂时没有照片。','trip-empty'));
  if(detail.wish){const wish=node('blockquote',detail.wish,'trip-wish');root.append(wish);}
  const facts=node('dl','','trip-facts');
  const row=(label:string,value:string)=>{const group=node('div');group.append(node('dt',label),node('dd',value));facts.append(group);};
  row('出发',at(detail.departedAt));row(detail.phase==='away'?'预计回家':'回家',at(detail.phase==='away'?detail.expectedReturnAt:detail.returnedAt));
  row('穿着',detail.outfit?.name||'未记录');row('随身带着',detail.backpack?detail.backpack.map((item:any)=>item.label).join('、')||'轻装出门':'未记录');row('带的吃食',detail.food?.label||'未记录');
  row('拍照时间',at(detail.capture?.at));
  const weather=detail.capture?.weather;
  row('拍照时的天气',weather?(weather.label||weatherNames[weather.kind]||'未记录')+(weather.temperature!==null?` · ${weather.temperature}℃`:'')+(phases[detail.capture.phase]?` · ${phases[detail.capture.phase]}`:''):'未记录可靠天气');
  root.append(facts);
  const keepsakes=node('section','','trip-keepsakes');keepsakes.append(node('h4','带回来的小东西'));
  keepsakes.append(node('p',detail.souvenirs.length?detail.souvenirs.map((item:any)=>item.label).join('、'):detail.phase==='away'?'还没回来，等她带回惊喜。':'这趟没有记录纪念品。'));root.append(keepsakes);
  const footer=node('div','','trip-footer'),refresh=node('button','刷新这趟记录');refresh.type='button';refresh.onclick=()=>void load();footer.append(backButton(),refresh);root.append(footer);options.body.replaceChildren(root);
 }
 void load();
 return {refresh(world:any){if(detail&&((detail.phase==='away'&&world.travel.phase!=='away')||(!detail.photos.length&&world.photos.some((photo:any)=>photo.photoId===options.id))))void load();},dispose(){disposed=true;}};
}
