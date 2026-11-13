import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import sharp from 'sharp';
import {isolateStrip} from '../scripts/sprite-frame-isolation.mjs';
import {ACTIONS,checkOutfitPack} from '../scripts/check-outfit-pack.mjs';
test('alpha seams recover an overflowing pose without carrying it into the next frame or changing its height',()=>{
 const width=128,height=80,data=Buffer.alloc(width*height*4);
 for(let y=12;y<68;y++)for(let x=16;x<122;x++)if(x<73||x>=92){const index=(y*width+x)*4;data[index]=x<73?255:0;data[index+2]=x>=92?255:0;data[index+3]=255;}
 const fixed=isolateStrip({data,width,height,columns:2,step:64,frameWidth:64,padding:32}),pixel=(frame,x,y)=>fixed.data.subarray((y*fixed.width+frame*fixed.cell+x)*4,(y*fixed.width+frame*fixed.cell+x)*4+4);
 assert.equal(pixel(0,32+70,25)[0],255,'red pose outside its old cell is preserved');
 assert.equal(pixel(1,32+6,25)[3],0,'red neighbor must not appear at the next frame left');
 assert.equal(pixel(1,32+30,25)[2],255);
 const alpha=buffer=>{let sum=0;for(let i=3;i<buffer.length;i+=4)sum+=buffer[i];return sum;};assert.equal(alpha(fixed.data),alpha(data),'no visible pixels duplicated or discarded');
 for(let y=0;y<height;y++)for(let frame=0;frame<2;frame++)for(const x of [0,1,fixed.cell-2,fixed.cell-1])assert.equal(pixel(frame,x,y)[3],0);
 for(let x=0;x<fixed.width;x++)assert.equal(fixed.data[(11*fixed.width+x)*4+3],0,'vertical baseline is unchanged');
});
test('a costume with visible pixels crossing frame edges fails before installation',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'fatfish-frame-guard-'));
 try{
  const frame=Buffer.alloc(256*256*4);for(let y=70;y<110;y++)frame[(y*256)*4+3]=255;
  await sharp(frame,{raw:{width:256,height:256,channels:4}}).png().toFile(path.join(dir,'frame.png'));
  await fs.writeFile(path.join(dir,'outfit.json'),JSON.stringify({id:'unsafe',name:'edge sample',actions:Object.fromEntries(ACTIONS.map(name=>[name,{file:'frame.png',frames:1,fps:4}]))}));
  const result=await checkOutfitPack(dir);assert.equal(result.ok,false);assert(result.errors.some(error=>error.includes('可能串帧')));
 }finally{await fs.unlink(path.join(dir,'frame.png'));await fs.unlink(path.join(dir,'outfit.json'));await fs.rmdir(dir);}
});
test('all shipped outfits pass transparent-edge checks including padded repaired actions',async()=>{
 for(const id of ['whale_knit','whale_hood','cream_hoodie','cat_paw','whale_pajamas']){
  const result=await checkOutfitPack(path.resolve('public/assets/outfits',id));assert.equal(result.ok,true,result.errors.join('\n'));
 }
});
