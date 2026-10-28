import test from 'node:test';import assert from 'node:assert/strict';
import {createCourse} from '../src/course.js';import {channelTerrainGeometry,slopedBankGeometry,nearestOnTrack} from '../src/track.js';import {resolveHullBanks,footprint} from '../src/hull-collision.js';import {channel} from '../src/physics.js';
const course=createCourse(),nearest=(x,z)=>nearestOnTrack(course.network,x,z);
test('clipped terrain excludes waterways and sloped shores meet land without square grid artifacts',()=>{
 const terrain=channelTerrainGeometry(course.network,channel.bank),bank=slopedBankGeometry(course.network,channel.bank,channel.water);
 for(const geometry of [terrain,bank]){const p=geometry.attributes.position,n=geometry.attributes.normal;
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),q=nearest(x,z),d=Math.hypot(x-q.x,z-q.z);assert.ok(Number.isFinite(p.getY(i)));assert.ok(n.getY(i)>0);
   if(geometry===terrain)assert.ok(d>=channel.bank-.04,'land must not bridge water');
   else{assert.ok(p.getY(i)>=-.081&&p.getY(i)<=.191);if(d>channel.bank-.01)assert.ok(Math.abs(p.getY(i)-.19)<.002);}
  }
  geometry.dispose();
 }
});
test('bow, stern and beam are projected out of banks without altering free-water motion',()=>{
 for(const edge of course.edges)for(let i=2;i<edge.points.length-2;i+=9){
  const p=edge.points[i],q=edge.points[i+1],angle=Math.atan2(q.z-p.z,q.x-p.x),fx=Math.cos(angle),fz=Math.sin(angle);
  for(const offset of [-6.4,0,6.4]){const boat={x:p.x-fz*offset,z:p.z+fx*offset,vx:fx*20,vz:fz*20,angle,pump:.7,nozzle:.2,yawRate:.1};resolveHullBanks(boat,nearest);
   for(const [forward,side] of footprint){const x=boat.x+fx*forward-fz*side,z=boat.z+fz*forward+fx*side,n=nearest(x,z);assert.ok(Math.hypot(x-n.x,z-n.z)<=channel.water-.1,'hull clips a bank');}
   assert.equal(boat.pump,.7);assert.equal(boat.nozzle,.2);assert.equal(boat.yawRate,.1);
   if(offset===0){assert.ok(Math.hypot(boat.x-p.x,boat.z-p.z)<1e-8);assert.equal(boat.vx,fx*20);}
  }
 }
});
