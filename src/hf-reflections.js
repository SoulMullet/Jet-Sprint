import * as THREE from 'three';

// One obliquely clipped reflection of opaque scenery. Works with either game projection.
// Lower presets release the target; High updates at 20 Hz, Ultra at 30 Hz.
export class WaterReflections {
 constructor(renderer,scene,uniforms,getExcluded=()=>[]){
  Object.assign(this,{renderer,scene,uniforms,getExcluded});this.target=null;this.frames=0;this.elapsed=1;this.available=true;this.warning='';
  this.perspective=new THREE.PerspectiveCamera();this.orthographic=new THREE.OrthographicCamera();this.visibility=[];
  this.position=new THREE.Vector3();this.look=new THREE.Vector3();this.up=new THREE.Vector3();this.normal=new THREE.Vector3(0,1,0);this.plane=new THREE.Plane(this.normal,0);this.clip=new THREE.Vector4();this.corner=new THREE.Vector4();this.size=new THREE.Vector2();
 }
 configure(quality){
  const sizes={off:0,low:256,medium:512,high:1024},size=sizes[quality]||0;this.interval=quality==='high'?1/20:quality==='low'?1/8:1/12;
  if(size===this.sizePx)return;this.disposeTarget();this.sizePx=size;this.elapsed=1;
  if(size&&this.available){const type=this.renderer.extensions.has('EXT_color_buffer_float')?THREE.HalfFloatType:THREE.UnsignedByteType;this.target=new THREE.WebGLRenderTarget(size,size,{type,generateMipmaps:false});this.target.texture.name='HF freshwater planar reflection';this.uniforms.hfReflection.value=this.target.texture;this.validated=false;}
 }
 update(dt,camera){
  this.elapsed+=dt;if(!this.target||!this.available||this.uniforms.hfEnabled.value<.5)return;
  if(this.elapsed<this.interval&&this.lastCamera===camera)return;this.elapsed=0;this.lastCamera=camera;
  const mirror=camera.isOrthographicCamera?this.orthographic:this.perspective;mirror.copy(camera,false);camera.updateMatrixWorld();
  this.position.setFromMatrixPosition(camera.matrixWorld);if(this.position.y<=.05)return;
  camera.getWorldDirection(this.look);this.look.add(this.position);this.position.y*=-1;this.look.y*=-1;
  this.up.set(0,1,0).transformDirection(camera.matrixWorld);this.up.y*=-1;mirror.position.copy(this.position);mirror.up.copy(this.up);mirror.lookAt(this.look);mirror.updateMatrixWorld();
  mirror.projectionMatrix.copy(camera.projectionMatrix);mirror.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
  // Project world positions into the texture before replacing the near clip plane.
  this.uniforms.hfReflectionMatrix.value.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1).multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);
  this.plane.set(this.normal,.015).applyMatrix4(mirror.matrixWorldInverse);this.clip.set(this.plane.normal.x,this.plane.normal.y,this.plane.normal.z,this.plane.constant);
  this.corner.set(Math.sign(this.clip.x),Math.sign(this.clip.y),1,1).applyMatrix4(mirror.projectionMatrixInverse);this.clip.multiplyScalar(2/this.clip.dot(this.corner));
  const p=mirror.projectionMatrix.elements;p[2]=this.clip.x-p[3];p[6]=this.clip.y-p[7];p[10]=this.clip.z-p[11];p[14]=this.clip.w-p[15];mirror.projectionMatrixInverse.copy(mirror.projectionMatrix).invert();
  const renderer=this.renderer,previous=renderer.getRenderTarget(),xr=renderer.xr.enabled,shadows=renderer.shadowMap.autoUpdate,tone=renderer.toneMapping;
  const excluded=this.getExcluded(),visibility=this.visibility;for(let i=0;i<excluded.length;i++)visibility[i]=excluded[i].visible;
  try{
   for(const object of excluded)object.visible=false;renderer.xr.enabled=false;renderer.shadowMap.autoUpdate=false;renderer.toneMapping=THREE.NoToneMapping;
   renderer.setRenderTarget(this.target);if(!this.validated&&renderer.getContext){const gl=renderer.getContext();if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Reflection framebuffer unsupported.');this.validated=true;}renderer.clear();renderer.render(this.scene,mirror);this.uniforms.hfReflectionActive.value=1;this.frames++;
  }catch(error){this.available=false;this.warning='Planar reflection unavailable; sky reflections remain active.';this.disposeTarget();console.warn(this.warning,error.message);}
  finally{for(let i=0;i<excluded.length;i++)excluded[i].visible=visibility[i];renderer.xr.enabled=xr;renderer.shadowMap.autoUpdate=shadows;renderer.toneMapping=tone;renderer.setRenderTarget(previous);}
 }
 disposeTarget(){this.target?.dispose();this.target=null;this.uniforms.hfReflection.value=null;this.uniforms.hfReflectionActive.value=0;}
 dispose(){this.disposeTarget();}
}
