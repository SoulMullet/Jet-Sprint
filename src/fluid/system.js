import * as THREE from 'three';
import {ShallowWaterSolver} from './solver.js';
import {renderGeometry} from './render-geometry.js';
import {FluidSurface} from './surface.js';

const automaticResolution={low:64,medium:96,high:128};

// Lifecycle/UI adapter; intentionally has no boat-force or spray integration.
export class WaterSystem {
 constructor(renderer,scene,legacy,{nearest,width,start,size=144,initialMode='simulated',quality='medium',onStatus=()=>{}}){
  Object.assign(this,{renderer,scene,legacy,start,onStatus,quality});
  this.options={nearest,width,size};
  this.mode=initialMode;
  this.resolution='auto';
  this.debug=0;this.waveScale=2.4;this.timeScale=1;this.repeatWaves=true;this.nextWave=1.25;this.focus={...start};
  this.solver=null;
  this.surface=null;
  this.failure='';
  if(this.mode==='simulated')this.rebuild(automaticResolution[quality]||96);else this.show();
 }
 release(){
  if(this.surface){this.scene.remove(this.surface.mesh);this.surface.dispose();this.surface=null;}
  this.solver?.dispose();this.solver=null;this.surface=null;
 }
 compileSurface(){
  const previous=this.renderer.debug.onShaderError;
  try{
   this.renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{
    throw Error(gl.getProgramInfoLog(program)||gl.getShaderInfoLog(fragment)||'Water surface shader failed');
   };
   this.renderer.compile(this.surface.mesh,new THREE.PerspectiveCamera(),this.scene);
  }finally{this.renderer.debug.onShaderError=previous;}
 }
 rebuild(n){
  this.release();
  for(const candidate of [...new Set([n,64])]){
   try{
    this.solver=new ShallowWaterSolver(this.renderer,{...this.options,resolution:candidate});
    if(!this.solver.available){
     this.failure=this.solver.support.reason;
     if(candidate!==64&&this.failure.startsWith('Fluid initialization failed'))continue;
     break;
    }
    this.renderGeometry??=this.legacy.geometry.attributes.shoreFade?this.legacy.geometry:renderGeometry(this.legacy.geometry,this.options.nearest,this.options.width);
    this.surface=new FluidSurface(this.solver,this.legacy.material,this.legacy.geometry,this.options.nearest,this.options.width,this.renderGeometry);
    this.compileSurface();
    this.scene.add(this.surface.mesh);
    this.surface.sync();
    this.reset();
    this.failure=candidate!==n?'Using the lower-resolution fallback.':'';
    break;
   }catch(error){
    this.failure=`Simulation unavailable: ${error.message}`;
    this.release();
   }
  }
  this.show();
 }
 show(){
  const active=this.mode==='simulated'&&!!this.surface&&this.solver?.available;
  this.legacy.visible=!active;
  if(this.surface){
   this.surface.mesh.visible=active;
   this.surface.uniforms.fluidDebug.value=this.debug;this.surface.uniforms.waveScale.value=this.waveScale;
   this.surface.material.depthTest=true;
   this.surface.mesh.renderOrder=0;
  }
  const status=active?`${this.solver.n}² GPU ${this.solver.support.precision}${this.failure?' · '+this.failure:''}`:this.failure||'Legacy water';
  this.onStatus(status);
 }
 setWaveScale(percent){this.waveScale=Math.max(0,Math.min(300,percent))/100;this.show();}
 setMode(mode){this.mode=mode;if(mode==='simulated'&&!this.solver){const n=this.resolution==='auto'?automaticResolution[this.quality]:Number(this.resolution);this.rebuild(n);return;}if(mode==='legacy')this.release();this.show();}
 setResolution(value){
  this.resolution=value;
  const n=value==='auto'?automaticResolution[this.quality]:Number(value);
  if(this.mode==='simulated'&&n!==this.solver?.n)this.rebuild(n);
 }
 setQuality(name){this.quality=name;if(this.resolution==='auto')this.setResolution('auto');}
 setDebug(value){this.debug=Number(value);this.show();}
 disturb(x=this.start.x,z=this.start.z){
  const p=this.options.nearest(x,z);
  const px=this.options.nearest(p.x+1,p.z),pz=this.options.nearest(p.x,p.z+1);
  const a=Math.hypot(px.x-p.x,px.z-p.z)>Math.hypot(pz.x-p.x,pz.z-p.z)?px:pz;
  const length=Math.hypot(a.x-p.x,a.z-p.z)||1;
  return this.solver?.injectForce({x:p.x,z:p.z,radius:3.5,radial:.5,impulseX:.9*(a.x-p.x)/length,impulseZ:.9*(a.z-p.z)/length});
 }
 reset(){this.nextWave=1.25;this.solver?.reset();this.surface?.sync();}
 update(dt){
  if(this.mode!=='simulated'||!this.surface||!this.solver?.available)return;
  if(this.renderer.getContext().isContextLost()){
   this.failure='GPU context lost. Reload to restore simulation.';
   this.solver.available=false;
   this.show();
   return;
  }
  if(this.repeatWaves&&this.solver.time>=this.nextWave){this.disturb(this.focus.x,this.focus.z);this.nextWave=this.solver.time+1.25;}
  this.solver.update(dt*this.timeScale);
  this.surface.sync();
 }
}
