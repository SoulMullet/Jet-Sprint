import * as THREE from 'three';
import {HullMotion} from './hull-motion.js';
import {handlingDefaults} from './handling.js';
// Rendering-only pose and engine vibration. Physics continues owning x/z/yaw.
export class BoatPresentation {
 constructor(boat,{tuning=handlingDefaults,sampleWater,fixedStep=false}={}){
  this.motion=new HullMotion(tuning,sampleWater);this.fixedStep=fixedStep;
  this.boat=boat;this.roll=0;this.pitch=0;this.lastSpeed=0;this.uniforms={engineClock:{value:0},engineRPM:{value:900}};
  boat.rotation.order='YXZ';const finishedMaterials=new Set();
  for(const m of boat.children){if(!m.isMesh)continue;const p=m.geometry.attributes.position,w=new Float32Array(p.count);for(let i=0;i<p.count;i++)w[i]=p.getX(i)<-.65&&p.getY(i)>.8?1:0;m.geometry.setAttribute('engineWeight',new THREE.BufferAttribute(w,1));
   const material=m.material;if(finishedMaterials.has(material))continue;finishedMaterials.add(material);const previous=material.onBeforeCompile,cache=material.customProgramCacheKey();material.onBeforeCompile=shader=>{previous?.(shader);Object.assign(shader.uniforms,this.uniforms);shader.vertexShader='attribute float engineWeight;uniform float engineClock,engineRPM;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\ntransformed+=engineWeight*vec3(sin(engineClock*engineRPM*.11),cos(engineClock*engineRPM*.13),sin(engineClock*engineRPM*.09))*.0015;`);};material.customProgramCacheKey=()=> cache+'-engine-vibration';
  }
 }
 reset(){this.roll=this.pitch=this.lastSpeed=0;this.motion.reset();}
 step(b,dt,time){this.motion.update(b,dt,time);}
 update(b,input,dt,time,rpm,top){
  if(!this.fixedStep)this.motion.update(b,dt,time);this.roll=this.motion.roll;this.pitch=this.motion.pitch;
  this.boat.position.set(b.x,-.12+this.motion.heave,b.z);this.boat.rotation.set(this.roll,-b.angle,this.pitch);this.uniforms.engineClock.value=time;this.uniforms.engineRPM.value=rpm;
 }
 // Future GLTFLoader integrations can supply a resolved scene here. Keep the
 // root/seat coordinates/camera contract; normalize the model to the current hull.
 replaceVisual(model){const bounds=new THREE.Box3().setFromObject(model),size=new THREE.Vector3();bounds.getSize(size);if(size.x<=0||!Number.isFinite(size.x))throw Error('Boat model needs finite X-axis length.');const scale=4.7/size.x;model.scale.multiplyScalar(scale);model.position.x-=((bounds.min.x+bounds.max.x)/2)*scale;model.position.z-=((bounds.min.z+bounds.max.z)/2)*scale;this.boat.clear();this.boat.add(model);}
}
