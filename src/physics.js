import {handlingDefaults,planingFactor} from './handling.js';
import {outerSpline} from './track-layout.js';
export const settings={...handlingDefaults,cameraResponse:8,effects:1,sprayDistance:100,waterVolume:100};
export const channel={water:9,bank:10.1,hullLimit:6.5};
export const course=outerSpline;
export const BOAT_MASS=650,REFERENCE_YAW_INERTIA=1500;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(v,a,b)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
const stateKeys=['x','z','vx','vz','angle','pump','nozzle','yawRate'];

// One controller; direct callers are also substepped at no more than 1/120 s.
export function stepBoat(b,input,dt,nearest){
 for(const k of stateKeys)if(!Number.isFinite(b[k]))b[k]=0;
 if(!Number.isFinite(dt)||dt<=0)return nearest(b.x,b.z);
 let remaining=Math.min(dt,.1),p;
 while(remaining>1e-10){const step=Math.min(1/120,remaining);p=integrate(b,input,step,nearest);remaining-=step;}
 return p;
}
function integrate(b,input,dt,nearest){
 const oldX=b.vx,oldZ=b.vz,speed=Math.hypot(oldX,oldZ),max=settings.top/3.6;
 // Normalized analog command; legacy binary callers retain identical behavior.
 const steering=typeof input.steering==='number'?(Number.isFinite(input.steering)?clamp(input.steering,-1,1):0):Number(!!input.right)-Number(!!input.left);
 const throttle=typeof input.throttle==='number'?(Number.isFinite(input.throttle)?clamp(input.throttle,0,1):0):Number(!!input.throttle);
 const response=throttle>b.pump?settings.pumpResponse:settings.pumpDecay;
 b.pump+=(throttle-b.pump)*(1-Math.exp(-dt/response));
 const maxNozzle=settings.nozzleAuthority*Math.PI/180;
 b.nozzle+=(steering*maxNozzle-b.nozzle)*(1-Math.exp(-dt*settings.jetSteeringResponse*settings.steer/75));
 b.nozzle=clamp(b.nozzle,-maxNozzle,maxNozzle);
 // Acceleration tuning changes effective mass/inertia, not the reported jet-force ceiling.
 const peak=settings.maxThrust,gain=(settings.acceleration/21)*Math.max(1,settings.top/120),thrust=peak*b.pump;
 const assistedThrust=peak*settings.throttleOffSteering*Math.min(1,speed/max)*(1-throttle);
 const authority=settings.lowSpeedSteering+(settings.highSpeedSteering-settings.lowSpeedSteering)*Math.min(1,speed/max);
 const moving=smooth(speed+thrust/BOAT_MASS*gain*dt,.15,2);
 const lateralBefore=-oldX*Math.sin(b.angle)+oldZ*Math.cos(b.angle),slipAngle=Math.atan2(lateralBefore,Math.max(.5,Math.abs(oldX*Math.cos(b.angle)+oldZ*Math.sin(b.angle))));
 // Stern reaction force produces yaw; optional slip instability is disabled by default.
 const spin=settings.spinoutSensitivity*smooth(Math.abs(slipAngle),.45,1.1)*Math.min(1,speed/max);
 const torque=(thrust+assistedThrust)*Math.sin(b.nozzle)*1.85/REFERENCE_YAW_INERTIA*gain*authority*moving*(settings.steer/75)-Math.sign(lateralBefore)*spin*2;
 const damping=(settings.yawDamping*(.9+.2*Math.min(1,speed/max))+.12*Math.abs(b.yawRate))*(1-spin*.6);
 b.yawRate=clamp((b.yawRate+torque/settings.yawInertia*dt)*Math.exp(-damping/settings.yawInertia*dt),-4,4);
 b.angle+=b.yawRate*dt;
 const fx=Math.cos(b.angle),fz=Math.sin(b.angle),accel=thrust/BOAT_MASS*gain;
 // Propulsion is the jet vector, without aligning velocity to the hull heading.
 const forwardThrust=accel*Math.cos(b.nozzle),sideThrust=-accel*Math.sin(b.nozzle);
 b.vx+=(fx*forwardThrust-fz*sideThrust)*dt;b.vz+=(fz*forwardThrust+fx*sideThrust)*dt;
 let forward=b.vx*fx+b.vz*fz,lateral=-b.vx*fz+b.vz*fx;
 const centered=1-Math.min(1,Math.abs(b.nozzle)/maxNozzle);
 const grip=settings.lateralResistance*settings.hullGrip*(1-settings.drift/100*.78)*(1+Math.min(1.5,speed/max)*.2)*(1+settings.driftRecovery*centered*.6);
 lateral*=Math.exp(-grip*dt);
 b.planing=planingFactor(Math.max(0,forward),settings);
 const nominal=peak/BOAT_MASS*gain,quadratic=Math.max(0,(nominal-.12*max)/(max*max*max));
 const corner=settings.corneringLoss*Math.min(1,Math.abs(lateral)/Math.max(2,speed))*Math.min(3,Math.abs(b.yawRate))*.35;
 const drag=(.12+forward*forward*quadratic+.1*(1-b.planing))*settings.forwardDrag+corner;
 forward*=Math.exp(-Math.min(30,drag)*dt);
 b.vx=fx*forward-fz*lateral;b.vz=fz*forward+fx*lateral;
 const magnitude=Math.hypot(b.vx,b.vz),limit=max*1.6;
 if(magnitude>limit){b.vx*=limit/magnitude;b.vz*=limit/magnitude;}
 b.x+=b.vx*dt;b.z+=b.vz*dt;
 const p=nearest(b.x,b.z),c=p.collision??p,dx=b.x-c.x,dz=b.z-c.z,d=Math.hypot(dx,dz),hullLimit=c.hullLimit??channel.hullLimit;b.collisionImpulse=0;b.bankDepth=0;
 if(d>hullLimit){
  const nx=dx/d,nz=dz/d;b.bankDepth=d-hullLimit;b.bankNX=nx;b.bankNZ=nz;b.x=c.x+nx*hullLimit;b.z=c.z+nz*hullLimit;
  const outward=b.vx*nx+b.vz*nz;if(outward>0){b.collisionImpulse=outward*1.35;b.vx-=b.collisionImpulse*nx;b.vz-=b.collisionImpulse*nz;}b.vx*=.98;b.vz*=.98;
 }
 b.throttle=throttle;b.steering=steering;b.thrust=thrust;b.jetPower=thrust/13650;
 b.forwardSpeed=b.vx*fx+b.vz*fz;b.lateralSpeed=-b.vx*fz+b.vz*fx;
 b.slipAngle=Math.atan2(b.lateralSpeed,Math.max(.5,Math.abs(b.forwardSpeed)));
 b.forwardAcceleration=((b.vx-oldX)*fx+(b.vz-oldZ)*fz)/dt;
 b.lateralAcceleration=(-(b.vx-oldX)*fz+(b.vz-oldZ)*fx)/dt;
 b.engineLoad=clamp(b.pump*(.55+.25*(1-b.planing)+.2*(1-Math.min(1,Math.max(0,b.forwardSpeed)/max))),0,1);
 return p;
}
