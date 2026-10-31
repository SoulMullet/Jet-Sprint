// Move only obstructing scenery; preserve deterministic placement and rock count.
export function clearShoreRock(x,z,radius,nearest){
 const safe=(x,z)=>{const p=nearest(x,z);return Math.hypot(x-p.x,z-p.z)>=(p.waterWidth??9)+radius+2-1e-6;};
 if(safe(x,z))return {x,z};
 let px=x,pz=z;
 for(let i=0;i<12;i++){
  const p=nearest(px,pz),dx=px-p.x,dz=pz-p.z,d=Math.hypot(dx,dz),reach=(p.waterWidth??9)+radius+2.1;
  px=p.x+(d>1e-8?dx/d:1)*reach;pz=p.z+(d>1e-8?dz/d:0)*reach;
  if(safe(px,pz))return {x:px,z:pz};
 }
 // Tight junctions can alternate between banks. Search outward deterministically.
 for(let distance=radius+12;distance<=250;distance+=8)for(let i=0;i<32;i++){
  const a=i*Math.PI/16,px=x+Math.cos(a)*distance,pz=z+Math.sin(a)*distance;
  if(safe(px,pz))return {x:px,z:pz};
 }
 throw Error('No clear shoreline position for scenery rock.');
}
