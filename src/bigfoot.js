import * as THREE from 'three';
import {sprayReaches} from './spray.js';
export function createBigfoot(scene,trees,nearest){
 const figure=new THREE.Group();figure.name='Bigfoot';scene.add(figure);figure.visible=false;figure.scale.setScalar(1.4);
 const fur=new THREE.MeshStandardMaterial({color:0x392b23,roughness:.95});
 const bodyGeo=new THREE.SphereGeometry(.5,10,8);
 function part(w,h,d,x,y,z,parent=figure){const m=new THREE.Mesh(bodyGeo,fur);m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 part(1.5,2,.85,0,2.6,0);part(1.8,.65,.9,0,3.4,0);
 const head=new THREE.Group();head.position.set(0,4,.25);figure.add(head);part(.85,.9,.8,0,0,0,head);part(.6,.35,.38,0,-.05,.4,head);
 const eyes=new THREE.MeshStandardMaterial({color:0x090c08,roughness:.4});for(const side of [-1,1]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.045,6,5),eyes);eye.position.set(side*.17,.08,.39);head.add(eye);}
 const tufts=new THREE.InstancedMesh(new THREE.ConeGeometry(.13,.5,5),fur,44);const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),position=new THREE.Vector3(),scale=new THREE.Vector3(1,1,1);for(let i=0;i<44;i++){const a=i*2.4,y=1.9+(i%11)*.15;position.set(Math.cos(a)*.75,y,Math.sin(a)*.43);rotation.setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI);matrix.compose(position,rotation,scale);tufts.setMatrixAt(i,matrix);}tufts.castShadow=true;figure.add(tufts);
 const arms=[-1,1].map(side=>{const pivot=new THREE.Group();pivot.position.set(side*.95,3.5,0);figure.add(pivot);part(.46,2.4,.5,0,-1.05,.1,pivot);return pivot;});
 const legs=[-1,1].map(side=>{const pivot=new THREE.Group();pivot.position.set(side*.43,1.7,0);figure.add(pivot);part(.58,1.65,.6,0,-.8,0,pivot);part(.65,.3,1,0,-1.55,.25,pivot);return pivot;});
 const limbs=[...arms,...legs];
 // Reuse the existing forest instead of adding a second set of concealment trees.
 // Every corridor is checked at 35 cm intervals, with room for the actor's body.
 const landClearance=10.6,sites=[];
 function corridorClear(start,end,ownTree){
  const steps=Math.ceil(Math.hypot(end.x-start.x,end.z-start.z)/.35);
  for(let i=0;i<=steps;i++){
   const t=steps?i/steps:0,x=start.x+(end.x-start.x)*t,z=start.z+(end.z-start.z)*t,p=nearest(x,z);
   if(Math.hypot(x-p.x,z-p.z)<landClearance)return false;
   if(trees.some(tree=>tree!==ownTree&&Math.hypot(x-tree.x,z-tree.z)<2.1))return false;
  }
  return true;
 }
 for(const tree of trees){
  const p=nearest(tree.x,tree.z),dx=tree.x-p.x,dz=tree.z-p.z,d=Math.hypot(dx,dz);
  if(d<14||d>32)continue;
  const end={x:p.x+dx/d*10.9,z:p.z+dz/d*10.9};
  if(corridorClear(tree,end,tree))sites.push({start:tree,end,tree});
 }
 let phase='hidden',reaction='normal',active=sites[0]||null,age=0,walkPhase=0;
 let cooldown=45+Math.random()*75,chaseCooldown=0,hitCooldown=0;
 const enabled=Math.random()>.2,view=new THREE.Vector3(),sightRay=new THREE.Ray(),sightTarget=new THREE.Vector3(),crownPoint=new THREE.Vector3();
 const trail=Array.from({length:1200},()=>({x:0,z:0}));let trailCount=0;
 const target={x:0,z:0},path=[{x:0,z:0},{x:0,z:0}];
 const debug={state:'Hidden',reaction:'normal',position:figure.position,distance:0,path,sites:sites.length};
 if(active){figure.position.set(active.start.x,0,active.start.z);Object.assign(path[0],active.start);Object.assign(path[1],active.end);}
 const emissions=Array.from({length:100},()=>({sprayAge:99}));let emissionCursor=0,emissionClock=0;
 const labels={hidden:'Hidden',walking:'Walking to Shore',watching:'Watching Boat',returning:'Returning'};
 function remember(){if(trailCount<trail.length){trail[trailCount].x=figure.position.x;trail[trailCount++].z=figure.position.z;}}
 function hide(){phase='hidden';reaction='normal';figure.visible=false;figure.rotation.x=0;head.rotation.y=0;age=0;trailCount=0;cooldown=45+Math.random()*75;for(const limb of limbs)limb.rotation.set(0,0,0);}
 function moveTo(point,speed,dt){
  const dx=point.x-figure.position.x,dz=point.z-figure.position.z,d=Math.hypot(dx,dz),step=Math.min(d,speed*dt);
  if(d>.001){figure.position.x+=dx/d*step;figure.position.z+=dz/d*step;figure.rotation.y=Math.atan2(dx,dz);walkPhase+=step*3.2;}
  for(let i=0;i<2;i++){const swing=Math.sin(walkPhase+i*Math.PI)*.48;legs[i].rotation.x=swing;arms[i].rotation.set(-swing*.9,0,0);}
  figure.rotation.x=.04;head.rotation.y*=Math.exp(-dt*4);
  return d<=speed*dt+.01;
 }
 function chooseSite(boat,camera,forced){
  let best=null,score=Infinity;
  for(const site of sites){
   const distance=Math.hypot(site.end.x-boat.x,site.end.z-boat.z);let visible=true;
   if(camera){view.set(site.end.x,3,site.end.z).project(camera);visible=Math.abs(view.x)<.85&&Math.abs(view.y)<.8&&view.z>-1&&view.z<1;}
   if(!forced&&(!visible||distance>45))continue;
   // Prefer a bank where foreground tree crowns do not hide his lower body.
   // This is a rare site-selection check, not per-frame scene raycasting.
   let obscured=false;
   if(camera&&visible){sightTarget.set(site.end.x,1.4,site.end.z);const length=sightTarget.distanceTo(camera.position);sightRay.origin.copy(camera.position);sightRay.direction.subVectors(sightTarget,camera.position).normalize();
    for(const tree of trees){const size=tree.size||1;for(let j=0;j<3;j++){crownPoint.set(tree.x,(3+j*1.4)*size,tree.z);const along=(crownPoint.x-sightRay.origin.x)*sightRay.direction.x+(crownPoint.y-sightRay.origin.y)*sightRay.direction.y+(crownPoint.z-sightRay.origin.z)*sightRay.direction.z;if(along>0&&along<length&&sightRay.distanceSqToPoint(crownPoint)<((2-j*.44)*size)**2){obscured=true;break;}}if(obscured)break;}
   }
   const rank=distance+(visible?0:1000)+(obscured?60:0);if(rank<score){best=site;score=rank;}
  }
  return best;
 }
 function triggerNow(boat,camera){
  let site=chooseSite(boat,camera,true);
  // Forced testing still works if the local forest has no suitable corridor.
  // This fallback is debug-only and never creates scenery or a second actor.
  if(!site){for(let radius=12;radius<=36&&!site;radius+=8)for(let i=0;i<32&&!site;i++){
   const angle=i*Math.PI/16,x=boat.x+Math.cos(angle)*radius,z=boat.z+Math.sin(angle)*radius,p=nearest(x,z),dx=x-p.x,dz=z-p.z,l=Math.hypot(dx,dz);if(l<1)continue;
   const end={x:p.x+dx/l*10.9,z:p.z+dz/l*10.9},start={x:end.x+dx/l*6,z:end.z+dz/l*6};
   if(corridorClear(start,end,null))site={start,end,tree:null};
  }}
  if(!site)return false;
  active=site;hide();phase='walking';figure.visible=true;figure.position.set(site.start.x,0,site.start.z);target.x=site.end.x;target.z=site.end.z;
  path[0].x=site.start.x;path[0].z=site.start.z;path[1].x=site.end.x;path[1].z=site.end.z;return true;
 }
 function reset(){hide();if(active){figure.position.set(active.start.x,0,active.start.z);Object.assign(path[0],active.start);Object.assign(path[1],active.end);}chaseCooldown=hitCooldown=0;for(const e of emissions)e.sprayAge=99;}
 function refreshDebug(boat){debug.state=labels[phase];debug.reaction=reaction;debug.distance=Math.hypot(figure.position.x-boat.x,figure.position.z-boat.z);return debug;}
 return {figure,sites,triggerNow,reset,getDebugState:refreshDebug,
  provoke(boat,vocal=()=>{}){
   if(!figure.visible||reaction!=='normal'||phase==='returning'||chaseCooldown>0||Math.hypot(figure.position.x-boat.x,figure.position.z-boat.z)>40)return false;
   reaction='chase';age=0;chaseCooldown=25;trailCount=0;remember();vocal();return true;
  },
  update(dt,boat,camera,spray={speed:0,distance:0,volume:0,throttle:false},vocal=()=>{}){
   chaseCooldown=Math.max(0,chaseCooldown-dt);hitCooldown=Math.max(0,hitCooldown-dt);
   for(const e of emissions)e.sprayAge+=dt;
   emissionClock+=dt;if(emissionClock>=.03){emissionClock=0;Object.assign(emissions[emissionCursor++%emissions.length],boat,{sprayAge:0,speed:spray.speed,distance:spray.distance,volume:spray.volume,throttle:spray.throttle});}
   if(phase==='hidden'){
    cooldown-=dt;if(enabled&&cooldown<=0){const site=chooseSite(boat,camera,false);if(site){active=site;phase='walking';age=0;figure.visible=true;figure.position.set(site.start.x,0,site.start.z);Object.assign(path[0],site.start);Object.assign(path[1],site.end);}else cooldown=4;}
    refreshDebug(boat);return;
   }
   age+=dt;
   if(hitCooldown===0&&reaction!=='flinch'&&phase!=='returning'&&emissions.some(e=>e.sprayAge<2.6&&sprayReaches(figure.position,e,e.speed,e.distance,e.volume))){
    if(reaction!=='chase'){trailCount=0;remember();}reaction='flinch';age=0;hitCooldown=8;vocal();
   }
   if(reaction==='flinch'){
    arms.forEach((a,i)=>a.rotation.z=(i?1:-1)*2.2);figure.rotation.x=-.2;
    if(age>.7){reaction='normal';phase='returning';age=0;}
   }else if(reaction==='chase'){
    const dx=boat.x-figure.position.x,dz=boat.z-figure.position.z,d=Math.hypot(dx,dz)||1,p=nearest(figure.position.x,figure.position.z),ox=figure.position.x-p.x,oz=figure.position.z-p.z,l=Math.hypot(ox,oz)||1;
    let mx=dx/d,mz=dz/d;const inward=Math.min(0,(mx*ox+mz*oz)/l);mx-=inward*ox/l;mz-=inward*oz/l;
    const length=Math.hypot(mx,mz)||1;target.x=figure.position.x+mx/length*dt*7;target.z=figure.position.z+mz/length*dt*7;
    const n=nearest(target.x,target.z),safe=Math.hypot(target.x-n.x,target.z-n.z)>landClearance&&trees.every(t=>t===active.tree||Math.hypot(target.x-t.x,target.z-t.z)>2.1);
    if(safe&&trailCount<trail.length){remember();moveTo(target,7,dt);}else age=9;
    if(age>8){reaction='normal';phase='returning';age=0;}
   }else if(phase==='walking'){
    if(moveTo(active.end,2.2,dt)){phase='watching';age=0;}
   }else if(phase==='watching'){
    for(const limb of limbs)limb.rotation.x*=Math.exp(-dt*6);
    const desired=Math.atan2(boat.x-figure.position.x,boat.z-figure.position.z),difference=Math.atan2(Math.sin(desired-figure.rotation.y),Math.cos(desired-figure.rotation.y));
    figure.rotation.y+=difference*(1-Math.exp(-dt*.65));head.rotation.y+=(Math.max(-.65,Math.min(.65,difference))-head.rotation.y)*(1-Math.exp(-dt*3));figure.rotation.x=Math.sin(age*1.4)*.015;
    if(age>6){phase='returning';age=0;}
   }else if(phase==='returning'){
    const point=trailCount?trail[trailCount-1]:active.start;
    if(moveTo(point,trailCount?7:2.5,dt)){if(trailCount)trailCount--;else hide();}
   }
   // The normal corridor and recorded chase trail have both been land-checked.
   Object.assign(path[0],{x:figure.position.x,z:figure.position.z});Object.assign(path[1],reaction==='chase'?target:phase==='walking'?active.end:phase==='returning'?(trailCount?trail[trailCount-1]:active.start):{x:figure.position.x,z:figure.position.z});
   refreshDebug(boat);
  }
 };
}
