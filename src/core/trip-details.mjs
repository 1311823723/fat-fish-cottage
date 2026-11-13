import outfits from '../../public/assets/outfits-v1.json' with {type:'json'};
import {GEAR} from './catalog.mjs';
import {displayCaption} from './caption.mjs';
const text=(value,max=120)=>typeof value==='string'?value.replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,max):'';
const time=value=>{const at=typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(value)?Date.parse(value):value;return Number.isFinite(at)&&at>0?at:null;};
export function publicWish(value){const wish=text(value);return /\d{5,}|https?:|@|私聊|群聊|群友|主人|账号|验证码|密钥|密码|告诉我|跟我说/.test(wish)?'':wish;}
export function tripDetails(world,id){
 if(!/^[a-f0-9-]{36}$/.test(String(id)))return null;
 const trip=[world.travel.current,...world.travel.pending,...world.travel.history].find(item=>item?.id===id);
 const photos=world.photos.filter(photo=>photo.photoId===id||photo.tripId===id);
 if(!trip&&!photos.length)return null;
 const scene=trip?.photoScene||photos[0]?.scene;
 const outfitId=trip?.outfit||scene?.outfit;
 const outfit=outfits.outfits.find(item=>item.id===outfitId);
 const weather=scene?.weather&&scene.weather.available!==false&&!scene.weather.stale?scene.weather:null,place=text(trip?.place?.label||trip?.place||photos[0]?.place,80);
 const souvenirs=world.souvenirs.filter(item=>item.tripId===id).map(item=>({id:text(item.id,40),label:text(item.label,100)}));
 return {
  id,place,phase:world.travel.current?.id===id?'away':trip?.returnedAt?'returned':'archived',
  departedAt:time(trip?.departedAt),returnedAt:time(trip?.returnedAt),expectedReturnAt:world.travel.current?.id===id?time(trip.returnAt):null,
  wish:publicWish(trip?.intent?.wish),
  outfit:outfitId?{id:text(outfitId,40),name:text(trip?.outfitName||outfit?.name?.replace('（试验）',''),40)||'未记录'}:null,
  backpack:Array.isArray(trip?.backpack)?trip.backpack.flatMap(id=>{const gear=GEAR.find(item=>item[0]===id);return gear?[{id:gear[0],label:gear[1]}]:[]}).slice(0,3):null,
  food:trip?.food?{id:text(trip.food.id,40),label:text(trip.food.label,80)}:null,
  capture:scene||photos[0]?.capturedAt?{at:time(scene?.capturedAt||photos[0]?.capturedAt),phase:text(scene?.phase,20),weather:weather?{kind:text(weather.kind,20),label:text(weather.label,30),temperature:Number.isFinite(weather.temperature)?weather.temperature:null}:null}:null,
  souvenirs,
  photos:photos.map(photo=>({photoId:photo.photoId,assetVersion:text(photo.assetVersion,80)||'original',place:text(photo.place,80)||place,capturedAt:time(photo.capturedAt),caption:displayCaption(photo.caption,photo.place,photo.scene,photo.photoId)})),
  photoStatus:photos.length?'ready':trip?.photo?.status==='pending'?'pending':'unavailable',
 };
}
