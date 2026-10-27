// Projection is restricted to the current ordered route corridor. A nearby
// crossing or the second visit to the same channel cannot jump lap progress.
export function projectRoute(line,length,point,min,max,out={}) {
 let best=Infinity;
 for(let cycle=Math.floor(min/length);cycle<=Math.floor(max/length);cycle++){
  const offset=cycle*length;
  for(let i=0;i<line.length;i++){
   const a=line[i],b=line[(i+1)%line.length],start=a.distance+offset,end=(i+1===line.length?length:b.distance)+offset;
   if(end<min||start>max)continue;
   const dx=b.x-a.x,dz=b.z-a.z,span=end-start;
   const low=Math.max(0,(min-start)/span),high=Math.min(1,(max-start)/span);
   const t=Math.max(low,Math.min(high,((point.x-a.x)*dx+(point.z-a.z)*dz)/(dx*dx+dz*dz||1)));
   const x=a.x+t*dx,z=a.z+t*dz,error=(point.x-x)**2+(point.z-z)**2;
   if(error<best){best=error;out.x=x;out.z=z;out.distance=start+t*span;out.edgeId=a.edgeId;}
  }
 }
 out.error=Math.sqrt(best);return out;
}
