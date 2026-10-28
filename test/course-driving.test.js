import test from 'node:test';
import assert from 'node:assert/strict';
import {createCourse} from '../src/course.js';
import {Race,defaults} from '../src/race.js';
import {RouteNavigator} from '../src/navigation.js';
import {stepBoat} from '../src/physics.js';
import {resolveHullBanks} from '../src/hull-collision.js';
import {nearestOnTrack} from '../src/track.js';

test('a binary-input test driver completes five laps using the unchanged boat integrator',()=>{
 const c=createCourse(),race=new Race(c.gates,6.5),nav=new RouteNavigator(c,6.5),start=c.sample(0);
 const boat={x:start.x,z:start.z,angle:Math.atan2(start.tz,start.tx),vx:0,vz:0};
 const nearest=(x,z)=>nearestOnTrack(c.network,x,z),before={x:0,z:0};
 for(let i=0;i<120*600&&!race.done;i++){
  const prev=c.gates[(race.next+c.gates.length-1)%c.gates.length],end=race.next===0?c.length:c.gates[race.next].distance;
  const d=c.project(boat,prev.distance-8,end+25).distance,cue=nav.update(boat,race,1/120);
  const target=cue.wrong?{x:cue.targetX,z:cue.targetZ}:c.sample(d+6),future=c.sample(d+15),current=c.sample(d);
  const heading=Math.atan2(target.z-boat.z,target.x-boat.x),error=Math.atan2(Math.sin(heading-boat.angle),Math.cos(heading-boat.angle));
  const curvature=Math.acos(Math.max(-1,Math.min(1,current.tx*future.tx+current.tz*future.tz)));
  const speed=Math.hypot(boat.vx,boat.vz),desiredSpeed=cue.wrong?8:curvature>.7?8:curvature>.3?12:20;
  before.x=boat.x;before.z=boat.z;
  stepBoat(boat,{throttle:speed<desiredSpeed||(Math.abs(error)>.35&&speed<13),left:error<-.08,right:error>.08},1/120,nearest);
  resolveHullBanks(boat,nearest);
  race.step(before,boat,1/120,defaults);
  assert.ok(Number.isFinite(boat.x)&&Number.isFinite(boat.angle));
 }
 assert.equal(race.done,true,`driver stopped at gate ${race.next}`);assert.equal(race.laps.length,5);
 assert.ok(race.laps.every(t=>t>0));assert.ok(race.total<600);
});
