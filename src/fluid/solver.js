import * as THREE from 'three';
import {fluidConfig,stableStep,makeDomain} from './numerics.js';
import {fullscreenVertex,drainFragment,stepFragment,copyFragment} from './shaders.js';
const resolutions=[64,96,128,192];
function dataTexture(values,n,type){const data=type===THREE.HalfFloatType?Uint16Array.from(values,THREE.DataUtils.toHalfFloat):values;const texture=new THREE.DataTexture(data,n,n,THREE.RGBAFormat,type);texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.needsUpdate=true;return texture;}
function target(n,type){return new THREE.WebGLRenderTarget(n,n,{type,format:THREE.RGBAFormat,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:false,stencilBuffer:false,generateMipmaps:false});}
export function detectFluidSupport(renderer){
 const gl=renderer.getContext();if(typeof gl.texStorage2D!=='function')return {supported:false,reason:'WebGL2 is required.'};
 const floatSupport=gl.getExtension('EXT_color_buffer_float'),halfSupport=gl.getExtension('EXT_color_buffer_half_float');
 if(!floatSupport&&!halfSupport)return {supported:false,reason:'Floating-point color render targets are unavailable.'};
 const previous=renderer.getRenderTarget();
 try{for(const type of (floatSupport?[THREE.FloatType,THREE.HalfFloatType]:[THREE.HalfFloatType])){const probe=target(4,type);try{renderer.setRenderTarget(probe);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE)return {supported:true,type,precision:type===THREE.FloatType?'float32':'float16'};}finally{renderer.setRenderTarget(previous);probe.dispose();}}}
 catch{/* Report a usable legacy fallback rather than interrupting the game. */}
 return {supported:false,reason:'Neither RGBA32F nor RGBA16F render targets passed the framebuffer check.'};
}
export class ShallowWaterSolver {
 constructor(renderer,{nearest,width,resolution=96,size=144,domain=null,type=null}={}){
  this.renderer=renderer;this.support=detectFluidSupport(renderer);this.available=false;this.queue=[];this.accumulator=0;this.time=0;this.droppedTime=0;this.size=size;this.nearest=nearest;this.width=width;
  if(!this.support.supported)return;
  this.type=type||this.support.type;
  this.passScene=new THREE.Scene();this.passCamera=new THREE.Camera();this.triangle=new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3)));this.triangle.frustumCulled=false;this.passScene.add(this.triangle);
  this.uniforms={compensatedDepth:{value:this.type===THREE.HalfFloatType},stateMap:{value:null},bedMap:{value:null},drainMap:{value:null},initialMap:{value:null},gridSize:{value:0},stepDt:{value:0},cellSize:{value:0},domainSize:{value:size},injection:{value:new THREE.Vector4()},impulse:{value:new THREE.Vector3()}};
  const material=fragmentShader=>new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,vertexShader:fullscreenVertex,fragmentShader,uniforms:this.uniforms,depthTest:false,depthWrite:false,blending:THREE.NoBlending});
  this.drainMaterial=material(drainFragment);this.stepMaterial=material(stepFragment);this.copyMaterial=material(copyFragment);
  const oldHandler=renderer.debug.onShaderError;
  renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{throw new Error(gl.getProgramInfoLog(program)||gl.getShaderInfoLog(fragment)||'Fluid shader compilation failed');};
  try{this.configure(resolution,domain);this.step();this.reset();this.available=true;}
  catch(error){this.support={supported:false,reason:`Fluid initialization failed: ${error.message}`};this.dispose();}
  finally{renderer.debug.onShaderError=oldHandler;}
 }
 configure(resolution,domain=null){
  if(!resolutions.includes(resolution))throw new Error('Unsupported fluid resolution');
  this.releaseTargets();this.domain=domain||makeDomain(resolution,this.size,this.nearest,this.width);this.n=this.domain.n;this.size=this.domain.size;this.dx=this.domain.dx;this.dt=stableStep(this.dx);
  this.initial=dataTexture(this.domain.initial,this.n,this.type);this.bedTexture=dataTexture(this.domain.terrain,this.n,this.type);
  this.front=target(this.n,this.type);this.back=target(this.n,this.type);this.drain=target(this.n,this.type);
  Object.assign(this.uniforms.gridSize,{value:this.n});this.uniforms.cellSize.value=this.dx;this.uniforms.domainSize.value=this.size;this.uniforms.stepDt.value=this.dt;this.uniforms.initialMap.value=this.initial;this.uniforms.bedMap.value=this.bedTexture;this.uniforms.drainMap.value=this.drain.texture;
  this.reset();
 }
 releaseTargets(){for(const name of ['front','back','drain','initial','bedTexture']){this[name]?.dispose();this[name]=null;}}
 pass(material,destination){
  const r=this.renderer,previous=r.getRenderTarget(),xr=r.xr.enabled,auto=r.autoClear;
  try{r.xr.enabled=false;r.autoClear=false;this.triangle.material=material;r.setRenderTarget(destination);const gl=r.getContext();if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Fluid render target allocation is incomplete');r.render(this.passScene,this.passCamera);}
  finally{r.setRenderTarget(previous);r.xr.enabled=xr;r.autoClear=auto;}
 }
 reset(){if(!this.front)return;this.accumulator=0;this.time=0;this.droppedTime=0;this.queue.length=0;this.pass(this.copyMaterial,this.front);this.pass(this.copyMaterial,this.back);this.uniforms.stateMap.value=this.front.texture;}
 injectForce({x,z,radius=2,impulseX=0,impulseZ=0,radial=0}){
  if(!this.available||this.queue.length>=8||![x,z,radius,impulseX,impulseZ,radial].every(Number.isFinite))return false;
  if(Math.abs(x)>=this.size/2||Math.abs(z)>=this.size/2)return false;
  this.queue.push({x,z,radius:THREE.MathUtils.clamp(radius,this.dx,8),impulseX:THREE.MathUtils.clamp(impulseX,-1,1),impulseZ:THREE.MathUtils.clamp(impulseZ,-1,1),radial:THREE.MathUtils.clamp(radial,-1,1)});return true;
 }
 step(){
  this.uniforms.stateMap.value=this.front.texture;this.pass(this.drainMaterial,this.drain);
  const source=this.queue.shift();this.uniforms.injection.value.set(source?.x||0,source?.z||0,source?.radius||1,source?1:0);this.uniforms.impulse.value.set(source?.impulseX||0,source?.impulseZ||0,source?.radial||0);
  this.pass(this.stepMaterial,this.back);const previous=this.front;this.front=this.back;this.back=previous;this.uniforms.stateMap.value=this.front.texture;this.time+=this.dt;
 }
 update(seconds){
  if(!this.available||seconds<=0)return 0;
  const accepted=Math.min(seconds,this.dt*fluidConfig.maxSubsteps);this.droppedTime+=Math.max(0,seconds-accepted);this.accumulator+=accepted;let steps=0;
  while(this.accumulator+1e-10>=this.dt&&steps<fluidConfig.maxSubsteps){this.step();this.accumulator-=this.dt;steps++;}return steps;
 }
 get texture(){return this.front?.texture;}
 // Explicit, bounded Phase-2 sampling API. Never called by the render/physics loop.
 // Some mobile drivers cannot read half-float targets: return null, keep playing.
 samplePoints(points){if(!this.available||points.length>8)return null;const r=this.renderer,gl=r.getContext();const samples=[];
  try{for(const {x,z} of points){const ix=Math.floor((x+this.size/2)/this.dx),iy=Math.floor((z+this.size/2)/this.dx);if(ix<0||iy<0||ix>=this.n||iy>=this.n){samples.push(null);continue;}
   const data=this.type===THREE.FloatType?new Float32Array(4):new Uint16Array(4);r.readRenderTargetPixels(this.front,ix,iy,1,1,data);if(gl.getError()!==gl.NO_ERROR)return null;const a=this.type===THREE.FloatType?data:Array.from(data,THREE.DataUtils.fromHalfFloat),rawBed=this.domain.bed[iy*this.n+ix],bed=this.type===THREE.HalfFloatType?THREE.DataUtils.fromHalfFloat(THREE.DataUtils.toHalfFloat(rawBed)):rawBed;const h=a[0]+a[3];samples.push({depth:h,elevation:bed+h,u:h>fluidConfig.dry?a[1]/h:0,v:h>fluidConfig.dry?a[2]/h:0,wet:this.domain.mask[iy*this.n+ix]>0&&h>fluidConfig.dry});
  }}catch{return null;}return samples;
 }
 dispose(){this.available=false;this.releaseTargets();for(const m of [this.drainMaterial,this.stepMaterial,this.copyMaterial])m?.dispose();this.triangle?.geometry.dispose();}
}
