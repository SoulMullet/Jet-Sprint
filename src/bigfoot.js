import * as THREE from 'three';
export function createBigfoot(scene,trees,nearest){
 const figure=new THREE.Group();scene.add(figure);figure.visible=false;
 const fur=new THREE.MeshStandardMaterial({color:0x392b23,roughness:1});
 function part(w,h,d,x,y,z,parent=figure){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),fur);m.position.set(x,y,z);parent.add(m);return m;}
 part(1.5,2,.85,0,2.6,0);part(1.8,.65,.9,0,3.4,0);part(.85,.9,.8,0,4,.25);
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
 let cooldown=45+Math.random()*75,age=0,active=null,walking=false;
 const enabled=Math.random()>.2; // Some entire sessions intentionally have no sightings.
 const view=new THREE.Vector3();
 return {update(dt,boat,camera){
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
