import {createCampaignAdventure} from '../src/campaign-world.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCourse} from '../src/course.js';
import {nearestOnTrack} from '../src/track.js';
import {createRetroVenue} from '../src/retro-venue.js';
import {venueLayout,spectatorLocations,inSceneryClearing} from '../src/venue-layout.js';
const c=createCourse(),nearest=(x,z)=>nearestOnTrack(c.network,x,z);
test('24 spectators stand on land; dock and moored boat are away from racing corridor',()=>{
 const people=spectatorLocations();assert.equal(people.length,24);assert.equal(people.filter(p=>p.seated).length,9);
 for(const p of people){const n=nearest(p.x,p.z);assert.ok(Math.hypot(p.x-n.x,p.z-n.z)>13);assert.ok(inSceneryClearing(p.x,p.z));}
 const raceNetwork={paths:c.legs.map(e=>e.points)};
 for(const [x,z] of [[venueLayout.dock.x,venueLayout.dock.z],[venueLayout.dock.x+3.5,venueLayout.dock.z+.5]]){const n=nearestOnTrack(raceNetwork,x,z);assert.ok(Math.hypot(x-n.x,z-n.z)>18);}
});
test('static venue is batched, finite, and crowd animation reuses its meshes',()=>{
 const prior=globalThis.document;globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};
 try{
  const scene=new THREE.Scene(),venue=createRetroVenue(scene,nearest);assert.equal(venue.people.length,24);assert.ok(venue.staticMeshes.length<30);
  scene.updateMatrixWorld(true);for(const m of venue.staticMeshes){for(const p of m.geometry.attributes.position.array)assert.ok(Number.isFinite(p));}
  const count=scene.children.length,arms=venue.animated.children.find(m=>m.isInstancedMesh&&m.count===48&&m.instanceMatrix.usage===THREE.DynamicDrawUsage),before=arms.instanceMatrix.version;
  for(let i=0;i<120;i++)venue.update(1/60,{x:29,z:24});
  assert.equal(scene.children.length,count);assert.ok(arms.instanceMatrix.version>before);for(const p of arms.instanceMatrix.array)assert.ok(Number.isFinite(p));
 }finally{globalThis.document=prior;}
});

test('original large shoreline masses no longer overlap the first river or circuit',()=>{
 const prior=globalThis.document;globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};
 try{const world=createCampaignAdventure(),venue=createRetroVenue(new THREE.Scene(),world.nearest);let moved=0;
 for(const r of venue.shoreRocks){const before=world.nearest(r.originalX,r.originalZ),after=world.nearest(r.x,r.z);if(Math.hypot(r.originalX-before.x,r.originalZ-before.z)<(before.waterWidth??9)+r.radius)moved++;assert.ok(Math.hypot(r.x-after.x,r.z-after.z)>=(after.waterWidth??9)+r.radius+1.99);}
 assert.ok(moved>0);console.log('Relocated overlapping origin scenery masses:',moved);
 }finally{globalThis.document=prior;}
});
