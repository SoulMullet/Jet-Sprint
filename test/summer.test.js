import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SummerSettings,summerControls,summerKey,parseSummer} from '../src/summer-settings.js';
import {WakeTrail,stern} from '../src/wake-trail.js';
import {pineCrown} from '../src/summer-geometry.js';
import {BoatPresentation} from '../src/boat-presentation.js';
import {WaterSystem} from '../src/fluid/system.js';
import {racingBoat} from '../src/visuals.js';
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};};
test('all graphics controls persist and JSON profiles stay independent from gameplay and V8 data',()=>{
 const storage=memory();storage.setItem('jet-sprint-settings','GAME');storage.setItem('jet-sprint-v8-settings','V8');const s=new SummerSettings(storage);
 for(const [key,r] of Object.entries(summerControls))s.set(key,r.min);s.set('showFPS',true);s.set('baseQuality','high');
 assert.deepEqual(new SummerSettings(storage).values,s.values);assert.equal(storage.getItem('jet-sprint-settings'),'GAME');assert.equal(storage.getItem('jet-sprint-v8-settings'),'V8');
 const text=s.export();s.preset('ultra');s.import(text);assert.equal(s.values.waveIntensity,0);s.preset('mobile');assert.equal(s.values.bloom,0);assert.equal(s.values.shadows,'off');assert.ok(s.values.sprayCount<600);s.reset();assert.ok(s.values.exposure>0);
});
test('graphics import rejects other schemas and nonfinite controls without changing live settings',()=>{
 const s=new SummerSettings(memory()),before=s.export();for(const text of ['{','null','{"schemaVersion":2,"settings":{"top":100}}','{"type":"jet-sprint-summer-graphics","schema":1,"values":{"exposure":"bad"}}']){assert.throws(()=>s.import(text));assert.equal(s.export(),before);}assert.throws(()=>s.set('unknown',3));
 const v=parseSummer('{"type":"jet-sprint-summer-graphics","schema":1,"values":{"shadowResolution":800,"exposure":100}}');assert.equal(v.exposure,1.5);assert.equal(v.shadowResolution,1024);
 const denied=new SummerSettings({getItem(){throw Error();},setItem(){throw Error();}},true);denied.set('foam',.5);assert.ok(denied.warning);assert.equal(denied.values.foam,.5);
});
test('wake origins and all fresh foam vertices lie aft, including reverse and sideways velocity',()=>{
 for(const angle of [0,Math.PI/2,Math.PI,-1]){const scene=new THREE.Scene(),trail=new WakeTrail(scene),b={x:3,z:7,angle,vx:-20,vz:14},p=stern(b,{});assert.ok((p.x-b.x)*Math.cos(angle)+(p.z-b.z)*Math.sin(angle)<-2);
  trail.update(.1,b,20,3,1);trail.mesh.updateMatrixWorld(true);const v=trail.mesh.geometry.attributes.position;
  for(let i=0;i<2;i++){const point=new THREE.Vector3(v.getX(i),v.getY(i),v.getZ(i));assert.ok((point.x-b.x)*Math.cos(angle)+(point.z-b.z)*Math.sin(angle)<-2.3);}
  const count=scene.children.length;for(let i=0;i<300;i++)trail.update(1/60,b,0,1,1);assert.equal(scene.children.length,count);assert.ok(trail.fade.every(a=>a===0));
 }
});
test('smooth pine normals are finite and boat presentation changes no physics state',()=>{
 const g=pineCrown();for(const v of g.attributes.normal.array)assert.ok(Number.isFinite(v));for(let i=12;i<132;i++){const p=g.attributes.position,n=g.attributes.normal;assert.ok(p.getX(i)*n.getX(i)+p.getZ(i)*n.getZ(i)>0);}assert.ok(g.index.count<1800);
 const boat=racingBoat(new THREE.Scene(),{cockpitLayers:true}),view=new BoatPresentation(boat),b={x:0,z:0,angle:.3,vx:18,vz:4},before={...b};for(let i=0;i<120;i++)view.update(b,{left:false,right:true},1/60,i/60,6000,85);assert.deepEqual(b,before);assert.ok(Math.abs(boat.rotation.x)<.15);assert.equal(view.uniforms.engineRPM.value,6000);
 const future=new THREE.Mesh(new THREE.BoxGeometry(10,2,3),new THREE.MeshStandardMaterial());view.replaceVisual(future);assert.equal(boat.children.length,1);const bounds=new THREE.Box3().setFromObject(future);assert.ok(Number.isFinite(bounds.max.x));
});

test('procedural startup and quality changes allocate no fluid solver until requested',()=>{
 const scene=new THREE.Scene(),legacy=new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshStandardMaterial()),water=new WaterSystem({getContext(){throw Error('GPU was accessed');}},scene,legacy,{nearest:(x,z)=>({x,z}),width:9,start:{x:0,z:0},initialMode:'legacy'});water.setQuality('high');water.setResolution('192');water.update(.1);assert.equal(water.solver,null);assert.equal(water.surface,null);assert.equal(legacy.visible,true);
});
