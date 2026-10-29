import test from 'node:test';
import assert from 'node:assert/strict';
import {createCourse,courseId} from '../src/course.js';
import {trackConfig} from '../src/track-layout.js';
import {channelPolygons,nearestOnTrack} from '../src/track.js';
import {channel,stepBoat} from '../src/physics.js';
const c=createCourse();
test('figure eight is reproducible, closed, and has continuous shared-node spline junctions',()=>{
 assert.equal(courseId,'cedar-creek-figure-eight');assert.equal(c.version,3);
 assert.deepEqual(createCourse().line,c.line);
 for(let i=0;i<c.legs.length;i++)assert.ok(c.legs[i].points.at(-1).distanceTo(c.legs[(i+1)%c.legs.length].points[0])<1e-9);
 for(let d=0;d<c.length;d+=.5){const a=c.sample(d),b=c.sample(d+.5),n=nearestOnTrack(c.network,a.x,a.z);assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<.501);assert.ok(Math.hypot(a.x-n.x,a.z-n.z)<.001);}
 const spawn=c.sample(0),boat={...spawn,angle:Math.atan2(spawn.tz,spawn.tx),vx:0,vz:0};stepBoat(boat,{},1/120,(x,z)=>nearestOnTrack(c.network,x,z));assert.ok(Math.hypot(boat.x-spawn.x,boat.z-spawn.z)<1e-8);
});
test('two broad loops cross at one flat shared node in distinct directions',()=>{
 const junctions=c.junctions.filter(j=>j.node==='J');assert.equal(junctions.length,2);
 const a=c.sample(junctions[0].distance),b=c.sample(junctions[1].distance);
 assert.ok(Math.hypot(a.x,a.z)<1e-6&&Math.hypot(b.x,b.z)<1e-6);
 assert.ok(Math.abs(a.tx*b.tx+a.tz*b.tz)<.6,'two different diagonal passes');
 for(const j of junctions){const before=c.sample(j.distance-2),after=c.sample(j.distance+2);assert.ok(before.tx*after.tx+before.tz*after.tz>.99,'crossover must flow straight through');}
 assert.ok(c.length<330&&c.length>250);assert.ok(c.cues.some(c=>c.kind==='left')&&c.cues.some(c=>c.kind==='right'));
});
test('one united water footprint contains exactly two substantial curved islands',()=>{
 const polygons=channelPolygons(c.network,channel.water);assert.equal(polygons.length,1,'all intersections must unite');
 const area=ring=>Math.abs(ring.slice(1).reduce((s,p,i)=>s+ring[i][0]*p[1]-p[0]*ring[i][1],0)/2);
 const islands=polygons[0].slice(1).filter(r=>area(r)>100);assert.ok(islands.length===2,`${islands.length} substantial islands`);
 for(const island of islands)assert.ok(island.length>20,'islands need organic curved outlines');
 for(const e of c.edges)for(const p of e.points)assert.ok(Math.max(Math.abs(p.x),Math.abs(p.z))+channel.bank<trackConfig.fluidSize/2);
});
test('shoreline contacts on every new branch match the collision projection',()=>{
 for(const edge of c.edges)for(let i=2;i<edge.points.length-2;i+=5){const a=edge.points[i],b=edge.points[i+1],len=Math.hypot(b.x-a.x,b.z-a.z),nx=-(b.z-a.z)/len,nz=(b.x-a.x)/len;
  for(const side of [-1,1]){const boat={x:a.x+nx*8*side,z:a.z+nz*8*side,angle:0,vx:0,vz:0};stepBoat(boat,{},1/120,(x,z)=>nearestOnTrack(c.network,x,z));const n=nearestOnTrack(c.network,boat.x,boat.z);assert.ok(Math.hypot(boat.x-n.x,boat.z-n.z)<=channel.hullLimit+1e-6);}
 }
});
