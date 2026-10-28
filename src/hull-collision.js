import {channel} from './physics.js';
// Hull envelope matches the racing boat's bow/stern and beam. Only bank contacts
// change motion; pump/nozzle steering and the free-water integrator are untouched.
const footprint=[[0,0],[2.35,0],[1.45,.8],[1.45,-.8],[-1.9,.86],[-1.9,-.86],[-2.15,0]];
export function resolveHullBanks(boat,nearest){
 const fx=Math.cos(boat.angle),fz=Math.sin(boat.angle),limit=channel.water-.12;
 let contacts=0;
 for(let pass=0;pass<6;pass++){
  let touched=false;
  for(const [forward,side] of footprint){
   const x=boat.x+fx*forward-fz*side,z=boat.z+fz*forward+fx*side,p=nearest(x,z),dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz);
   if(d<=limit+1e-6)continue;
   const nx=dx/d,nz=dz/d,penetration=d-limit;boat.x-=nx*penetration;boat.z-=nz*penetration;
   const outward=boat.vx*nx+boat.vz*nz;if(outward>0){boat.vx-=outward*1.35*nx;boat.vz-=outward*1.35*nz;}
   touched=true;contacts++;
  }
  if(!touched)break;
 }
 return contacts;
}
export {footprint};
