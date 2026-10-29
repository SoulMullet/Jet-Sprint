import test from 'node:test';
import assert from 'node:assert/strict';
import {stepBoat,settings,channel} from '../src/physics.js';
import {handlingDefaults,physicsControls,handlingKeys,handlingProfiles,forceKeys,planingFactor} from '../src/handling.js';
import {HullMotion,createWaterSampler} from '../src/hull-motion.js';
import {SettingsStore,NamedPresets,settingsKey,SETTINGS_SCHEMA} from '../src/settings.js';
import {Engine} from '../src/audio.js';
import {modified} from '../src/race.js';
import {Race,defaults} from '../src/race.js';
import {createCourse} from '../src/course.js';
import {nearestOnTrack} from '../src/track.js';
const open=(x,z)=>({x,z,index:0}),fresh=()=>({x:0,z:0,angle:0,vx:0,vz:0});
const run=(b,input,seconds,hz=120)=>{for(let i=0;i<Math.round(seconds*hz);i++)stepBoat(b,input,1/hz,open);return b;};
const memory=seed=>{const data=new Map(Object.entries(seed||{}));return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),data};};

test('all force controls measurably change the active waterjet calculation',()=>{
 const saved={...settings};try{
  for(const key of forceKeys){const spec=physicsControls[key],outputs=[];
   for(const value of [spec.min,spec.max]){
    Object.assign(settings,handlingDefaults,{[key]:value});const b={...fresh(),vx:6,vz:4,pump:.6,yawRate:.35};let input={throttle:.8,right:true};
    if(key==='pumpDecay')input={right:true};if(key==='throttleOffSteering'){b.pump=0;b.vx=15;input={right:true};}if(key==='driftRecovery')input={throttle:.8};if(key==='spinoutSensitivity'){b.vx=5;b.vz=12;}
    run(b,input,.3);outputs.push([b.x,b.z,b.vx,b.vz,b.angle,b.yawRate,b.thrust,b.planing]);
   }
   assert.ok(outputs[0].some((v,i)=>Math.abs(v-outputs[1][i])>1e-7),key);
  }
 }finally{Object.assign(settings,saved);}
});
const wave=(x,z,t,out)=>{out.height=.025*Math.sin(x*.9+t*4)+.01*Math.sin(z*.7-t*2.2);out.wake=.02*Math.sin(t*5+x*.8);};
function visualTrace(tuning){const h=new HullMotion(tuning,wave),trace=[];for(let i=0;i<360;i++){const t=i/120,b={...fresh(),vx:10,vz:1,forwardSpeed:10,yawRate:Math.sin(t*5)*.3,lateralAcceleration:Math.sin(t*5)*3,forwardAcceleration:t<1?5:t>2?-7:0,collisionImpulse:i===120?3:0};h.update(b,1/120,t);if(i%11===0)trace.push(h.roll,h.pitch,h.heave);}return trace;}
test('every visual slider changes a measured hull-motion trace, without steering-input roll',()=>{
 for(const [key,s] of Object.entries(physicsControls))if(!s.physical){const a=visualTrace({...handlingDefaults,[key]:s.min}),b=visualTrace({...handlingDefaults,[key]:s.max});assert.ok(a.some((v,i)=>Math.abs(v-b[i])>1e-8),key);}
 const h=new HullMotion();for(let i=0;i<120;i++)h.update({...fresh(),steering:1,throttle:1},1/120,i/120);assert.equal(h.roll,0);assert.equal(h.pitch,0);assert.equal(h.heave,0);
});
test('banking is force driven, symmetric, invertible, bounded, and settles after a turn',()=>{
 const traces=[];for(const sign of [-1,1]){const h=new HullMotion(),b={...fresh(),vx:12,forwardSpeed:12,lateralAcceleration:sign*6,yawRate:sign*.6};for(let i=0;i<180;i++)h.update(b,1/120,i/120);traces.push(h.roll);assert.ok(Math.abs(h.roll)<=9*Math.PI/180+1e-10);b.lateralAcceleration=b.yawRate=0;for(let i=0;i<600;i++)h.update(b,1/120,i/120);assert.ok(Math.abs(h.roll)<1e-6);}
 assert.ok(traces[0]<0&&traces[1]>0);assert.ok(Math.abs(traces[0]+traces[1])<1e-10);
 const h=new HullMotion({...handlingDefaults,invertBank:true});h.update({...fresh(),vx:10,lateralAcceleration:5,yawRate:.4},.1,1);assert.ok(h.roll<0);
});
test('planing rises with speed, acceleration lifts the bow and deceleration settles it',()=>{
 assert.equal(planingFactor(0),0);assert.equal(planingFactor(20),1);const low=new HullMotion(),high=new HullMotion(),accelerating=new HullMotion(),decelerating=new HullMotion();
 for(let i=0;i<240;i++){low.update(fresh(),1/120,i/120);high.update({...fresh(),vx:20,forwardAcceleration:0},1/120,i/120);accelerating.update({...fresh(),vx:20,forwardAcceleration:7},1/120,i/120);decelerating.update({...fresh(),vx:20,forwardAcceleration:-7},1/120,i/120);}
 assert.ok(high.pitch>low.pitch+.04);assert.ok(high.heave>low.heave);assert.ok(accelerating.pitch>high.pitch);assert.ok(decelerating.pitch<high.pitch);
});
test('fixed substeps preserve force and calm-hull results across 30/60/120 Hz',()=>{
 const results=[30,60,120].map(hz=>run(fresh(),{throttle:.8,right:true},2,hz));for(const b of results){assert.ok(Math.hypot(b.x-results[0].x,b.z-results[0].z)<1e-8);assert.ok(Math.abs(b.angle-results[0].angle)<1e-8);}
 const hulls=[30,60,120].map(hz=>{const h=new HullMotion();for(let i=0;i<hz*2;i++)h.update({...fresh(),vx:15,forwardAcceleration:0,lateralAcceleration:3,yawRate:.3},1/hz,(i+1)/hz);return h;});for(const h of hulls){assert.ok(Math.abs(h.roll-hulls[0].roll)<1e-8);assert.ok(Math.abs(h.pitch-hulls[0].pitch)<1e-8);}
});
test('idle steering cannot spin the boat; lifting power strongly reduces steering, with optional assist',()=>{
 const idle=run(fresh(),{right:true},3);assert.equal(idle.angle,0);const powered=run({...fresh(),vx:15,pump:1},{right:true,throttle:true},1),coast=run({...fresh(),vx:15,pump:1},{right:true},1);assert.ok(Math.abs(coast.angle)<Math.abs(powered.angle)*.25);
 const saved=settings.throttleOffSteering;try{settings.throttleOffSteering=.15;const assisted=run({...fresh(),vx:15},{right:true},1);assert.ok(assisted.angle>0);}finally{settings.throttleOffSteering=saved;}
});
test('all slider extremes, slip spinout, bank impacts and invalid input remain finite and bounded',()=>{
 const saved={...settings};try{for(const edge of ['min','max']){for(const [key,r] of Object.entries(physicsControls))settings[key]=r[edge];const b={...fresh(),vx:35,vz:18,pump:1},motion=new HullMotion(settings,wave);for(let i=0;i<1200;i++){stepBoat(b,{throttle:i%240<180,right:i%400<200,left:i%400>=200},1/120,x=>({x,z:0}));motion.update(b,1/120,i/120);assert.ok(Object.values(b).every(Number.isFinite));assert.ok(Math.abs(b.z)<=channel.hullLimit+1e-8);assert.ok(Math.abs(motion.roll)<=settings.maxBankAngle*Math.PI/180+1e-8);for(const key of ['roll','pitch','heave'])assert.ok(Number.isFinite(motion[key]));}}
 const b={x:NaN,z:Infinity,vx:NaN,vz:0,angle:Infinity};stepBoat(b,{throttle:NaN},1/120,open);assert.ok(Object.values(b).every(Number.isFinite));
 }finally{Object.assign(settings,saved);}
});
test('CPU water sampling follows wind controls and wake history, with no random idle shake',()=>{
 const uniforms={summerSpeed:{value:1},summerWaves:{value:.8},hfEnabled:{value:1},hfDetail:{value:2},hfWake:{value:[{x:0,y:0,z:0,w:1}]},summerBoat:{value:{x:0,z:0}}},sample=createWaterSampler(uniforms),a={},b={};sample(1,0,2,a);sample(1,0,2,b);assert.deepEqual(a,b);assert.notEqual(a.wake,0);uniforms.summerWaves.value=0;uniforms.hfWake.value[0].w=0;sample(1,0,2,a);assert.ok(a.height===0);assert.ok(a.wake===0);
});
test('schema-2 migration retains every old tune and unrelated stores; physics-only operations remain isolated',()=>{
 const prior={top:100,steer:85,drift:72,acceleration:25,graphics:'low',masterVolume:37,waveScale:275},storage=memory({[settingsKey]:JSON.stringify({schemaVersion:2,settings:prior}),sound:'SOUND',camera:'CAMERA','jet-sprint-races-v1':'OLD RACES'}),s=new SettingsStore(storage);
 for(const [k,v] of Object.entries(prior))assert.equal(s.values[k],v);assert.equal(s.values.maxBankAngle,9);assert.equal(s.values.physicsPreset,'custom');
 for(const preset of ['balanced','arcade','simulation']){s.set('physicsPreset',preset);s.flush();assert.equal(new SettingsStore(storage).values.physicsPreset,preset);assert.equal(s.values.graphics,'low');assert.equal(s.values.masterVolume,37);}
 s.set('maxBankAngle',15);const text=s.exportPhysicsText();s.resetPhysics('Banking & Roll');assert.equal(s.values.maxBankAngle,9);s.importPhysicsText(text);assert.equal(s.values.maxBankAngle,15);s.flush();assert.equal(JSON.parse(storage.getItem(settingsKey)).schemaVersion,SETTINGS_SCHEMA);assert.equal(storage.getItem('sound'),'SOUND');assert.equal(storage.getItem('camera'),'CAMERA');assert.equal(storage.getItem('jet-sprint-races-v1'),'OLD RACES');assert.equal(s.values.waveScale,275);
 const before=s.exportPhysicsText();assert.throws(()=>s.importPhysicsText('{"schemaVersion":3,"settings":{"maxThrust":"bad"}}'));assert.equal(s.exportPhysicsText(),before);
 const names=new NamedPresets(storage,'jet-sprint-physics-presets-v1'),id=names.save('My boat',text);names.rename(id,'Lake tune');assert.equal(new NamedPresets(storage,'jet-sprint-physics-presets-v1').get(id).name,'Lake tune');names.delete(id);assert.equal(names.records.length,0);s.flush();
});
test('visual-only tuning does not mark a race modified; physics presets and force tuning do',()=>{
 assert.equal(modified({...handlingDefaults,maxBankAngle:25,bounceIntensity:0}),false);assert.equal(modified({...handlingDefaults,maxThrust:18000}),true);assert.equal(modified(handlingProfiles.arcade),true);
});
test('existing V8 tuning stays intact while propulsion load affects live engine load',()=>{
 const a=new Engine(),b=new Engine(),before=JSON.stringify(a.settings);for(let i=0;i<120;i++){a.update(12,true,1/120,85/3.6,false,.1);b.update(12,true,1/120,85/3.6,false,1);}assert.ok(b.load>a.load);assert.equal(JSON.stringify(a.settings),before);assert.equal(JSON.stringify(b.settings),before);
});
test('maximum thrust remains a force ceiling at high acceleration and speed targets',()=>{
 const saved={...settings};try{Object.assign(settings,{maxThrust:9000,acceleration:28,top:180});const b=run(fresh(),{throttle:true},3);assert.ok(b.thrust>8990&&b.thrust<=9000);assert.ok(b.vx>10);}finally{Object.assign(settings,saved);}
});
test('Arcade, Balanced and Simulation-Inspired each complete five ordered laps on the existing course',()=>{
 const c=createCourse(),saved={...settings},nearest=(x,z)=>nearestOnTrack(c.network,x,z);
 try{for(const [name,profile] of Object.entries(handlingProfiles)){
  Object.assign(settings,profile);const race=new Race(c.gates,channel.hullLimit),start=c.sample(0),b={...fresh(),x:start.x,z:start.z,angle:Math.atan2(start.tz,start.tx)},before={x:0,z:0};
  for(let i=0;i<120*600&&!race.done;i++){
   const prev=c.gates[(race.next+c.gates.length-1)%c.gates.length],end=race.next===0?c.length:c.gates[race.next].distance,d=c.project(b,prev.distance-8,end+25).distance,target=c.sample(d+8),error=Math.atan2(Math.sin(Math.atan2(target.z-b.z,target.x-b.x)-b.angle),Math.cos(Math.atan2(target.z-b.z,target.x-b.x)-b.angle)),speed=Math.hypot(b.vx,b.vz);before.x=b.x;before.z=b.z;
   stepBoat(b,{throttle:speed<9||Math.abs(error)>.35&&speed<12,left:error-(b.yawRate||0)*.3<-.08,right:error-(b.yawRate||0)*.3>.08},1/120,nearest);race.step(before,b,1/120,defaults);
  }
  assert.equal(race.done,true,name+' gate '+race.next);assert.equal(race.laps.length,5);
 }}finally{Object.assign(settings,saved);}
});
