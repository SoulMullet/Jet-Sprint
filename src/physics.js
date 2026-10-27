import {handlingDefaults} from './handling.js';
export const settings = { ...handlingDefaults, cameraResponse:8, effects:1, sprayDistance:100, waterVolume:100 };
export const channel = { water:7.3, bank:8.4, hullLimit:6.5 };
export const course = [[0, -35],[25,-34],[37,-19],[25,-3],[35,15],[23,33],[0,36],[-27,30],[-36,12],[-22,-2],[-34,-20],[-23,-34]].map(([x,z])=>[x*1.42,z*1.42]);
// Pump thrust is independent of hull speed. Engine revving while staged never
// calls this integrator, so neither thrust nor angular momentum can accumulate.
export function stepBoat(b,input,dt,nearest) {
 const speed=Math.hypot(b.vx,b.vz),max=settings.top/3.6;
 const steering=Number(!!input.right)-Number(!!input.left);
 const throttle=typeof input.throttle==='number'?Math.max(0,Math.min(1,input.throttle)):Number(!!input.throttle);
 const response=throttle>(b.pump||0)?settings.pumpResponse:settings.pumpDecay;
 b.pump=(b.pump||0)+(throttle-(b.pump||0))*(1-Math.exp(-dt/response));
 const nozzleTarget=steering*settings.nozzleAuthority*Math.PI/180;
 b.nozzle=(b.nozzle||0)+(nozzleTarget-(b.nozzle||0))*(1-Math.exp(-dt*12*settings.steer/75));
 // Stern jet reaction produces yaw torque; hull drag dissipates yaw smoothly.
 // A moving hull with a dead pump receives no steering torque (no rudder).
 const yaw=b.yawRate||0;
 const torque=b.pump*Math.sin(b.nozzle)*17*(settings.steer/75);
 const damping=settings.yawDamping*(.9+.2*Math.min(1,speed/max))+.12*Math.abs(yaw);
 b.yawRate=(yaw+torque*dt)*Math.exp(-damping*dt);
 b.angle+=b.yawRate*dt;
 const fx=Math.cos(b.angle),fz=Math.sin(b.angle);
 const thrust=settings.acceleration*Math.max(1,settings.top/120)*b.pump;
 const forwardThrust=thrust*Math.cos(b.nozzle),sideThrust=-thrust*Math.sin(b.nozzle)*.2;
 b.vx+=(fx*forwardThrust-fz*sideThrust)*dt;
 b.vz+=(fz*forwardThrust+fx*sideThrust)*dt;
 // Resolve resistance in the hull frame without snapping velocity to heading.
 const lateral=-b.vx*fz+b.vz*fx;
 const grip=settings.lateralResistance*(1-settings.drift/100*.78)*(1+speed/max*.2);
 const lost=lateral*(1-Math.exp(-grip*dt));
 b.vx+=fz*lost;b.vz-=fx*lost;
 const drag=.12+speed*speed*(settings.acceleration*Math.max(1,settings.top/120)-.12*max)/(max*max*max);
 b.vx*=Math.exp(-drag*dt);b.vz*=Math.exp(-drag*dt);
 b.x+=b.vx*dt;b.z+=b.vz*dt;
 const p=nearest(b.x,b.z),dx=b.x-p.x,dz=b.z-p.z,d=Math.hypot(dx,dz);
 if(d>channel.hullLimit){const nx=dx/d,nz=dz/d;b.x=p.x+nx*channel.hullLimit;b.z=p.z+nz*channel.hullLimit;const outward=b.vx*nx+b.vz*nz;if(outward>0){b.vx-=outward*1.35*nx;b.vz-=outward*1.35*nz;}b.vx*=.98;b.vz*=.98;}
 return p;
}
