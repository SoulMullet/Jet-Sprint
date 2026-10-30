import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CameraSettings,cameraKey,cameraModes,cameraDefaults} from '../src/camera-settings.js';
import {RacingCameras,createCameraObstructionQuery} from '../src/cameras.js';
import {racingBoat} from '../src/visuals.js';
import {createCourse} from '../src/course.js';
import {Race,defaults} from '../src/race.js';
import {stepBoat} from '../src/physics.js';
import {nearestOnTrack} from '../src/track.js';
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),map};};
function setup(){const storage=memory(),prefs=new CameraSettings(storage),perspective=new THREE.PerspectiveCamera(43,1,1,600),system=new RacingCameras(perspective,prefs),model=new THREE.Group(),boat={x:0,z:0,angle:0,vx:16,vz:0};system.resize(1200,800);return {storage,prefs,system,model,boat};}
function update(f,dt=1/60){f.model.position.set(f.boat.x,.1,f.boat.z);f.model.rotation.y=-f.boat.angle;return f.system.update(f.boat,f.model,{x:f.boat.x+10,z:f.boat.z},dt);}
test('camera preference and independent mode tuning survive reload without touching other stores',()=>{
 const storage=memory();storage.setItem('jet-sprint-settings','PHYSICS');storage.setItem('jet-sprint-v8-settings','AUDIO');const p=new CameraSettings(storage,10);assert.equal(p.mode,'classic');assert.equal(p.modes.classic.lag,.1);
 for(const mode of cameraModes)p.set(mode,'lag',.2+cameraModes.indexOf(mode)*.01);p.select('overhead');p.set('overhead','zoom',1.45);
 const restored=new CameraSettings(storage,3);assert.deepEqual(restored.modes,p.modes);assert.equal(restored.mode,'overhead');assert.equal(storage.getItem('jet-sprint-settings'),'PHYSICS');assert.equal(storage.getItem('jet-sprint-v8-settings'),'AUDIO');
 restored.reset();assert.equal(restored.mode,'classic');assert.deepEqual(restored.modes,cameraDefaults);
});
test('malformed or unavailable storage falls back; finite camera limits remain enforced',()=>{
 const s=memory();s.setItem(cameraKey,'{');const p=new CameraSettings(s);assert.equal(p.mode,'classic');p.set('chase','height',-500);assert.equal(p.modes.chase.height,3);assert.throws(()=>p.set('classic','fov',NaN));assert.throws(()=>p.select('bad'));
 const denied=new CameraSettings({getItem(){throw Error();},setItem(){throw Error();}});denied.cycle();assert.equal(denied.mode,'chase');assert.ok(denied.warning);
});
test('Classic Arcade defaults reproduce the original framing, look-ahead and response',()=>{
 const f=setup();let camera=update(f);assert.ok(camera.isPerspectiveCamera);assert.ok(Math.abs(f.system.target.x-5.38)<1e-8);const d=52+16/(85/3.6)*5;assert.ok(Math.abs(camera.position.y-d)<1e-8);assert.ok(Math.abs(camera.position.z-d*.62)<1e-8);
 const before=f.system.target.x;f.boat.x=5;update(f);assert.ok(Math.abs(f.system.target.x-(before+(10.38-before)*(1-Math.exp(-8/60))))<1e-8);
});
test('drift and reverse velocity cannot flip chase/cockpit heading; yaw takes shortest wrap',()=>{
 for(const mode of ['chase','cockpit']){const f=setup();f.prefs.select(mode);update(f);f.boat.vx=-20;f.boat.vz=14;update(f);assert.equal(f.system.heading,0);f.boat.angle=Math.PI;update(f);if(mode==='chase')assert.ok(Math.abs(f.system.heading)<.05);else assert.ok(Math.abs(Math.atan2(Math.sin(f.boat.angle-f.system.heading),Math.cos(f.boat.angle-f.system.heading)))<=.351);f.system.reset();f.boat.angle=Math.PI-.01;update(f);f.boat.angle=-Math.PI+.01;update(f);assert.ok(Math.abs(f.system.heading-Math.PI)<.03);}
});
test('all modes resize, follow and rebase after restart without changing boat state',()=>{
 for(const mode of cameraModes){const f=setup();f.prefs.select(mode);let camera=update(f);assert.equal(camera.isOrthographicCamera===true,mode==='overhead');f.system.resize(390,844);
  if(mode==='overhead'){assert.ok(Math.abs((camera.right-camera.left)/(camera.top-camera.bottom)-390/844)<1e-9);const before=camera.projectionMatrix.clone();f.prefs.set(mode,'zoom',1.5);update(f);assert.notDeepEqual(camera.projectionMatrix.elements,before.elements);}else assert.equal(camera.aspect,390/844);
  f.boat.x=40;for(let i=0;i<180;i++)update(f);assert.ok(Math.abs(camera.position.x-40)<20);const before=structuredClone(f.boat);update(f);assert.deepEqual(f.boat,before);
  f.boat.x=-40;f.boat.z=-20;f.system.reset();camera=update(f);assert.ok(Math.abs(camera.position.x+40)<20);for(const v of [...camera.position.toArray(),...camera.quaternion.toArray(),...camera.projectionMatrix.elements])assert.ok(Number.isFinite(v));
 }
});
test('chase boom reacts to real solid geometry and maintains terrain clearance',()=>{
 const obstacle=new THREE.Mesh(new THREE.BoxGeometry(2,8,2),new THREE.MeshBasicMaterial());obstacle.position.set(-6,3,0);obstacle.updateMatrixWorld();const query=createCameraObstructionQuery([obstacle]);assert.ok(query(new THREE.Vector3(0,1,0),new THREE.Vector3(-11,5,0))<.6);
 obstacle.visible=false;assert.equal(query(new THREE.Vector3(0,1,0),new THREE.Vector3(-11,5,0)),1);obstacle.visible=true;
 const f=setup();f.prefs.select('chase');f.system.obstruction=query;const c=update(f);assert.ok(c.position.x>-6);assert.ok(c.position.y>=2.4);
});
test('cockpit uses the real seat and hides only player driver batches',()=>{
 const scene=new THREE.Scene(),boat=racingBoat(scene,{cockpitLayers:true}),f=setup();f.model=boat;f.prefs.select('cockpit');const c=update(f),eye=boat.localToWorld(new THREE.Vector3(.46,1.68,-.35));assert.ok(c.position.distanceTo(eye)<1e-9);assert.ok(c.near<.1);assert.ok(boat.children.some(m=>!c.layers.test(m.layers)));assert.ok(boat.children.some(m=>c.layers.test(m.layers)));assert.ok(boat.children.length<=10);
 f.prefs.select('classic');update(f);assert.ok(boat.children.every(m=>f.system.camera.layers.test(m.layers)));assert.ok(racingBoat(scene).children.every(m=>m.layers.mask===1));
});
test('camera updates during a complete real-physics race are isolated from collisions, gates and timing',()=>{
 const course=createCourse();
 for(const mode of cameraModes){const f=setup();f.prefs.select(mode);const race=new Race(course.gates,6.5,3),start=course.sample(0);Object.assign(f.boat,{x:start.x,z:start.z,angle:Math.atan2(start.tz,start.tx),vx:0,vz:0});const nearest=(x,z)=>nearestOnTrack(course.network,x,z);
  for(let i=0;i<120*300&&!race.done;i++){
   const prev=course.gates[(race.next+course.gates.length-1)%course.gates.length],end=race.next===0?course.length:course.gates[race.next].distance,d=course.project(f.boat,prev.distance-8,end+25).distance,target=course.sample(d+8),error=Math.atan2(Math.sin(Math.atan2(target.z-f.boat.z,target.x-f.boat.x)-f.boat.angle),Math.cos(Math.atan2(target.z-f.boat.z,target.x-f.boat.x)-f.boat.angle)),speed=Math.hypot(f.boat.vx,f.boat.vz),before={x:f.boat.x,z:f.boat.z};
   stepBoat(f.boat,{throttle:speed<9||Math.abs(error)>.35&&speed<12,left:error-(f.boat.yawRate||0)*.3<-.08,right:error-(f.boat.yawRate||0)*.3>.08},1/120,nearest);race.step(before,f.boat,1/120,defaults);
   if(i%4===0)update(f,1/30);
  }
  assert.equal(race.done,true,mode);assert.equal(race.laps.length,3);
  const finishTime=race.total;f.system.update(f.boat,f.model,course.sample(0),1/60,{playing:false});assert.equal(race.total,finishTime);assert.equal(race.done,true);
  // Explicit broadside collision, then follow and snap through the restart.
  const p=course.sample(20);Object.assign(f.boat,{x:p.x-p.tz*8,z:p.z+p.tx*8,vx:-p.tz*10,vz:p.tx*10});stepBoat(f.boat,{},1/120,nearest);update(f);const n=nearest(f.boat.x,f.boat.z);assert.ok(Math.hypot(f.boat.x-n.x,f.boat.z-n.z)<=6.5+1e-6);
 }
});

test('chase tuning extremes retain the boat inside the portrait view',()=>{
 for(const distance of [6,26])for(const height of [3,14]){
  const f=setup();f.prefs.select('chase');f.system.resize(390,844);f.prefs.set('chase','distance',distance);f.prefs.set('chase','height',height);f.prefs.set('chase','fov',35);f.prefs.set('chase','lookAhead',30);
  const camera=update(f),center=new THREE.Vector3(f.boat.x,1,f.boat.z).project(camera);assert.ok(Math.abs(center.x)<.9&&Math.abs(center.y)<.9,`${distance}, ${height}: ${center.y}`);
 }
});
