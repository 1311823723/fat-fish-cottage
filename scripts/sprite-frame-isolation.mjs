// Split tightly packed single-row artwork along low-alpha seams rather than
// slicing through the next character. No wrapping, rescaling or generated pixels.
export function transparentSeams(data,width,height,columns,step,radius=48){
 const seams=[];
 for(let boundary=1;boundary<columns;boundary++){
  const center=Math.floor(boundary*step),reach=Math.min(radius,Math.floor(step*.22)),left=Math.max(1,center-reach),right=Math.min(width-1,center+reach),span=right-left+1;
  const trace=new Int16Array(height*span);let previous=new Float64Array(span);
  for(let y=0;y<height;y++){
   const current=new Float64Array(span);
   for(let i=0;i<span;i++){
    const x=left+i;
    const alpha=(data[(y*width+x)*4+3]+data[(y*width+x-1)*4+3])/510;
    const cost=alpha*20+Math.pow((x-center)/Math.max(reach,1),2)*.025;
    let index=i,best=y?previous[i]:0;
    if(y)for(let d=-2;d<=2;d++){const p=i+d;if(p<0||p>=span)continue;const candidate=previous[p]+Math.abs(d)*.015;if(candidate<best){best=candidate;index=p;}}
    current[i]=cost+best;trace[y*span+i]=index;
   }previous=current;
  }
  let index=0;for(let i=1;i<span;i++)if(previous[i]<previous[index])index=i;
  const seam=new Int32Array(height);for(let y=height-1;y>=0;y--){seam[y]=left+index;index=trace[y*span+index];}seams.push(seam);
 }
 return seams;
}
export function isolateStrip({data,width,height,columns,step,frameWidth,padding=64}){
 if(!Number.isInteger(columns)||columns<2||columns>16||!Number.isInteger(padding)||padding<8||padding>128||!Number.isInteger(frameWidth)||frameWidth<32||frameWidth+padding*2>512||!Number.isFinite(step)||step<frameWidth||!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>256*256*60||data.length!==width*height*4)throw Error('Invalid strip geometry');
 const seams=transparentSeams(data,width,height,columns,step),cell=frameWidth+padding*2,output=Buffer.alloc(cell*columns*height*4);
 let clipped=0;
 for(let frame=0;frame<columns;frame++){
  const anchor=Math.floor(frame*step);
  for(let y=0;y<height;y++){
   const left=frame===0?0:seams[frame-1][y],right=frame===columns-1?width:seams[frame][y];
   for(let x=left;x<right;x++){
    const dx=x-anchor+padding;
    if(dx<0||dx>=cell){if(data[(y*width+x)*4+3]>8)clipped++;continue;}
    const from=(y*width+x)*4,to=(y*cell*columns+frame*cell+dx)*4;
    data.copy(output,to,from,from+4);
   }
  }
 }
 if(clipped)throw Error('Padding would clip visible artwork');
 return {data:output,width:cell*columns,height,cell,seams};
}
