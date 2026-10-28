import test from 'node:test';
import assert from 'node:assert/strict';
import {createCourse,courseId} from '../src/course.js';
import {trackConfig} from '../src/track-layout.js';
import {channelPolygons,nearestOnTrack} from '../src/track.js';
import {channel,stepBoat} from '../src/physics.js';
const c=createCourse();
test('V2 is reproducible, closed, and has continuous shared-node spline junctions',()=>{
 assert.equal(courseId,'braided-meadows-v2');assert.equal(c.version,2);
 assert.deepEqual(createCourse().line,c.line);
 for(let i=0;i<c.legs.length;i++)assert.ok(c.legs[i].points.at(-1).distanceTo(c.legs[(i+1)%c.legs.length].points[0])<1e-9);
 for(let d=0;d<c.length;d+=.5){const a=c.sample(d),b=c.sample(d+.5),n=nearestOnTrack(c.network,a.x,a.z);assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<.501);assert.ok(Math.hypot(a.x-n.x,a.z-n.z)<.001);}
 const spawn=c.sample(0),boat={...spawn,angle:Math.atan2(spawn.tz,spawn.tx),vx:0,vz:0};stepBoat(boat,{},1/120,(x,z)=>nearestOnTrack(c.network,x,z));assert.ok(Math.hypot(boat.x-spawn.x,boat.z-spawn.z)<1e-8);
});
test('three hairpins and three S sections are present in the prescribed route',()=>{
 for(const id of ['A-B','B-C','C-D']){
  const j=c.junctions.find(j=>j.edgeId===id);let hairpin=0,left=0,right=0;
  for(let d=j.startDistance+20;d<j.distance-20;d++){
   const a=c.sample(d-20),b=c.sample(d+20),angle=Math.atan2(a.tx*b.tz-a.tz*b.tx,a.tx*b.tx+a.tz*b.tz);hairpin=Math.max(hairpin,Math.abs(angle));
  }
  for(let d=j.startDistance+4;d<j.distance-4;d++){const a=c.sample(d-4),b=c.sample(d+4),angle=Math.atan2(a.tx*b.tz-a.tz*b.tx,a.tx*b.tx+a.tz*b.tz);left=Math.min(left,angle);right=Math.max(right,angle);}
  assert.ok(hairpin>2.35,`${id} must turn at least 135 degrees over 40 m`);assert.ok(left<-.15&&right>.15,`${id} must contain flowing alternating curvature`);
 }
 assert.ok(c.cues.length>=8);
});
test('one united water footprint contains several substantial irregular islands',()=>{
 const polygons=channelPolygons(c.network,channel.water);assert.equal(polygons.length,1,'all intersections must unite');
 const area=ring=>Math.abs(ring.slice(1).reduce((s,p,i)=>s+ring[i][0]*p[1]-p[0]*ring[i][1],0)/2);
 const islands=polygons[0].slice(1).filter(r=>area(r)>35);assert.ok(islands.length>=4,`${islands.length} substantial islands`);
 for(const island of islands)assert.ok(island.length>20,'islands need organic curved outlines');
 for(const e of c.edges)for(const p of e.points)assert.ok(Math.max(Math.abs(p.x),Math.abs(p.z))+channel.bank<trackConfig.fluidSize/2);
});
test('shoreline contacts on every new branch match the collision projection',()=>{
 for(const edge of c.edges)for(let i=2;i<edge.points.length-2;i+=5){const a=edge.points[i],b=edge.points[i+1],len=Math.hypot(b.x-a.x,b.z-a.z),nx=-(b.z-a.z)/len,nz=(b.x-a.x)/len;
  for(const side of [-1,1]){const boat={x:a.x+nx*8*side,z:a.z+nz*8*side,angle:0,vx:0,vz:0};stepBoat(boat,{},1/120,(x,z)=>nearestOnTrack(c.network,x,z));const n=nearestOnTrack(c.network,boat.x,boat.z);assert.ok(Math.hypot(boat.x-n.x,boat.z-n.z)<=channel.hullLimit+1e-6);}
 }
});
