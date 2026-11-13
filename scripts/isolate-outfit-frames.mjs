import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {ROOT} from '../src/config.mjs';
import {isolateStrip} from './sprite-frame-isolation.mjs';
export async function isolateOutfit(directory,{apply=false}={}){
 const dir=path.resolve(directory),manifestFile=path.join(dir,'outfit.json'),manifest=JSON.parse(await fs.readFile(manifestFile,'utf8'));
 if((await fs.lstat(dir)).isSymbolicLink()||!/^[a-z][a-z0-9_-]{0,39}$/.test(manifest.id))throw Error('Invalid outfit directory');
 const entries=Object.entries(manifest.actions||{});
 if(entries.every(([,a])=>a.grid?.padding>=64))return {changed:false,alreadyIsolated:true};
 const plans=[];
 for(const [name,a] of entries){
  if(!/^[a-z][a-z0-9_]{0,39}$/.test(name)||a.grid?.padding)throw Error('Partial or invalid isolation state');
  const g=a.grid;if(!g||a.frames!==g.columns||g.columnStep<g.width||g.columns<2)throw Error('Only single-row grid strips are supported; prepare other layouts manually');
  const filename=a.file.replace(/-runtime-[a-f0-9]{12}\.webp$/,'.png');
  if(!/^[-a-zA-Z0-9_]+\.png$/.test(filename))throw Error('Original PNG is required');
  const source=path.join(dir,filename);if(!(await fs.lstat(source)).isFile())throw Error('Source must be a regular PNG');
  const image=await sharp(source).metadata();if(Math.abs(image.width-g.columns*g.columnStep)>1)throw Error('Strip width disagrees with the grid');
  plans.push({name,a,source,filename});
 }
 if(!apply)return {changed:false,actions:plans.length,requiresApply:true};
 const backup=path.join(ROOT,'state/backups/frame-isolation-'+manifest.id+'-'+Date.now());await fs.mkdir(backup,{recursive:true});
 await fs.copyFile(manifestFile,path.join(backup,'outfit.json'));
 for(const plan of plans)await fs.copyFile(plan.source,path.join(backup,plan.filename));
 const catalogFile=path.resolve(dir,'../..','outfits-v1.json');
 let catalog;try{catalog=JSON.parse(await fs.readFile(catalogFile,'utf8'));await fs.copyFile(catalogFile,path.join(backup,'catalog.json'));}catch(error){if(error.code!=='ENOENT')throw error;}
 try{
  for(const plan of plans){
   const {data,info}=await sharp(plan.source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   const g=plan.a.grid,fixed=isolateStrip({data,width:info.width,height:info.height,columns:g.columns,step:g.columnStep,frameWidth:g.width,padding:64});
   const temp=plan.source+'.isolation.tmp';await sharp(fixed.data,{raw:{width:fixed.width,height:fixed.height,channels:4}}).png().toFile(temp);await fs.rename(temp,plan.source);
   plan.a.file=plan.filename;plan.a.grid={...g,width:fixed.cell,columnStep:fixed.cell,padding:64};
  }
  await fs.writeFile(manifestFile,JSON.stringify(manifest,null,2)+'\n');
  const item=catalog?.outfits?.find(item=>item.id===manifest.id);
  if(item){item.actions=Object.fromEntries(Object.entries(manifest.actions).map(([name,a])=>[name,{...a,file:'/assets/outfits/'+manifest.id+'/'+a.file}]));await fs.writeFile(catalogFile,JSON.stringify(catalog,null,2)+'\n');}
 }catch(error){for(const plan of plans)await fs.copyFile(path.join(backup,plan.filename),plan.source);await fs.copyFile(path.join(backup,'outfit.json'),manifestFile);if(catalog)await fs.copyFile(path.join(backup,'catalog.json'),catalogFile);throw error;}
 return {changed:true,actions:plans.length,backupSaved:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const dir=process.argv[2];if(!dir)throw Error('Usage: node scripts/isolate-outfit-frames.mjs <pack-directory> [--apply]');
 console.log(JSON.stringify(await isolateOutfit(dir,{apply:process.argv.includes('--apply')})));
}
