import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {waterNormalTexture,hfWaterUniforms} from '../src/hf-water.js';
import {WaterReflections} from '../src/hf-reflections.js';
import {HFSpray} from '../src/hf-effects.js';
import {HFWake} from '../src/hf-wake.js';
import {firGeometry,HFScenery} from '../src/hf-scenery.js';
import {SummerSettings,detectedSummerPreset,parseSummer} from '../src/summer-settings.js';
import {racingBoat} from '../src/visuals.js';
import {BoatPresentation} from '../src/boat-presentation.js';

test('normal maps are deterministic, mipmapped, finite and reusable without assets',()=>{
 const a=waterNormalTexture(64),b=waterNormalTexture(64);assert.deepEqual(a.image.data,b.image.data);assert.equal(a.wrapS,THREE.RepeatWrapping);assert.equal(a.generateMipmaps,true);
 assert.ok(a.image.data.some(v=>v>200));assert.ok(a.image.data.some(v=>v<100));a.dispose();b.dispose();
});

function reflectionRenderer(){const r={extensions:{has:()=>false},xr:{enabled:true},shadowMap:{autoUpdate:true},toneMapping:THREE.ACESFilmicToneMapping,target:null,getRenderTarget(){return this.target;},setRenderTarget(t){this.target=t;},clear(){},render(scene,camera){this.camera=camera;}};return r;}
test('planar reflections clip below the water plane for perspective and orthographic cameras',()=>{
 for(const camera of [new THREE.PerspectiveCamera(53,1.4,.1,600),new THREE.OrthographicCamera(-20,20,15,-15,.1,600)]){
  const r=reflectionRenderer(),u=hfWaterUniforms(),hidden=new THREE.Object3D(),keepHidden=new THREE.Object3D();keepHidden.visible=false;const reflections=new WaterReflections(r,new THREE.Scene(),u,()=>[hidden,keepHidden]);reflections.configure('medium');
  camera.position.set(0,8,14);camera.lookAt(0,0,0);camera.updateMatrixWorld();reflections.update(.1,camera);assert.equal(reflections.frames,1);assert.equal(r.camera.isOrthographicCamera, camera.isOrthographicCamera);assert.ok(r.camera.position.y<0);assert.equal(hidden.visible,true);assert.equal(keepHidden.visible,false);assert.equal(r.xr.enabled,true);assert.equal(r.shadowMap.autoUpdate,true);assert.equal(r.toneMapping,THREE.ACESFilmicToneMapping);assert.equal(r.target,null);
  const vp=new THREE.Matrix4().multiplyMatrices(r.camera.projectionMatrix,r.camera.matrixWorldInverse),above=new THREE.Vector4(0,1,0,1).applyMatrix4(vp),below=new THREE.Vector4(0,-1,0,1).applyMatrix4(vp);assert.ok(above.z>=-above.w);assert.ok(below.z< -below.w);for(const x of u.hfReflectionMatrix.value.elements)assert.ok(Number.isFinite(x));
  const target=reflections.target;let disposed=false;target.addEventListener('dispose',()=>disposed=true);reflections.configure('off');assert.equal(disposed,true);assert.equal(u.hfReflectionActive.value,0);assert.equal(u.hfReflection.value,null);reflections.dispose();u.hfNormal.value.dispose();
 }
});
test('reflection failure restores render state and degrades to environment reflections',()=>{
 const r=reflectionRenderer(),u=hfWaterUniforms(),object=new THREE.Object3D(),reflections=new WaterReflections(r,new THREE.Scene(),u,()=>[object]);reflections.configure('high');r.render=()=>{throw Error('mock context loss');};const c=new THREE.PerspectiveCamera();c.position.y=10;c.lookAt(0,0,0);
 const warn=console.warn;console.warn=()=>{};try{reflections.update(.1,c);}finally{console.warn=warn;}
 assert.equal(object.visible,true);assert.equal(r.xr.enabled,true);assert.equal(reflections.target,null);assert.equal(reflections.available,false);assert.equal(u.hfReflectionActive.value,0);u.hfNormal.value.dispose();
});
test('GPU spray emits three particle families aft at every heading, without mutating physics',()=>{
 for(const angle of [0,Math.PI/2,Math.PI,-1]){
  const scene=new THREE.Scene(),u=hfWaterUniforms(),spray=new HFSpray(scene,u),b={x:5,z:9,angle,vx:15*Math.cos(angle),vz:15*Math.sin(angle),pump:1,nozzle:.1,yawRate:.5},before={...b};spray.configure(1024,.8);
  for(let i=0;i<30;i++)spray.update(1/60,b,15,{});assert.deepEqual(b,before);assert.equal(scene.children.length,1);assert.equal(spray.mesh.geometry.instanceCount,1024);const kinds=new Set();
  for(let i=0;i<Math.min(spray.cursor,spray.budget);i++){const j=i*4;const along=(spray.births[j]-b.x)*Math.cos(angle)+(spray.births[j+2]-b.z)*Math.sin(angle);if(spray.velocities[j+3]===0)assert.ok(along<-2.3);else assert.ok(along>=-1.61&&along<=-.59);assert.ok(spray.velocities[j]*Math.cos(angle)+spray.velocities[j+2]*Math.sin(angle)<0);kinds.add(spray.styles[j+2]);}
  assert.equal(kinds.size,3);const version=spray.mesh.geometry.attributes.birth.version;spray.update(.02,{...b,vx:0,vz:0,pump:0,yawRate:0},0,{});assert.equal(spray.rate,0);assert.equal(spray.mesh.geometry.attributes.birth.version,version);spray.reset();assert.ok(spray.births.every(v=>v===-1000));spray.dispose();assert.equal(scene.children.length,0);u.hfNormal.value.dispose();
 }
});
test('reverse and lateral motion do not rotate historical foam or grow its fixed pools',()=>{
 const scene=new THREE.Scene(),u=hfWaterUniforms(),wake=new HFWake(scene,u),b={x:0,z:0,angle:0,vx:-10,vz:12};wake.update(.05,b,15,2,1);wake.update(.05,b,15,2,1);assert.ok(wake.mesh.visible);for(let i=0;i<6;i++)assert.ok(wake.positions[i*3]<-2.3);
 const previous=Array.from(wake.samples.slice(0,2));b.angle=Math.PI/2;wake.update(.05,b,15,2,1);assert.deepEqual(Array.from(wake.samples.slice(0,2)),previous);for(let i=0;i<80;i++)wake.update(.05,b,0,2,1);assert.equal(wake.mesh.visible,false);assert.equal(scene.children.length,1);wake.dispose();u.hfNormal.value.dispose();
});
test('four quality presets persist real, distinct rendering budgets; old graphics JSON still imports',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},s=new SummerSettings(storage),values=[];
 for(const name of ['low','medium','high','ultra']){s.preset(name);values.push({...s.values});assert.deepEqual(new SummerSettings(storage).values,s.values);}
 assert.deepEqual(values.map(v=>v.baseQuality),['low','medium','high','ultra']);assert.ok(values[0].sprayCount<values[1].sprayCount&&values[1].sprayCount<values[2].sprayCount);assert.equal(values[0].reflectionQuality,'off');assert.equal(values[3].reflectionQuality,'high');assert.equal(values[3].postQuality,'high');assert.ok(values[3].shadowResolution>values[1].shadowResolution);
 const old=parseSummer(JSON.stringify({type:'jet-sprint-summer-graphics',schema:1,values:{preset:'mobile',exposure:.81,foam:.7}}));assert.equal(old.exposure,.81);assert.equal(old.foam,.7);assert.ok(old.waterDetail);assert.equal(detectedSummerPreset(true,2),'low');assert.equal(detectedSummerPreset(true,8),'medium');assert.equal(detectedSummerPreset(false,8),'high');
});
test('fir near/far geometry stays finite and LOD reduces branch triangles',()=>{
 const a=firGeometry(),b=firGeometry(6,6);assert.ok(b.index.count<a.index.count);for(const g of [a,b]){for(const name of ['position','normal','uv'])for(const n of g.attributes[name].array)assert.ok(Number.isFinite(n));g.dispose();}
});
test('every selected fir retains a matching trunk through density and distance changes',()=>{
 const scene=new THREE.Scene(),material=new THREE.MeshStandardMaterial(),env={trees:Array.from({length:30},(_,i)=>({x:i*4,z:0,size:1,rotation:i})),trunks:new THREE.Mesh(new THREE.CylinderGeometry(),material),crowns:new THREE.Mesh(new THREE.BoxGeometry(),material),ground:material.clone()},shore=new THREE.Mesh(new THREE.PlaneGeometry(),material.clone()),u=hfWaterUniforms();u.summerTime={value:0};
 const scenery=new HFScenery(scene,env,shore,(x,z)=>({x:x+50,z}),u);
 for(const density of [.2,.45,.85,1])for(const distance of [60,120]){scenery.configure({vegetation:density,drawDistance:distance},2);scenery.update(.4,new THREE.Vector3());assert.equal(scenery.trunks.count,scenery.near.count+scenery.far.count);assert.equal(env.trunks.visible,false);assert.equal(env.crowns.visible,false);for(const n of scenery.trunks.instanceMatrix.array)assert.ok(Number.isFinite(n));}
 scenery.dispose();u.hfNormal.value.dispose();
});
test('boat wet fiberglass shader and vibration compose once even with shared cockpit materials',()=>{
 const boat=racingBoat(new THREE.Scene(),{cockpitLayers:true});new BoatPresentation(boat);const material=boat.children.find(m=>m.material.isMeshPhysicalMaterial).material;
 const shader={uniforms:{},vertexShader:THREE.ShaderLib.physical.vertexShader,fragmentShader:THREE.ShaderLib.physical.fragmentShader};material.onBeforeCompile(shader);assert.equal(shader.vertexShader.match(/attribute float engineWeight/g).length,1);assert.ok(shader.fragmentShader.includes('float wet='));assert.ok(shader.fragmentShader.includes('hullPoint'));assert.ok(shader.uniforms.engineRPM);
});
