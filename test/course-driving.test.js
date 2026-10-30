import test from 'node:test';
import assert from 'node:assert/strict';
import {createCourse} from '../src/course.js';
import {Race,defaults} from '../src/race.js';
import {RouteNavigator} from '../src/navigation.js';
import {stepBoat} from '../src/physics.js';
import {nearestOnTrack} from '../src/track.js';

test('a binary-input test driver completes three laps using the active waterjet integrator',()=>{
 const c=createCourse(),race=new Race(c.gates,6.5,3),nav=new RouteNavigator(c,6.5),start=c.sample(0);
 const boat={x:start.x,z:start.z,angle:Math.atan2(start.tz,start.tx),vx:0,vz:0};
 const nearest=(x,z)=>nearestOnTrack(c.network,x,z),before={x:0,z:0};
 for(let i=0;i<120*600&&!race.done;i++){
  const prev=c.gates[(race.next+c.gates.length-1)%c.gates.length],end=race.next===0?c.length:c.gates[race.next].distance;
  const d=c.project(boat,prev.distance-8,end+25).distance,cue=nav.update(boat,race,1/120);
  const target=cue.wrong?{x:cue.targetX,z:cue.targetZ}:c.sample(d+8);
  const heading=Math.atan2(target.z-boat.z,target.x-boat.x),error=Math.atan2(Math.sin(heading-boat.angle),Math.cos(heading-boat.angle));
  const speed=Math.hypot(boat.vx,boat.vz),desiredSpeed=cue.wrong?8:9;
  before.x=boat.x;before.z=boat.z;
  stepBoat(boat,{throttle:speed<desiredSpeed||(Math.abs(error)>.35&&speed<12),left:error-(boat.yawRate||0)*.3<-.08,right:error-(boat.yawRate||0)*.3>.08},1/120,nearest);
  race.step(before,boat,1/120,defaults);
  assert.ok(Number.isFinite(boat.x)&&Number.isFinite(boat.angle));
 }
 assert.equal(race.done,true,`driver stopped at gate ${race.next}`);assert.equal(race.laps.length,3);
 assert.ok(race.laps.every(t=>t>0));assert.ok(race.total<600);
});
