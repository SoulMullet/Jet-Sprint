import * as THREE from 'three';
// Rendering-only pose and engine vibration. Physics continues owning x/z/yaw.
export class BoatPresentation {
 constructor(boat){
  this.boat=boat;this.roll=0;this.pitch=0;this.lastSpeed=0;this.uniforms={engineClock:{value:0},engineRPM:{value:900}};
  boat.rotation.order='YXZ';
  for(const m of boat.children){if(!m.isMesh)continue;const p=m.geometry.attributes.position,w=new Float32Array(p.count);for(let i=0;i<p.count;i++)w[i]=p.getX(i)<-.65&&p.getY(i)>.8?1:0;m.geometry.setAttribute('engineWeight',new THREE.BufferAttribute(w,1));
   const material=m.material;material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,this.uniforms);shader.vertexShader='attribute float engineWeight;uniform float engineClock,engineRPM;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\ntransformed+=engineWeight*vec3(sin(engineClock*engineRPM*.11),cos(engineClock*engineRPM*.13),sin(engineClock*engineRPM*.09))*.0015;`);};material.customProgramCacheKey=()=> 'summer-engine-vibration';
  }
 }
 reset(){this.roll=this.pitch=this.lastSpeed=0;}
 update(b,input,dt,time,rpm,top){
  const speed=Math.hypot(b.vx,b.vz),fx=Math.cos(b.angle),fz=Math.sin(b.angle),slip=(-b.vx*fz+b.vz*fx)/Math.max(speed,1),accel=(speed-this.lastSpeed)/Math.max(.01,dt);this.lastSpeed=speed;
  this.roll+=((Number(input.left)-Number(input.right))*.045-slip*.035-this.roll)*(1-Math.exp(-dt*8));this.pitch+=(THREE.MathUtils.clamp(-accel*.0015+speed/(top/3.6)*.018,-.035,.035)-this.pitch)*(1-Math.exp(-dt*6));
  this.boat.position.set(b.x,.1+Math.sin(time*2.3)*.012*speed/20,b.z);this.boat.rotation.set(this.roll,-b.angle,this.pitch);this.uniforms.engineClock.value=time;this.uniforms.engineRPM.value=rpm;
 }
 // Future GLTFLoader integrations can supply a resolved scene here. Keep the
 // root/seat coordinates/camera contract; normalize the model to the current hull.
 replaceVisual(model){const bounds=new THREE.Box3().setFromObject(model),size=new THREE.Vector3();bounds.getSize(size);if(size.x<=0||!Number.isFinite(size.x))throw Error('Boat model needs finite X-axis length.');const scale=4.7/size.x;model.scale.multiplyScalar(scale);model.position.x-=((bounds.min.x+bounds.max.x)/2)*scale;model.position.z-=((bounds.min.z+bounds.max.z)/2)*scale;this.boat.clear();this.boat.add(model);}
}
