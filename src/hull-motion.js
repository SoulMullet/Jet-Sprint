import {handlingDefaults,planingFactor} from './handling.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rad=Math.PI/180;
const flat=(_x,_z,_time,out)=>{out.height=out.wake=0;};

// CPU counterpart of the existing rendered wind/wake field. No GPU readbacks.
// The optional shallow-water solver's diagnostic waves are not sampled here.
export function createWaterSampler(uniforms){
 return (x,z,time,out)=>{
  const t=time*uniforms.summerSpeed.value,amplitude=uniforms.summerWaves.value;
  let h=Math.sin(x*.48+z*.23+t*1.15)*.055+Math.sin(x*-.27+z*.63-t*.9)*.035;
  if(uniforms.hfEnabled.value>.5){
   for(let i=0;i<6;i++){if(i>1+uniforms.hfDetail.value*1.5)break;const f=.55+i*.51,a=i*2.39996;h+=Math.sin((x*Math.cos(a)+z*Math.sin(a))*f+t*(.75+i*.24))*.032/(1+i*.8);}
  }
  out.height=h*amplitude;out.wake=0;
  if(uniforms.hfEnabled.value>.5){let turbulence=0;const wakes=uniforms.hfWake.value;
   for(let i=0;i<wakes.length;i++){if(i>3+uniforms.hfDetail.value*7)break;const w=wakes[i],r=.6+w.z*1.2;const dx=x-w.x,dz=z-w.y;turbulence+=Math.exp(-(dx*dx+dz*dz)/(r*r))*w.w*Math.max(0,1-w.z/5);}
   const boat=uniforms.summerBoat.value;out.wake=Math.sin(Math.hypot(x-boat.x,z-boat.z)*5-time*7)*Math.min(1,turbulence)*.025;
  }
 };
}
function spring(state,position,velocity,target,frequency,damping,dt){
 state[velocity]+=(frequency*frequency*(target-state[position])-2*damping*frequency*state[velocity])*dt;
 state[position]+=state[velocity]*dt;
}
export class HullMotion {
 constructor(tuning=handlingDefaults,sampleWater=flat){this.tuning=tuning;this.sampleWater=sampleWater;this.samples=Array.from({length:5},()=>({height:0,wake:0}));this.reset();}
 reset(){this.roll=this.rollVelocity=this.targetRoll=0;this.pitch=this.pitchVelocity=this.targetPitch=0;this.heave=this.heaveVelocity=0;this.lastSpeed=this.lastSurface=this.lastSurfaceVelocity=0;this.planing=this.impact=0;this.surfaceReady=false;}
 update(b,dt,time){
  if(!Number.isFinite(dt)||dt<=0)return;let remaining=Math.min(.1,dt);
  while(remaining>1e-10){const step=Math.min(1/120,remaining);this.step(b,step,time-remaining+step);remaining-=step;}
 }
 step(b,dt,time){
  const s=this.tuning,speed=Math.hypot(b.vx,b.vz),fx=Math.cos(b.angle),fz=Math.sin(b.angle),points=this.samples;
  this.sampleWater(b.x,b.z,time,points[0]);
  this.sampleWater(b.x+fx*1.6,b.z+fz*1.6,time,points[1]);this.sampleWater(b.x-fx*1.6,b.z-fz*1.6,time,points[2]);
  this.sampleWater(b.x-fz*.55,b.z+fx*.55,time,points[3]);this.sampleWater(b.x+fz*.55,b.z-fx*.55,time,points[4]);
  for(const p of points)p.total=p.height+p.wake*s.wakeSensitivity;
  this.planing=speed<.1?0:Number.isFinite(b.planing)?b.planing:planingFactor(Math.max(0,b.forwardSpeed??speed),s);
  const acceleration=clamp(b.forwardAcceleration??(speed-this.lastSpeed)/dt,-12,12);this.lastSpeed=speed;
  const turnAcceleration=clamp((b.lateralAcceleration||0)*.75+(b.forwardSpeed??speed)*(b.yawRate||0)*.25,-24,24);
  const waterRoll=Math.atan2(points[4].total-points[3].total,1.1)*s.hullRocking;
  const limit=s.maxBankAngle*rad,sign=s.invertBank?-1:1;
  this.targetRoll=clamp((Math.atan2(turnAcceleration*.35,9.81)*s.bankIntensity+waterRoll)*sign,-limit,limit);
  const recovery=this.targetRoll*this.roll>=0&&Math.abs(this.targetRoll)<Math.abs(this.roll);
  spring(this,'roll','rollVelocity',this.targetRoll,recovery?s.bankRecovery:s.bankResponse,Math.max(.3,s.bankDamping*(1-s.bankOvershoot*.6)),dt);
  this.roll=clamp(this.roll,-limit,limit);if(Math.abs(this.roll)>=limit&&this.roll*this.rollVelocity>0)this.rollVelocity=0;
  const waterPitch=Math.atan2(points[1].total-points[2].total,3.2)*s.hullRocking;
  this.targetPitch=s.bowLift*rad*(this.planing+Math.max(0,acceleration)/12*.3*(.25+.75*this.planing));
  this.targetPitch+=Math.min(0,acceleration)/12*s.decelerationPitch*rad+Math.min(1,Math.abs(turnAcceleration)/15)*s.turnPitch*rad+waterPitch;
  this.targetPitch=clamp(this.targetPitch,-7*rad,12*rad);spring(this,'pitch','pitchVelocity',this.targetPitch,7,s.pitchDamping,dt);this.pitch=clamp(this.pitch,-7*rad,12*rad);
  const surface=points[0].total,velocity=this.surfaceReady?clamp((surface-this.lastSurface)/dt,-3,3):0;
  this.impact=clamp(Math.max(0,velocity-this.lastSurfaceVelocity)*s.waterImpactResponse*.02+(b.collisionImpulse||0)*s.waterImpactResponse*.004,0,.15);
  this.heaveVelocity+=this.impact*(s.bounceIntensity/.04);this.lastSurface=surface;this.lastSurfaceVelocity=velocity;this.surfaceReady=true;
  const target=surface*(s.bounceIntensity/.04)+this.planing*.045;
  spring(this,'heave','heaveVelocity',clamp(target,-.15,.18),9,s.verticalDamping,dt);this.heave=clamp(this.heave,-.18,.18);
 }
 get outletY(){return Math.max(.035,-.12+this.heave+.34-Math.sin(this.pitch)*2.35);}
}
