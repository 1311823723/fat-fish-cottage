type Options={body:HTMLElement;world:()=>any;prepare:(id:string,progress:(value:number)=>void,signal:AbortSignal)=>Promise<void>;command:(type:string,args:any,button?:HTMLButtonElement)=>Promise<boolean|undefined>;close:()=>void};
const node=<K extends keyof HTMLElementTagNameMap>(tag:K,className='',text='')=>{const element=document.createElement(tag);element.className=className;element.textContent=text;return element;};
const preview=(item:any)=>{
 const src=item?.preview||(item?.id==='original'?'/assets/reference-v1.png':item?.photoReference)||'';
 return /^\/assets\/(?:outfits\/[a-z0-9_-]+\/)?[a-zA-Z0-9_-]+\.(png|webp)$/.test(src)?src:'';
};
export function mountWardrobe(options:Options){
 const {body,world}=options,abort=new AbortController();
 let selected=world().wardrobe.outfit,busy=false,disposed=false,successful=false;
 const shell=node('div','wardrobe-shell'),stage=node('section','wardrobe-stage'),artBox=node('div','wardrobe-art'),hero=node('img','wardrobe-hero'),imageStatus=node('span','wardrobe-image-status','预览加载中…');
 hero.alt='';hero.decoding='async';hero.width=280;hero.height=320;artBox.append(hero,imageStatus);
 const heading=node('h3','wardrobe-name'),description=node('p','wardrobe-description'),badge=node('span','wardrobe-worn'),status=node('p','wardrobe-feedback');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const progress=node('progress','wardrobe-progress');progress.max=1;progress.value=0;progress.hidden=true;progress.setAttribute('aria-label','衣服素材加载进度');
 stage.append(artBox,heading,badge,description,status,progress);
 const list=node('section','wardrobe-selection'),grid=node('div','wardrobe-grid');grid.setAttribute('aria-label','选择套装');
 const auto=node('button','wardrobe-auto');auto.type='button';
 auto.onclick=async()=>{if(busy)return;await options.command('wardrobe_auto',{enabled:world().wardrobe.auto===false},auto);if(!disposed)refresh();};
 const cards=new Map<string,HTMLButtonElement>();
 for(const item of world().wardrobe.outfits){
  const card=node('button','wardrobe-card');card.type='button';card.dataset.outfit=item.id;
  const thumb=node('img','wardrobe-preview'),label=node('span','',item.name.replace('（试验）','')),worn=node('small','wardrobe-card-worn');
  thumb.alt='';thumb.width=112;thumb.height=128;thumb.decoding='async';thumb.loading='eager';
  thumb.onload=()=>card.classList.add('is-ready');thumb.onerror=()=>{card.classList.add('preview-unavailable');worn.textContent='预览未加载';};
  thumb.src=preview(item);card.append(thumb,label,worn);
  card.onclick=()=>{if(busy||selected===item.id)return;selected=item.id;successful=false;status.textContent='';refresh();};
  cards.set(item.id,card);grid.append(card);
 }
 list.append(auto,grid);shell.append(stage,list);
 const footer=node('div','wardrobe-footer'),change=node('button','wardrobe-change','换上这套'),back=node('button','wardrobe-back','回到小屋');change.type=back.type='button';
 back.onclick=options.close;footer.append(change,back);body.append(shell,footer);
 const selectedItem=()=>world().wardrobe.outfits.find((item:any)=>item.id===selected);
 function refresh(){
  if(disposed)return;
  const current=world().wardrobe.outfit,item=selectedItem();if(!item)return;
  const src=preview(item);
  if(hero.getAttribute('src')!==src){artBox.classList.remove('is-ready','preview-unavailable');imageStatus.textContent='预览加载中…';hero.onload=()=>{artBox.classList.add('is-ready');imageStatus.textContent='';};hero.onerror=()=>{artBox.classList.add('preview-unavailable');imageStatus.textContent='预览暂未加载，仍可选择这套衣服';};hero.src=src;}
  heading.textContent=item.name.replace('（试验）','');description.textContent=item.description||'';
  badge.textContent=selected===current?'正在穿':'已选中';badge.classList.toggle('is-worn',selected===current);
  for(const [id,card] of cards){const worn=id===current;card.setAttribute('aria-pressed',String(id===selected));card.setAttribute('aria-label',(world().wardrobe.outfits.find((x:any)=>x.id===id)?.name||id).replace('（试验）','')+(worn?'，正在穿':''));card.querySelector('small')!.textContent=worn?'正在穿':'';card.disabled=busy;}
  auto.textContent=world().wardrobe.auto!==false?'每天随机换装：开':'每天随机换装：关';auto.setAttribute('aria-pressed',String(world().wardrobe.auto!==false));auto.disabled=busy;
  change.disabled=busy||selected===current||world().travel.phase==='away';
  if(!busy)change.textContent=selected===current?'正在穿这套':world().travel.phase==='away'?'等肥鱼回来再换':'换上这套';
  if(world().travel.phase==='away'&&!busy)status.textContent='肥鱼出门了，可以先看看衣服。';
  else if(successful&&!busy)status.textContent='换好啦。';
 }
 change.onclick=async()=>{
  if(busy||disposed)return;const next=selected;busy=true;successful=false;refresh();progress.hidden=false;status.setAttribute('role','status');status.textContent='准备衣服…';change.textContent='加载衣服中…';change.setAttribute('aria-busy','true');
  try{
   await options.prepare(next,value=>{if(!disposed){progress.value=value;status.textContent=`准备衣服 ${Math.round(value*100)}%`; }},abort.signal);
   if(disposed)return;
   status.textContent='衣服准备好了，正在换上…';change.textContent='正在换上…';
   const ok=await options.command('outfit_set',{id:next},change);
   if(disposed)return;
   if(!ok||world().wardrobe.outfit!==next)throw Error('还没有确认换装成功，请稍后重试');
   successful=true;
  }catch(error){if(!disposed){status.setAttribute('role','alert');status.textContent=(error as Error).message;}}
  finally{busy=false;if(!disposed){progress.hidden=true;change.removeAttribute('aria-busy');refresh();}}
 };
 refresh();
 return {refresh,dispose(){disposed=true;abort.abort();hero.onload=hero.onerror=null;}};
}
