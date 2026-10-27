import test from 'node:test';
import assert from 'node:assert/strict';
import {stepBoat,settings} from '../src/physics.js';
import {handlingDefaults} from '../src/handling.js';
const open=(x,z)=>({x,z,index:0});
const boat=()=>({x:0,z:0,vx:0,vz:0,angle:0});
const run=(b,input,seconds)=>{for(let i=0;i<seconds*120;i++)stepBoat(b,input,1/120,open);return b;};
test('stationary or moving dead-pump boat cannot steer like a rudder',()=>{
 for(const vx of [0,20]){const b=boat();b.vx=vx;run(b,{right:true},2);assert.equal(b.angle,0);assert.equal(b.yawRate,0);}
});
test('steering torque follows pump throttle, not forward speed',()=>{
 const low=run(boat(),{right:true,throttle:.3},1),high=run(boat(),{right:true,throttle:true},1);
 assert.ok(high.angle>low.angle*2.5);assert.ok(high.angle>1);
 const released=run(boat(),{throttle:true},1);released.vx=20;const powered={...released};
 run(released,{right:true},1.5);run(powered,{right:true,throttle:true},1.5);
 assert.ok(released.pump<.001);assert.ok(powered.angle>released.angle*5);assert.ok(Math.hypot(released.vx,released.vz)>5);
});
test('slides retain heading-independent velocity and throttle restores control',()=>{
 const b={...boat(),vx:16,vz:7};const original=Math.atan2(b.vz,b.vx);stepBoat(b,{right:true,throttle:true},1/120,open);
 assert.ok(Math.abs(Math.atan2(b.vz,b.vx)-original)<.05);assert.ok(b.vz>6);run(b,{right:true,throttle:true},.5);assert.ok(b.angle>.25);
 run(b,{},1);const yaw=b.yawRate;run(b,{left:true,throttle:true},.5);assert.ok(b.yawRate<yaw-.5);
});
test('all tuning extremes remain finite, nozzle bounded and yaw damped',()=>{
 const saved={...settings};try{for(const factor of [0,1]){Object.assign(settings,{nozzleAuthority:factor?45:10,pumpResponse:factor?.5:.03,pumpDecay:factor?.6:.03,yawDamping:factor?1.5:10,lateralResistance:factor?1:15,steer:factor?100:20});const b=run(boat(),{throttle:true,right:true},10);assert.ok(Object.values(b).every(Number.isFinite));assert.ok(Math.abs(b.nozzle)<=Math.PI/4+.001);const yaw=b.yawRate;run(b,{},4);assert.ok(b.yawRate<yaw*.02);}}finally{Object.assign(settings,saved);}
 assert.equal(handlingDefaults.steer,75);
});
