import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {channelGeometry,nearestOnTrack} from '../src/track.js';
import {course,channel,stepBoat} from '../src/physics.js';
const curve=new THREE.CatmullRomCurve3(course.map(([x,z])=>new THREE.Vector3(x,0,z)),true,'centripetal');
const points=Array.from({length:600},(_,i)=>curve.getPointAt(i/600));
test('union water has consistently upward normals and finite triangles',()=>{
 const g=channelGeometry(points.filter((_,i)=>i%3===0),channel.water);
 const pos=g.attributes.position,norm=g.attributes.normal;
 for(let i=0;i<pos.count;i++){assert.ok(Number.isFinite(pos.getX(i)));assert.ok(norm.getY(i)>.99);}
});
test('continuous projection matches every centerline segment midpoint',()=>{
 for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],x=(a.x+b.x)/2,z=(a.z+b.z)/2,p=nearestOnTrack(points,x,z);assert.ok(Math.hypot(x-p.x,z-p.z)<1e-8);}
});
test('valid channel positions near corners receive no collision penalty',()=>{
 for(let i=0;i<600;i+=3){const p=points[i],t=curve.getTangentAt(i/600);for(const side of [-1,1]){
  const x=p.x-t.z*6*side,z=p.z+t.x*6*side,b={x,z,vx:0,vz:0,angle:0};
  stepBoat(b,{},1/120,(x,z)=>nearestOnTrack(points,x,z));assert.ok(Math.hypot(b.x-x,b.z-z)<1e-8);
 }}
});
