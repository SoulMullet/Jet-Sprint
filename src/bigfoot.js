import * as THREE from 'three';
import {sprayReaches} from './spray.js';
export function createBigfoot(scene,trees,nearest){
 const figure=new THREE.Group();scene.add(figure);figure.visible=false;figure.scale.setScalar(1.4);
 const fur=new THREE.MeshStandardMaterial({color:0x392b23,roughness:.95});
 const bodyGeo=new THREE.SphereGeometry(.5,10,8);
 function part(w,h,d,x,y,z,parent=figure){const m=new THREE.Mesh(bodyGeo,fur);m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 part(1.5,2,.85,0,2.6,0);part(1.8,.65,.9,0,3.4,0);part(.85,.9,.8,0,4,.25);part(.6,.35,.38,0,3.95,.65);
 const tufts=new THREE.InstancedMesh(new THREE.ConeGeometry(.13,.5,5),fur,44);const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),position=new THREE.Vector3(),scale=new THREE.Vector3(1,1,1);for(let i=0;i<44;i++){const a=i*2.4,y=1.9+(i%11)*.15;position.set(Math.cos(a)*.75,y,Math.sin(a)*.43);rotation.setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI);matrix.compose(position,rotation,scale);tufts.setMatrixAt(i,matrix);}tufts.castShadow=true;figure.add(tufts);
 const arms=[-1,1].map(side=>{const pivot=new THREE.Group();pivot.position.set(side*.95,3.5,0);figure.add(pivot);part(.46,2.4,.5,0,-1.05,.1,pivot);return pivot;});
 const legs=[-1,1].map(side=>{const pivot=new THREE.Group();pivot.position.set(side*.43,1.7,0);figure.add(pivot);part(.58,1.65,.6,0,-.8,0,pivot);part(.65,.3,1,0,-1.55,.25,pivot);return pivot;});
 // Deliberate oversized trunks conceal both endpoints; no collision objects added.
 const bark=new THREE.MeshStandardMaterial({color:0x554835}),needles=new THREE.MeshStandardMaterial({color:0x315f42});
 const sites=[];
 for(const tree of trees){
  const end={x:tree.x+6,z:tree.z+2};let safe=true;
  for(let j=0;j<=12;j++){const x=tree.x+j/12*6,z=tree.z+j/12*2,p=nearest(x,z);if(Math.hypot(x-p.x,z-p.z)<12)safe=false;}
  if(!safe)continue;
  for(const t of [tree,end]){const trunk=new THREE.Mesh(new THREE.CylinderGeometry(1.3,1.5,6,7),bark);trunk.position.set(t.x,3,t.z);scene.add(trunk);const crown=new THREE.Mesh(new THREE.ConeGeometry(3.5,9,7),needles);crown.position.set(t.x,9,t.z);scene.add(crown);}
  sites.push({start:tree,end});if(sites.length===10)break;
 }
 let state='normal',reactionTime=0,chaseCooldown=0,hitCooldown=0;
 const trail=Array.from({length:1200},()=>({x:0,z:0}));let trailCount=0;
 function remember(){if(trailCount<trail.length){trail[trailCount].x=figure.position.x;trail[trailCount++].z=figure.position.z;}}
 function safe(x,z){const p=nearest(x,z);return Math.hypot(x-p.x,z-p.z)>10&&trees.every(t=>Math.hypot(x-t.x,z-t.z)>2.2)&&sites.every(s=>[s.start,s.end].every(t=>Math.hypot(x-t.x,z-t.z)>2.2));}
 let cooldown=45+Math.random()*75,age=0,active=null,walking=false;
 const enabled=Math.random()>.2; // Some entire sessions intentionally have no sightings.
 const view=new THREE.Vector3();
 const emissions=Array.from({length:100},()=>({sprayAge:99}));let emissionCursor=0,emissionClock=0;
 return {provoke(boat,vocal){if(!figure.visible||state!=='normal'||chaseCooldown>0||figure.position.distanceTo(new THREE.Vector3(boat.x,0,boat.z))>40)return false;state='chase';reactionTime=0;chaseCooldown=25;trailCount=0;remember();vocal();return true;},update(dt,boat,camera,spray,vocal){
  for(const e of emissions)e.sprayAge+=dt;
  emissionClock+=dt;if(emissionClock>=.03){emissionClock=0;const e=emissions[emissionCursor++%emissions.length];Object.assign(e,boat,{sprayAge:0,speed:spray.speed,distance:spray.distance,volume:spray.volume,throttle:spray.throttle});}
  chaseCooldown=Math.max(0,chaseCooldown-dt);hitCooldown=Math.max(0,hitCooldown-dt);
  if(figure.visible&&hitCooldown===0&&state!=='retreat'&&state!=='flinch'&&emissions.some(e=>e.sprayAge<2.6&&sprayReaches(figure.position,e,e.speed,e.distance,e.volume))){
   if(state==='normal'){trailCount=0;remember();}state='flinch';reactionTime=0;hitCooldown=8;vocal();
  }
  if(state!=='normal'){
   reactionTime+=dt;
   if(state==='flinch'){arms.forEach((a,i)=>a.rotation.z=(i?1:-1)*2.2);figure.rotation.x=-.2;if(reactionTime>.7){state='retreat';reactionTime=0;}return;}
   if(state==='chase'){
    const dx=boat.x-figure.position.x,dz=boat.z-figure.position.z,d=Math.hypot(dx,dz)||1;
    const near=nearest(figure.position.x,figure.position.z),outX=figure.position.x-near.x,outZ=figure.position.z-near.z;
    const outward=Math.hypot(outX,outZ)||1;let mx=dx/d,mz=dz/d;
    // Remove movement toward the channel; follow its local shoreline tangent.
    const inward=Math.min(0,(mx*outX+mz*outZ)/outward);mx-=inward*outX/outward;mz-=inward*outZ/outward;
    const len=Math.hypot(mx,mz)||1,nx=figure.position.x+mx/len*dt*7,nz=figure.position.z+mz/len*dt*7;
    if(safe(nx,nz)&&trailCount<trail.length){remember();figure.position.set(nx,0,nz);figure.rotation.y=Math.atan2(mx,mz);}else reactionTime=9;
    if(reactionTime>8){state='retreat';reactionTime=0;}
   }else if(state==='retreat'){
    if(trailCount){const target=trail[trailCount-1],dx=target.x-figure.position.x,dz=target.z-figure.position.z,d=Math.hypot(dx,dz),step=dt*9;if(d<=step){figure.position.set(target.x,0,target.z);trailCount--;}else{figure.position.x+=dx/d*step;figure.position.z+=dz/d*step;}figure.rotation.y=Math.atan2(dx,dz);}
    else { // Retrace the known-clear peek/walk corridor back behind its tree.
     const dx=active.start.x-figure.position.x,dz=active.start.z-figure.position.z,d=Math.hypot(dx,dz);if(d<.15){figure.visible=false;active=null;state='normal';cooldown=45+Math.random()*75;return;}const step=Math.min(d,dt*7);figure.position.x+=dx/d*step;figure.position.z+=dz/d*step;
    }
   }
   for(let i=0;i<2;i++){legs[i].rotation.x=Math.sin(reactionTime*12+i*Math.PI)*.7;arms[i].rotation.set(-legs[i].rotation.x,0,0);}figure.rotation.x=.2;return;
  }
  if(!enabled)return;
  if(!active){cooldown-=dt;if(cooldown>0)return;
   active=sites.find(s=>{view.set(s.start.x,2,s.start.z).project(camera);const d=Math.hypot(s.start.x-boat.x,s.start.z-boat.z);return d>12&&d<42&&Math.abs(view.x)>.35&&Math.abs(view.x)<.9&&Math.abs(view.y)<.75;});
   if(!active){cooldown=4;return;}walking=Math.random()<.25;age=0;figure.visible=true;
  }
  age+=dt;const duration=walking?11:8,u=Math.min(1,age/duration),reveal=Math.sin(Math.PI*u)**2;
  const {start,end}=active;
  // Start/end exactly inside trunks; gradual movement prevents visible teleporting.
  figure.position.set(start.x+(walking?(end.x-start.x)*u:reveal*1.8),0,start.z+(walking?(end.z-start.z)*u:0));
  figure.rotation.set(.12,walking?Math.atan2(end.x-start.x,end.z-start.z):Math.atan2(boat.x-start.x,boat.z-start.z),walking?0:-reveal*.12);
  for(let i=0;i<2;i++){const swing=walking?Math.sin(age*4+i*Math.PI)*.45:0;legs[i].rotation.x=swing;arms[i].rotation.x=-swing*.8;}
  if(age>=duration){figure.visible=false;active=null;cooldown=45+Math.random()*75;}
 }};
}
