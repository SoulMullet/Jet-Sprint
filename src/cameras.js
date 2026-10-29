import * as THREE from 'three';
const clamp=THREE.MathUtils.clamp;
const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

// Query the actual static scenery/terrain, excluding water and the player.
// Reuse the ray, direction vector and intersection array across checks.
export function createCameraObstructionQuery(objects){
 const ray=new THREE.Raycaster(),direction=new THREE.Vector3(),hits=[],visible=[];
 return (target,position)=>{
  direction.subVectors(position,target);const length=direction.length();if(length<.01)return 1;
  direction.multiplyScalar(1/length);ray.set(target,direction);ray.near=.4;ray.far=length;
  hits.length=0;visible.length=0;for(const object of objects)if(object.visible)visible.push(object);ray.intersectObjects(visible,false,hits);
  return hits.length?clamp((hits[0].distance-1.2)/length,.04,1):1;
 };
}
export class RacingCameras {
 constructor(perspective,preferences,obstruction=()=>1){
  this.perspective=perspective;this.overhead=new THREE.OrthographicCamera(-40,40,40,-40,.5,600);
  this.preferences=preferences;this.obstruction=obstruction;this.camera=perspective;
  this.aspect=1;this.mode=null;this.ready=false;this.heading=0;this.boomLimit=Infinity;this.obstructionClock=1;
  this.target=new THREE.Vector3();this.desiredTarget=new THREE.Vector3();this.desiredPosition=new THREE.Vector3();this.eye=new THREE.Vector3();
  this.lastQueryTarget=new THREE.Vector3();this.lastQueryPosition=new THREE.Vector3();
  this.lookMatrix=new THREE.Matrix4();this.lookRotation=new THREE.Quaternion();this.up=new THREE.Vector3(0,1,0);
  this.overhead.up.set(0,0,-1);this.overhead.layers.enable(1);this.perspective.layers.enable(1);
 }
 resize(width,height){
  this.aspect=Math.max(.1,width/Math.max(1,height));this.perspective.aspect=this.aspect;this.perspective.updateProjectionMatrix();this.updateOrtho();
 }
 updateOrtho(){
  const p=this.preferences.modes.overhead;
  if(this.orthoAspect===this.aspect&&this.orthoHeight===p.height&&this.orthoZoom===p.zoom)return;
  this.orthoAspect=this.aspect;this.orthoHeight=p.height;this.orthoZoom=p.zoom;
  const half=30*p.height/65;
  // Retain useful width in portrait, so the boat and nearby banks stay visible.
  const horizontal=this.aspect<1?half:half*this.aspect,vertical=this.aspect<1?half/this.aspect:half;
  const c=this.overhead;c.left=-horizontal;c.right=horizontal;c.top=vertical;c.bottom=-vertical;c.zoom=p.zoom;c.updateProjectionMatrix();
 }
 reset(){this.ready=false;this.obstructionClock=1;this.boomLimit=Infinity;}
 update(boat,model,ahead,dt,{playing=true,top=85,effects=1,overview=false}={}){
  dt=clamp(dt,0,.05);
  const mode=this.preferences.mode,p=this.preferences.modes[mode],speed=Math.hypot(boat.vx,boat.vz);
  const changed=mode!==this.mode;this.mode=mode;
  this.camera=mode==='overhead'?this.overhead:this.perspective;const camera=this.camera;
  camera.layers.set(0);if(mode!=='cockpit')camera.layers.enable(1);
  // A restart is a teleport. Rebase the camera rather than sweep across land.
  const snap=!this.ready||!playing||changed||this.wasOverview!==overview;
  this.wasOverview=overview;
  if(snap){this.heading=boat.angle;this.target.set(boat.x,0,boat.z);this.ready=true;}
  const alpha=1-Math.exp(-Math.min(dt,.05)/p.lag);
  const rate=mode==='cockpit'?2.8:1.8;
  this.heading+=clamp(angleDelta(boat.angle,this.heading)*alpha,-rate*dt,rate*dt);
  // A first-person eye must keep facing out of the real seat at high yaw rates.
  if(mode==='cockpit'){const error=angleDelta(boat.angle,this.heading);this.heading+=error-clamp(error,-.35,.35);}
  const fx=Math.cos(this.heading),fz=Math.sin(this.heading);
  if(mode==='classic'){
   this.desiredTarget.set(boat.x+(ahead.x-boat.x)*.25*p.lookAhead+boat.vx*.18,0,boat.z+(ahead.z-boat.z)*.25*p.lookAhead+boat.vz*.18);
   if(snap)this.target.copy(this.desiredTarget);else this.target.lerp(this.desiredTarget,1-Math.exp(-dt/p.lag*(1+Math.max(0,top/120-1)*.4)));
   if(snap){this.classicHeight=p.height;this.classicDistance=p.distance;}
   else{this.classicHeight+=(p.height-this.classicHeight)*alpha;this.classicDistance+=(p.distance-this.classicDistance)*alpha;}
   const base=this.aspect<1?Math.max(54,35/this.aspect):52,d=base+Math.min(1,speed/(top/3.6))*5*effects;
   this.desiredPosition.set(this.target.x,d*this.classicHeight/52,this.target.z+d*.62*this.classicDistance/52);
   // This is the original elevated follow formula at the default values.
   camera.position.copy(this.desiredPosition);this.up.set(0,1,0);
  }else if(mode==='chase'){
   const lookAhead=Math.min(p.lookAhead,p.distance*.6),lead=Math.min(1,lookAhead/10);
   this.desiredTarget.set(boat.x+fx*lookAhead+(ahead.x-boat.x)*.12*lead,model.position.y+.7,boat.z+fz*lookAhead+(ahead.z-boat.z)*.12*lead);
   if(snap)this.target.copy(this.desiredTarget);else this.target.lerp(this.desiredTarget,alpha);
   this.desiredPosition.set(boat.x-fx*p.distance,model.position.y+p.height,boat.z-fz*p.distance);
   if(snap)camera.position.copy(this.desiredPosition);else camera.position.lerp(this.desiredPosition,alpha);
   // Check at 15 Hz or after 0.8 m of movement, within the 1.2 m safety margin.
   this.obstructionClock+=dt;
   if(this.obstructionClock>=1/15||snap||this.lastQueryTarget.distanceToSquared(this.target)>.64||this.lastQueryPosition.distanceToSquared(camera.position)>.64){
    this.obstructionClock=0;const fraction=this.obstruction(this.target,camera.position);this.boomLimit=fraction<1?this.target.distanceTo(camera.position)*fraction:Infinity;
    this.lastQueryTarget.copy(this.target);this.lastQueryPosition.copy(camera.position);
   }
   const length=this.target.distanceTo(camera.position);
   if(length>this.boomLimit)camera.position.lerpVectors(this.target,camera.position,this.boomLimit/length);
   camera.position.y=Math.max(2.4,camera.position.y);this.up.set(0,1,0);
  }else if(mode==='cockpit'){
   // Eye just ahead of the actual driver helmet; retain the real wheel/deck.
   // Seat anchoring prevents translational lag from entering the engine or crew.
   this.eye.set(.46,p.height,-.35);model.localToWorld(this.eye);camera.position.copy(this.eye);
   this.target.set(this.eye.x+fx*p.lookAhead,this.eye.y-.2,this.eye.z+fz*p.lookAhead);this.up.set(0,1,0);
  }else{
   this.desiredTarget.set(boat.x+(ahead.x-boat.x)*p.lookAhead/40,0,boat.z+(ahead.z-boat.z)*p.lookAhead/40);
   if(snap)this.target.copy(this.desiredTarget);else this.target.lerp(this.desiredTarget,alpha);
   this.desiredPosition.set(this.target.x,p.height,this.target.z+p.distance);
   if(snap)camera.position.copy(this.desiredPosition);else camera.position.lerp(this.desiredPosition,alpha);
   this.up.set(0,0,-1);this.updateOrtho();
  }
  if(overview){this.camera=this.perspective;this.perspective.layers.enable(1);this.perspective.position.set(-6,137,86);this.perspective.lookAt(-6,0,-1);this.perspective.fov=43;this.perspective.near=1;this.perspective.updateProjectionMatrix();return this.camera;}
  this.lookMatrix.lookAt(camera.position,this.target,this.up);this.lookRotation.setFromRotationMatrix(this.lookMatrix);
  if(snap||mode==='classic'||changed&&mode==='cockpit')camera.quaternion.copy(this.lookRotation);else camera.quaternion.slerp(this.lookRotation,alpha);
  if(camera.isPerspectiveCamera){
   const desiredFov=p.fov+(mode==='classic'?Math.min(1,speed/50)*2:0),fov=snap?desiredFov:camera.fov+(desiredFov-camera.fov)*(1-Math.exp(-dt*3)),near=mode==='cockpit'?.06:mode==='classic'?1:.2;
   if(Math.abs(camera.fov-fov)>.001||camera.near!==near){camera.fov=fov;camera.near=near;camera.updateProjectionMatrix();}
  }
  camera.updateMatrixWorld();return camera;
 }
}
