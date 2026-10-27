import * as THREE from 'three';
import {ShallowWaterSolver} from './solver.js';
import {FluidSurface} from './surface.js';

const automaticResolution={low:64,medium:96,high:128};

// Lifecycle/UI adapter; intentionally has no boat-force or spray integration.
export class WaterSystem {
 constructor(renderer,scene,legacy,{nearest,width,start,quality='medium',onStatus=()=>{}}){
  Object.assign(this,{renderer,scene,legacy,start,onStatus,quality});
  this.options={nearest,width};
  this.mode='simulated';
  this.resolution='auto';
  this.debug=0;
  this.solver=null;
  this.surface=null;
  this.failure='';
  this.rebuild(automaticResolution[quality]||96);
 }
 release(){
  if(this.surface){this.scene.remove(this.surface.mesh);this.surface.dispose();this.surface=null;}
  this.solver?.dispose();
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
    this.surface=new FluidSurface(this.solver,this.legacy.material);
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
   this.surface.uniforms.fluidDebug.value=this.debug;
   this.surface.material.depthTest=this.debug!==3;
   this.surface.mesh.renderOrder=this.debug===3?5:0;
  }
  const status=active?`${this.solver.n}² GPU ${this.solver.support.precision}${this.failure?' · '+this.failure:''}`:this.failure||'Legacy water';
  this.onStatus(status);
 }
 setMode(mode){this.mode=mode;this.show();}
 setResolution(value){
  this.resolution=value;
  const n=value==='auto'?automaticResolution[this.quality]:Number(value);
  if(n!==this.solver?.n)this.rebuild(n);
 }
 setQuality(name){this.quality=name;if(this.resolution==='auto')this.setResolution('auto');}
 setDebug(value){this.debug=Number(value);this.show();}
 disturb(x=this.start.x,z=this.start.z){
  const p=this.options.nearest(x,z);
  return this.solver?.injectForce({x:p.x,z:p.z,radius:2.5,radial:.65});
 }
 reset(){this.solver?.reset();this.surface?.sync();}
 update(dt){
  if(this.mode!=='simulated'||!this.surface||!this.solver?.available)return;
  if(this.renderer.getContext().isContextLost()){
   this.failure='GPU context lost. Reload to restore simulation.';
   this.solver.available=false;
   this.show();
   return;
  }
  this.solver.update(dt);
  this.surface.sync();
 }
}
