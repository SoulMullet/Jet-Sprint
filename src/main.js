import * as THREE from 'three';
import './style.css';
import {course,channel,settings,stepBoat} from './physics.js';
import {Engine} from './audio.js';
import {channelGeometry,nearestOnTrack} from './track.js';
import {createBigfoot} from './bigfoot.js';
import {bindControls} from './controls.js';
const $=id=>document.getElementById(id);
const scene=new THREE.Scene();scene.background=new THREE.Color('#a6d4cb');scene.fog=new THREE.Fog('#a6d4cb',150,260);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.outputColorSpace=THREE.SRGBColorSpace;$('game').appendChild(renderer.domElement);
const camera=new THREE.PerspectiveCamera(43,1,1,600);
scene.add(new THREE.HemisphereLight(0xc8f7ff,0x536944,2.5));const sun=new THREE.DirectionalLight(0xffedc2,3.2);sun.position.set(-35,65,25);scene.add(sun);
const mat=(color,roughness=.8)=>new THREE.MeshStandardMaterial({color,roughness});
const waterTime={value:0};
const grass=mat('#80a652'),bank=mat('#c3b97f'),water=mat('#20999d',.35),dark=mat('#183f44'),lime=mat('#d9ff62'),white=mat('#f3f0dd');
water.onBeforeCompile=shader=>{
 shader.uniforms.waterTime=waterTime;
 shader.vertexShader='varying vec2 surface;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nsurface=position.xz;');
 shader.fragmentShader='uniform float waterTime; varying vec2 surface;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat ripples=pow(max(0.,sin(surface.x*2.3+sin(surface.y*.8)+waterTime*3.)),18.); diffuseColor.rgb+=ripples*.075;');
};
function mesh(geo,material,x=0,y=0,z=0,parent=scene){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);parent.add(m);return m;}
mesh(new THREE.BoxGeometry(250,2,220),grass,0,-1.2,0);
const curve=new THREE.CatmullRomCurve3(course.map(([x,z])=>new THREE.Vector3(x,0,z)),true,'centripetal');
const N=600,points=Array.from({length:N},(_,i)=>curve.getPointAt(i/N));
const tangents=Array.from({length:N},(_,i)=>curve.getTangentAt(i/N));
// Shared capsule-union shape for visible water and continuous segment collision.
const outline=Array.from({length:240},(_,i)=>curve.getPointAt(i/240));
mesh(channelGeometry(outline,channel.bank),bank,0,-.13,0);
mesh(channelGeometry(outline,channel.water),water);
function nearest(x,z){return nearestOnTrack(points,x,z);}
// Repeated white-and-lime course markers make both banks readable.
for(let i=0;i<N;i+=14){const p=points[i],t=tangents[i];for(const s of [-1,1]){mesh(new THREE.CylinderGeometry(.23,.32,.65,6),i%28?white:lime,p.x-t.z*(channel.bank-.2)*s,.2,p.z+t.x*(channel.bank-.2)*s);}}
// Deterministic landscaping, kept clear of the water.
const forest=[];
let seed=13;function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
for(let i=0;i<120;i++){const x=(random()-.5)*177,z=(random()-.5)*142,p=nearest(x,z);if(Math.hypot(x-p.x,z-p.z)<12)continue;forest.push({x,z});const s=.7+random()*1.5;mesh(new THREE.CylinderGeometry(.16,.24,1.8,5),bank,x,.6,z);mesh(new THREE.ConeGeometry(s,3*s,6),mat(i%2?'#3f7850':'#52844c'),x,1.8*s,z);}
const bigfoot=createBigfoot(scene,forest,nearest);
const start=points[0],startT=tangents[0];const stripe=new THREE.Group();stripe.position.set(start.x,.035,start.z);stripe.rotation.y=-Math.atan2(startT.z,startT.x);scene.add(stripe);
for(let x=0;x<2;x++)for(let z=0;z<15;z++)mesh(new THREE.BoxGeometry(.65,.025,.96),(x+z)%2?dark:white,(x-.5)*.65,0,(z-7)*.96,stripe);
for(const side of [-1,1]){mesh(new THREE.BoxGeometry(.25,4,.25),dark,0,2,side*9,stripe);mesh(new THREE.BoxGeometry(.1,1,2),lime,0,3.3,side*8.2,stripe);}
const boat=new THREE.Group();scene.add(boat);
// Bow points along local +X. A faceted tapered hull, roll cage and exposed V8.
const hullShape=new THREE.Shape();hullShape.moveTo(2.2,0);hullShape.lineTo(.9,.93);hullShape.lineTo(-1.7,.9);hullShape.lineTo(-1.9,.55);hullShape.lineTo(-1.9,-.55);hullShape.lineTo(-1.7,-.9);hullShape.lineTo(.9,-.93);hullShape.closePath();
const hullGeo=new THREE.ExtrudeGeometry(hullShape,{depth:.45,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.12,bevelThickness:.12});hullGeo.rotateX(Math.PI/2);
mesh(hullGeo,lime,0,.55,0,boat);mesh(new THREE.BoxGeometry(2.3,.16,1.3),dark,-.35,.65,0,boat);mesh(new THREE.BoxGeometry(1,.4,.85),mat('#484e50'),-1.1,.9,0,boat);
for(let i=0;i<4;i++)for(const side of [-1,1])mesh(new THREE.CylinderGeometry(.09,.09,.3,6),white,-1.45+i*.22,1.16,side*.43,boat);
mesh(new THREE.BoxGeometry(.55,.5,.55),dark,.15,.93,0,boat);mesh(new THREE.SphereGeometry(.23,8,6),mat('#ff7047'),.2,1.4,0,boat);
function bar(a,b,r=.055){const delta=new THREE.Vector3().subVectors(b,a);const m=mesh(new THREE.CylinderGeometry(r,r,delta.length(),6),dark,0,0,0,boat);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());}
for(const z of [-.65,.65]){bar(new THREE.Vector3(-.6,.65,z),new THREE.Vector3(-.5,1.75,z));bar(new THREE.Vector3(-.5,1.75,z),new THREE.Vector3(.65,1.65,z));bar(new THREE.Vector3(.65,1.65,z),new THREE.Vector3(1,.65,z));}bar(new THREE.Vector3(-.5,1.75,-.65),new THREE.Vector3(-.5,1.75,.65));
// Pooled particles and wake rings: bounded memory and draw calls.
const COUNT=800,positions=new Float32Array(COUNT*3),life=new Float32Array(COUNT),velocity=new Float32Array(COUNT*3),lifetime=new Float32Array(COUNT),alpha=new Float32Array(COUNT);positions.fill(-1000);
const particleGeo=new THREE.BufferGeometry();particleGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));particleGeo.setAttribute('alpha',new THREE.BufferAttribute(alpha,1));
const spray=new THREE.Points(particleGeo,new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{pixelRatio:{value:renderer.getPixelRatio()}},vertexShader:`attribute float alpha; varying float fade; uniform float pixelRatio; void main(){fade=alpha;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(160.*pixelRatio/-p.z,1.,12.);}`,fragmentShader:`varying float fade;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(.88,1.,1.,fade*(1.-r*r));}`}));scene.add(spray);let cursor=0,emit=0;
const wakes=Array.from({length:42},()=>{const m=mesh(new THREE.RingGeometry(.75,1,12),new THREE.MeshBasicMaterial({color:'#b4ede3',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));m.rotation.x=-Math.PI/2;return {m,age:10};});let wakeCursor=0,wakeClock=0;
const engine=new Engine();let playing=false;
const controls=bindControls(Object.fromEntries(['left','right','throttle'].map(name=>[name,$(name)])),()=>{if(playing)engine.start();});
const {input,setInput,release}=controls;
// Older Safari may still dispatch touch gestures: cancel only on play surfaces.
for(const el of [$('game'),document.querySelector('.controls')]){
 for(const event of ['touchstart','touchmove','touchend','gesturestart','gesturechange','contextmenu'])el.addEventListener(event,e=>e.preventDefault(),{passive:false});
}
const keyMap={ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right',ArrowUp:'throttle',w:'throttle',' ':'throttle'};
window.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement)return;const k=e.key.length===1?e.key.toLowerCase():e.key;if(keyMap[k]){e.preventDefault();if(playing)engine.start();setInput(keyMap[k],k,true);}if(k==='r')restart();});window.addEventListener('keyup',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;if(keyMap[k])setInput(keyMap[k],k,false);});
window.addEventListener('blur',()=>{release();engine.pause();});
document.addEventListener('visibilitychange',()=>{release();if(document.hidden)engine.pause();});
for(const name of ['top','drift','steer','acceleration','cameraResponse','effects'])$(name).addEventListener('input',e=>{settings[name]=Number(e.target.value);$(name+'Out').textContent=e.target.value+(name==='top'?' km/h':['drift','steer'].includes(name)?'%':'');});
let b,elapsed=0,lap=1,best=null,checkpoint=0;
function restart(){release();engine.reset();b={x:start.x,z:start.z,angle:Math.atan2(startT.z,startT.x),vx:0,vz:0};elapsed=0;lap=1;checkpoint=0;life.fill(0);alpha.fill(0);emit=0;positions.fill(-1000);for(const w of wakes)w.age=10;$('notice').textContent='Cross the stripe. Find your flow.';}
restart();$('restart').onclick=restart;$('start').onclick=()=>{playing=true;document.body.classList.add('racing');engine.start();restart();};
const format=t=>`${Math.floor(t/60)}:${(t%60).toFixed(2).padStart(5,'0')}`;
let previousSpeed=0;
function effects(dt,speed){
 const acceleration=Math.max(0,(speed-previousSpeed)/Math.max(dt,.001));previousSpeed=speed;
 const fx=Math.cos(b.angle),fz=Math.sin(b.angle),slide=-b.vx*fz+b.vz*fx;
 for(let i=0;i<COUNT;i++){
  if(life[i]<=0)continue;life[i]-=dt;const j=i*3;
  velocity[j+1]-=9.8*dt;
  for(let k=0;k<3;k++)positions[j+k]+=velocity[j+k]*dt;
  alpha[i]=Math.max(0,life[i]/lifetime[i])*.65;
  if(life[i]<=0||positions[j+1]<.02){alpha[i]=0;positions[j+1]=-1000;}
 }
 emit+=(speed*8+(input.throttle?35+acceleration*2:0)+Math.abs(slide)*5)*dt*settings.effects;
 while(emit>=1){emit--;const i=cursor++%COUNT,j=i*3,spread=(Math.random()-.5)*(2+Math.abs(slide)*.3);
  life[i]=lifetime[i]=.9+Math.random()*.65;alpha[i]=.7;
  positions[j]=b.x-fx*2;positions[j+1]=.4;positions[j+2]=b.z-fz*2;
  const jet=6+speed*.65+(input.throttle?4:0);
  velocity[j]=b.vx*.25-fx*jet-fz*spread-slide*fz*.5;
  velocity[j+1]=2+Math.random()*(3+speed*.16);
  velocity[j+2]=b.vz*.25-fz*jet+fx*spread+slide*fx*.5;
 }
 particleGeo.attributes.position.needsUpdate=true;particleGeo.attributes.alpha.needsUpdate=true;
 wakeClock+=dt;if(wakeClock>.09&&speed>1){wakeClock=0;const w=wakes[wakeCursor++%wakes.length];w.age=0;w.m.position.set(b.x-Math.cos(b.angle)*1.6,.025,b.z-Math.sin(b.angle)*1.6);}
 for(const w of wakes){w.age+=dt;w.m.scale.setScalar(1+w.age*2);w.m.material.opacity=Math.max(0,.26*(1-w.age/2));}}
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}window.addEventListener('resize',resize);resize();
let last=performance.now(),accumulator=0;
const cameraTarget=new THREE.Vector3(start.x,0,start.z),desiredTarget=new THREE.Vector3();
let cameraReady=false;
function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.05);last=now;waterTime.value=now*.001;let speed=Math.hypot(b.vx,b.vz);
 if(playing&&!document.hidden){accumulator+=dt;while(accumulator>=1/120){const p=stepBoat(b,input,1/120,nearest);elapsed+=1/120;const progress=p.index/N;if(checkpoint<3&&progress>(checkpoint+1)*.25&&progress<(checkpoint+1)*.25+.1)checkpoint++;if(checkpoint===3&&progress<.08){best=best===null?elapsed:Math.min(best,elapsed);$('notice').textContent=`Lap ${lap} complete · ${format(elapsed)}`;lap++;elapsed=0;checkpoint=0;}accumulator-=1/120;}speed=Math.hypot(b.vx,b.vz);effects(dt,speed);bigfoot.update(dt,b,camera);engine.update(speed,input.throttle,dt,settings.top/3.6);}
 boat.position.set(b.x,.1+Math.sin(now*.008)*.025*speed/20,b.z);boat.rotation.set(0,-b.angle,(Number(input.left)-Number(input.right))*.055*speed/20);
 // Fixed isometric angle, with velocity and course lookahead for the next bend.
 const near=nearest(b.x,b.z),ahead=points[(near.index+Math.round(12+speed*.55))%N];
 desiredTarget.set(b.x+(ahead.x-b.x)*.25+b.vx*.18,0,b.z+(ahead.z-b.z)*.25+b.vz*.18);
 if(!cameraReady||!playing){cameraTarget.copy(desiredTarget);cameraReady=true;}
 else cameraTarget.lerp(desiredTarget,1-Math.exp(-dt*settings.cameraResponse));
 const baseDistance=camera.aspect<1?Math.max(54,35/camera.aspect):52;
 const distance=baseDistance+Math.min(1,speed/(settings.top/3.6))*5*settings.effects;
 camera.position.set(cameraTarget.x,distance,cameraTarget.z+distance*.62);camera.lookAt(cameraTarget);
 $('speed').textContent=Math.round(speed*3.6);$('time').textContent=format(elapsed);$('lap').textContent=String(lap).padStart(2,'0');$('best').textContent=best===null?'—':format(best);$('rev').style.transform=`scaleX(${Math.min(1,speed/(settings.top/3.6))})`;renderer.render(scene,camera);}
requestAnimationFrame(frame);
