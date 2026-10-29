import * as THREE from 'three';
import './style.css';
import {createRetroVenue} from './retro-venue.js';
import {trackConfig} from './track-layout.js';
import {channel,settings,stepBoat} from './physics.js';
import {Engine} from './audio.js';
import workletURL from './v8-worklet.js?worker&url';
import {AudioSettings} from './audio-settings.js';
import {mountSoundLab} from './audio-panel.js';
import {channelGeometry,shorelineGeometry,nearestOnTrack} from './track.js';
import {createBigfoot} from './bigfoot.js';
import {Race,format,modified,readScores,saveScore,createDoubleTap} from './race.js';
import {lighting,waterMaterial,terrain,racingBoat} from './visuals.js';
import {Graphics} from './graphics.js';
import {WaterSystem} from './fluid/system.js';
import {SettingsStore} from './settings.js';
import {mountSettings} from './settings-panel.js';
import {RaceStart} from './race-start.js';
import {createRaceSignal} from './race-signal.js';
import {createCourse,courseId,routeId,gameplayVersion} from './course.js';
import {NavigationView,BigfootView} from './debug-views.js';
import {RouteNavigator,mountNavigator} from './navigation.js';
import {bindControls} from './controls.js';
const preferences=new SettingsStore({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)});
for(const id of Object.keys(settings))if(Object.hasOwn(preferences.values,id))settings[id]=preferences.values[id];
const $=id=>document.getElementById(id);
const scene=new THREE.Scene();scene.background=new THREE.Color('#a6d4cb');scene.fog=new THREE.Fog('#a6d4cb',150,260);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.outputColorSpace=THREE.SRGBColorSpace;$('game').appendChild(renderer.domElement);
const camera=new THREE.PerspectiveCamera(43,1,1,600);
const sun=lighting(scene,renderer);
const mat=(color,roughness=.8)=>new THREE.MeshStandardMaterial({color,roughness});
const waterTime={value:0},waterBoat={value:new THREE.Vector3()},waterStrength={value:0};
const bank=mat('#645b45'),dark=mat('#183237'),lime=mat('#e0ef64'),white=mat('#ddd6b7');
function mesh(geo,material,x=0,y=0,z=0,parent=scene){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);parent.add(m);return m;}

const venue=createCourse(),N=600,points=venue.points;
console.info(`Active track: ${venue.id} / version ${venue.version} / ${routeId}`);
$('buildDebugHud').dataset.track=venue.id;
const overview=document.createElement('label');overview.innerHTML='<input id="courseOverview" type="checkbox"> Figure-eight overview';$('debug').append(overview);
const tangents=points.map(p=>({x:p.tx,z:p.tz}));
// Bank, render surface, collision and bathymetry share the same channel network.
const outline=venue.network;
const shore=mesh(shorelineGeometry(outline,channel.water,channel.bank),bank);shore.receiveShadow=true;
const waterLook=waterMaterial(outline,channel.water,waterTime,waterBoat,waterStrength);
const waterMesh=mesh(channelGeometry(outline,channel.water),waterLook.material);waterMesh.receiveShadow=true;
function nearest(x,z){return nearestOnTrack(outline,x,z);}
// Mark the outside of every branch, excluding all merged intersection water.
const markerGeometry=new THREE.CylinderGeometry(.23,.32,.65,6),markerMatrix=new THREE.Matrix4();
const markerLocations=[[],[]];let markerIndex=0;
for(const edge of venue.edges)for(let i=0;i<edge.points.length-1;i+=6){const p=edge.points[i],q=edge.points[i+1],length=Math.hypot(q.x-p.x,q.z-p.z),tx=(q.x-p.x)/length,tz=(q.z-p.z)/length;
 for(const side of [-1,1]){const x=p.x-tz*(channel.bank-.2)*side,z=p.z+tx*(channel.bank-.2)*side,n=nearest(x,z);if(Math.hypot(x-n.x,z-n.z)>channel.water+.5)markerLocations[markerIndex++%2].push([x,z]);}}
for(const [i,material] of [lime,white].entries()){const locations=markerLocations[i],markers=new THREE.InstancedMesh(markerGeometry,material,locations.length);locations.forEach(([x,z],i)=>{markerMatrix.makeTranslation(x,.2,z);markers.setMatrixAt(i,markerMatrix);});scene.add(markers);}
// Deterministic landscaping, kept clear of the water.
let seed=trackConfig.seed;function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
const environment=terrain(scene,venue.edges.flatMap(e=>e.points),nearest,random,outline),forest=environment.trees;
const retroVenue=createRetroVenue(scene,nearest);
const bigfoot=createBigfoot(scene,forest,nearest);
const start=points[0],startT=tangents[0];const stripe=new THREE.Group();stripe.position.set(start.x,.035,start.z);stripe.rotation.y=-Math.atan2(startT.z,startT.x);scene.add(stripe);
for(let x=0;x<2;x++)for(let z=0;z<15;z++)mesh(new THREE.BoxGeometry(.65,.025,.96),(x+z)%2?dark:white,(x-.5)*.65,0,(z-7)*.96,stripe);
for(const side of [-1,1]){mesh(new THREE.BoxGeometry(.25,4,.25),dark,0,2,side*9,stripe);mesh(new THREE.BoxGeometry(.1,1,2),lime,0,3.3,side*8.2,stripe);}
const boat=racingBoat(scene);
// Pooled particles and wake rings: bounded memory and draw calls.
const COUNT=800,positions=new Float32Array(COUNT*3),life=new Float32Array(COUNT),velocity=new Float32Array(COUNT*3),lifetime=new Float32Array(COUNT),alpha=new Float32Array(COUNT),splashPhase=new Uint8Array(COUNT);positions.fill(-1000);
const particleGeo=new THREE.BufferGeometry();particleGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));particleGeo.setAttribute('alpha',new THREE.BufferAttribute(alpha,1));
const spray=new THREE.Points(particleGeo,new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{pixelRatio:{value:renderer.getPixelRatio()}},vertexShader:`attribute float alpha; varying float fade; uniform float pixelRatio; void main(){fade=alpha;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(230.*pixelRatio/-p.z,1.,16.);}`,fragmentShader:`varying float fade;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;vec3 sunlight=mix(vec3(.64,.79,.79),vec3(1.,.96,.8),gl_PointCoord.y);gl_FragColor=vec4(sunlight,fade*pow(1.-r*r,1.5));}`}));spray.frustumCulled=false;scene.add(spray);let cursor=0,emit=0;
const wakes=Array.from({length:90},()=>{const m=mesh(new THREE.RingGeometry(.75,1,12),new THREE.MeshBasicMaterial({color:'#b4ede3',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));m.rotation.x=-Math.PI/2;m.visible=false;return {m,age:10};});let wakeCursor=0,wakeClock=0;
let fluid=null;
let quality={particles:.7,detail:.7,water:1};
const graphics=new Graphics((preset,name)=>{quality=preset;renderer.setPixelRatio(Math.min(devicePixelRatio,preset.dpr));renderer.setSize(innerWidth,innerHeight);spray.material.uniforms.pixelRatio.value=renderer.getPixelRatio();sun.castShadow=!!preset.shadow;renderer.shadowMap.enabled=!!preset.shadow;if(preset.shadow){sun.shadow.mapSize.set(preset.shadow,preset.shadow);sun.shadow.map?.dispose();sun.shadow.map=null;}waterLook.quality.value=preset.water;environment.update(camera,preset.detail);$('graphicsStatus').textContent=name;fluid?.setQuality(name);}, {getItem:()=>preferences.values.graphics,setItem(){}});
fluid=new WaterSystem(renderer,scene,waterMesh,{nearest,width:channel.water,size:trackConfig.fluidSize,start:{x:start.x+startT.x*7,z:start.z+startT.z*7},quality:graphics.current,onStatus:message=>$('waterStatus').textContent=message});
fluid.setQuality(graphics.current);
if(!fluid.solver?.available){$('waterMode').value='legacy';$('waterMode').querySelector('[value=simulated]').disabled=true;fluid.setMode('legacy');}



$('testWave').onclick=()=>fluid.disturb(b.x+Math.cos(b.angle)*6,b.z+Math.sin(b.angle)*6);
$('resetWater').onclick=()=>fluid.reset();


const audioSettings=new AudioSettings({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)});
const engine=new Engine({settings:audioSettings.values,workletURL});let playing=false,gameClock=0,last=performance.now();
const startSequence=new RaceStart(),trackSignal=createRaceSignal(scene,start,startT);
const doubleTap=createDoubleTap(()=>{if(startSequence.state==='RACING')bigfoot.provoke(b,()=>engine.vocal(true));});
const race=new Race(venue.gates,channel.hullLimit);
const navigator=new RouteNavigator(venue,channel.hullLimit),navigatorHUD=mountNavigator($('navigator'));
const navigationView=new NavigationView(scene,venue),bigfootView=new BigfootView(scene,bigfoot);
let result=null;
const scoreStorage={getItem(key){try{return localStorage.getItem(key);}catch{return null;}},setItem(key,value){localStorage.setItem(key,value);}};
function board(){const records=readScores(scoreStorage).filter(r=>r.course===`${courseId}/${routeId}`&&r.version===gameplayVersion&&r.modified===result.modified).sort((a,b)=>a.total-b.total);
 $('scores').replaceChildren();const note=document.createElement('p');note.textContent=result.modified?'Modified runs':'Standard runs';$('scores').append(note);
 for(const [i,r] of records.entries()){const row=document.createElement('p');row.textContent=`${i+1}. ${r.name} · ${format(r.total)} · best ${format(Math.min(...r.laps))} · ${new Date(r.date).toLocaleDateString()}`;$('scores').append(row);}
 return records.findIndex(r=>r.id===result.id)+1;
}
function finish(){startSequence.finish();playing=false;release();engine.pause();b.vx=b.vz=0;
 result={id:globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`,course:`${courseId}/${routeId}`,version:gameplayVersion,modified:race.modified,total:race.total,laps:[...race.laps],date:new Date().toISOString()};
 $('resultStats').replaceChildren();const summary=document.createElement('p');summary.textContent=`Total ${format(result.total)} · Best ${format(Math.min(...result.laps))} · Average ${format(result.total/5)} · ${result.modified?'Modified':'Standard'}`;$('resultStats').append(summary);
 const list=document.createElement('ol');for(const t of result.laps){const item=document.createElement('li');item.textContent=format(t);list.append(item);}$('resultStats').append(list);
 $('saveScore').disabled=false;$('saveStatus').textContent='';$('results').hidden=false;board();$('raceRestart').focus();
}
$('saveScore').onclick=()=>{if(!result)return;try{saveScore(scoreStorage,result,$('playerName').value);const rank=board();$('saveScore').disabled=true;$('saveStatus').textContent=rank?`Saved · local position ${rank}`:'Outside the fastest 10';}catch{$('saveStatus').textContent='Storage unavailable. Results remain visible for this race.';}};
$('raceRestart').onclick=()=>{playing=true;restart();engine.start();};
const controls=bindControls(Object.fromEntries(['left','right','throttle'].map(name=>[name,$(name)])),name=>{if(playing){engine.start();if(name==='throttle')doubleTap.press(performance.now());}else release();});
const {input,setInput,release}=controls;
// Older Safari may still dispatch touch gestures: cancel only on play surfaces.
for(const el of [$('game'),document.querySelector('.controls')]){
 for(const event of ['touchstart','touchmove','touchend','gesturestart','gesturechange','contextmenu'])el.addEventListener(event,e=>e.preventDefault(),{passive:false});
}
const keyMap={ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right',ArrowUp:'throttle',w:'throttle',' ':'throttle'};
window.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||e.target instanceof HTMLTextAreaElement||e.target.closest?.('#debug, #soundLab')||e.target.isContentEditable||soundLab.testing)return;const k=e.key.length===1?e.key.toLowerCase():e.key;if(keyMap[k]&&playing){e.preventDefault();engine.start();setInput(keyMap[k],k,true);}if(k==='r'&&!e.repeat)restart();});window.addEventListener('keyup',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;if(keyMap[k])setInput(keyMap[k],k,false);});
window.addEventListener('blur',()=>{if(fluid?.solver)fluid.solver.accumulator=0;doubleTap.reset();release();engine.pause();});
document.addEventListener('visibilitychange',()=>{doubleTap.reset();release();preferences.flush();audioSettings.flush();if(document.hidden)engine.pause();else last=performance.now();});
window.addEventListener('pagehide',()=>{preferences.flush();audioSettings.flush();});
function applyPreferences(ids){const v=preferences.values;
 for(const id of ids)if(Object.hasOwn(settings,id))settings[id]=v[id];
 if(playing)race.modified||=modified(settings);
 if(ids.includes('graphics')&&graphics.selected!==v.graphics)graphics.select(v.graphics);
 if(ids.includes('fluidResolution'))fluid.setResolution(v.fluidResolution);
 if(ids.includes('waterMode'))fluid.setMode(v.waterMode);
 if(ids.includes('fluidDebug'))fluid.setDebug(v.fluidDebug);
 if(ids.includes('waveScale'))fluid.setWaveScale(v.waveScale);
 if(ids.includes('repeatWaves'))fluid.repeatWaves=v.repeatWaves;
 if(ids.includes('navigationDebug'))navigationView.setDebug(v.navigationDebug);
 if(ids.includes('bigfootDebug'))bigfootView.setDebug(v.bigfootDebug);
 if(ids.includes('mute')||ids.includes('masterVolume'))engine.setPreferences(v.mute,v.masterVolume);
}
const settingsUI=mountSettings(preferences,applyPreferences);
const soundLab=mountSoundLab(audioSettings,engine,{onTestChange:on=>{release();if(!on&&!playing)engine.pause();last=performance.now();}});
soundLab.root.addEventListener('toggle',()=>{if(soundLab.root.open)release();});
bigfootView.mount(settingsUI.groups['Debug Tools'],()=>b,camera);
let b,elapsed=0,lap=1,best=null;
function restart(){if(soundLab.testing)soundLab.setTesting(false);const now=performance.now();if(playing)gameClock+=Math.max(0,(now-last)/1000);last=now;startSequence.reset();playing=document.body.classList.contains('racing');if(playing)startSequence.begin(gameClock,preferences.values.countdownDuration);fluid?.reset();fluid?.disturb();race.reset();navigator.reset();race.modified=modified(settings);doubleTap.reset();$('results').hidden=true;result=null;release();engine.reset();b={x:start.x,z:start.z,angle:Math.atan2(startT.z,startT.x),vx:0,vz:0,pump:0,nozzle:0,yawRate:0};elapsed=0;lap=1;life.fill(0);alpha.fill(0);emit=0;positions.fill(-1000);for(const w of wakes)w.age=10;$('notice').textContent='Follow your navigator. Apply throttle to steer.';}
restart();$('restart').onclick=()=>{if(document.body.classList.contains('racing'))playing=true;restart();if(playing)engine.start();};$('start').onclick=()=>{playing=true;document.body.classList.add('racing');engine.start();restart();};
let previousSpeed=0;
function effects(dt,speed){
 const acceleration=Math.max(0,(speed-previousSpeed)/Math.max(dt,.001));previousSpeed=speed;
 const fx=Math.cos(b.angle),fz=Math.sin(b.angle),slide=-b.vx*fz+b.vz*fx;
 for(let i=0;i<COUNT;i++){
  if(life[i]<=0)continue;life[i]-=dt;const j=i*3;
  velocity[j+1]-=9.8*dt;
  for(let k=0;k<3;k++)positions[j+k]+=velocity[j+k]*dt;
  alpha[i]=Math.max(0,life[i]/lifetime[i])*.65;
  if(positions[j+1]<.02&&life[i]>0&&!splashPhase[i]){const p=nearest(positions[j],positions[j+2]);if(Math.hypot(p.x-positions[j],p.z-positions[j+2])<channel.water&&i%6===0){const w=wakes[wakeCursor++%wakes.length];w.age=0;w.m.position.set(positions[j],.045,positions[j+2]);}splashPhase[i]=1;positions[j+1]=.03;velocity[j]*=.15;velocity[j+2]*=.15;velocity[j+1]=1+Math.random();life[i]=lifetime[i]=.35;}if(splashPhase[i]&&positions[j+1]<.02)life[i]=0;if(life[i]<=0){alpha[i]=0;positions[j+1]=-1000;}
 }
 emit+=(speed*8+(input.throttle?35+acceleration*2:0)+Math.abs(slide)*5)*dt*settings.effects*settings.waterVolume/100*quality.particles;
 while(emit>=1){emit--;const i=cursor++%COUNT,j=i*3,spread=(Math.random()-.5)*(2+Math.abs(slide)*.3);
  splashPhase[i]=0;life[i]=lifetime[i]=2.6;alpha[i]=.7;
  positions[j]=b.x-fx*2;positions[j+1]=.4;positions[j+2]=b.z-fz*2;
  const jet=(6+speed*.65+(input.throttle?4:0))*settings.sprayDistance/100;
  velocity[j]=b.vx*.25-fx*jet-fz*spread-slide*fz*.5;
  velocity[j+1]=2+Math.random()*(3+speed*.16);
  velocity[j+2]=b.vz*.25-fz*jet+fx*spread+slide*fx*.5;
 }
 particleGeo.attributes.position.needsUpdate=true;particleGeo.attributes.alpha.needsUpdate=true;
 wakeClock+=dt;if(wakeClock>.09&&speed>1){wakeClock=0;const w=wakes[wakeCursor++%wakes.length];w.age=0;w.m.position.set(b.x-Math.cos(b.angle)*1.6,.025,b.z-Math.sin(b.angle)*1.6);}
 for(const w of wakes){w.age+=dt;w.m.visible=w.age<2;w.m.scale.setScalar(1+w.age*2);w.m.material.opacity=Math.max(0,.26*(1-w.age/2))*Math.min(1.6,settings.waterVolume/100);}}
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}window.addEventListener('resize',resize);resize();
const beforeStep={x:0,z:0};
const cameraTarget=new THREE.Vector3(start.x,0,start.z),desiredTarget=new THREE.Vector3();
let cameraReady=false,vegetationClock=0;
function frame(now){requestAnimationFrame(frame);const rawDt=Math.max(0,(now-last)/1000),dt=Math.min(rawDt,.05);last=Math.max(last,now);if(playing&&!document.hidden)graphics.sample(rawDt);waterTime.value=now*.001;let speed=Math.hypot(b.vx,b.vz);
 if(playing&&!document.hidden&&!soundLab.testing){
  gameClock+=rawDt;
  const transitions=startSequence.update(gameClock),latestSignal=transitions[transitions.length-1];
  if(latestSignal&&preferences.values.countdownAudio)engine.signal(latestSignal.kind);
  if(startSequence.state==='RACING'){
   const racingDt=Math.min(dt,Math.max(0,gameClock-startSequence.startAt));let advanced=0;
   while(advanced<racingDt-1e-10){const step=Math.min(1/120,racingDt-advanced);beforeStep.x=b.x;beforeStep.z=b.z;stepBoat(b,input,step,nearest);advanced+=step;
    const completed=race.step(beforeStep,b,step,settings,gameClock-racingDt+advanced-startSequence.startAt);
    elapsed=race.total-race.lapStart;lap=Math.min(5,race.laps.length+1);best=race.laps.length?Math.min(...race.laps):null;
    if(completed&&race.done){finish();break;}
   }
   speed=Math.hypot(b.vx,b.vz);effects(dt,speed);bigfoot.update(dt,b,camera,{speed,distance:settings.sprayDistance/100,volume:settings.waterVolume/100,throttle:input.throttle},()=>engine.vocal(false));engine.update(speed,input.throttle,dt,settings.top/3.6);
  }else{b.vx=b.vz=0;speed=0;engine.update(0,input.throttle&&preferences.values.prestartRevving,dt,settings.top/3.6,true);}
  fluid.focus.x=b.x+Math.cos(b.angle)*7;fluid.focus.z=b.z+Math.sin(b.angle)*7;fluid.update(dt);
 }
 if(soundLab.testing&&!document.hidden){engine.update(0,soundLab.throttle,dt,settings.top/3.6,true);speed=0;}
 soundLab.update();
 retroVenue.update(document.hidden?0:dt,b);
 const navigating=playing&&!document.hidden&&!soundLab.testing&&startSequence.state==='RACING';
 if(!navigating&&preferences.values.bigfootDebug&&!document.hidden)bigfoot.update(dt,b,camera);
 let navigationCue=null;
 if(navigating){const cue=navigationCue=navigator.update(b,race,dt,input);navigatorHUD.update(cue,!$('debug').open&&!soundLab.root.open&&(!preferences.values.startHud||gameClock>=startSequence.startAt+2));const notice=cue.notice||'Follow the arrows · Five laps';if($('notice').textContent!==notice)$('notice').textContent=notice;}else navigatorHUD.update(null,false);
 navigationView.update(b,race,navigationCue,navigating,dt);bigfootView.update(b,dt);
 const lamps=startSequence.lamps(gameClock);trackSignal.update(lamps);
 const signalHUD=$('startSignal'),show=startSequence.active&&preferences.values.startHud&&(startSequence.state!=='RACING'||gameClock<startSequence.startAt+2);
 signalHUD.hidden=!show;signalHUD.style.opacity=startSequence.state==='RACING'?String(Math.min(1,Math.max(0,startSequence.startAt+2-gameClock))):'1';
 for(const id of ['upper','lower','green'])$('signal-'+id).classList.toggle('lit',lamps[id]);
 const signalText=startSequence.state==='READY'?'READY':startSequence.state==='COUNTDOWN'?'SET':'GO!';if($('signalText').textContent!==signalText)$('signalText').textContent=signalText;

 boat.position.set(b.x,.1+Math.sin(now*.008)*.025*speed/20,b.z);boat.rotation.set(0,-b.angle,(Number(input.left)-Number(input.right))*.055*speed/20);
 // Fixed isometric angle, with velocity and course lookahead for the next bend.
 waterBoat.value.set(b.x,0,b.z);waterStrength.value=Math.min(1,speed/20);
 const near=nearest(b.x,b.z),ahead=points[(near.index+Math.round(12+speed*.8))%N];
 desiredTarget.set(b.x+(ahead.x-b.x)*.25+b.vx*.18,0,b.z+(ahead.z-b.z)*.25+b.vz*.18);
 if(!cameraReady||!playing){cameraTarget.copy(desiredTarget);cameraReady=true;}
 else cameraTarget.lerp(desiredTarget,1-Math.exp(-dt*settings.cameraResponse*(1+Math.max(0,settings.top/120-1)*.4)));
 const baseDistance=camera.aspect<1?Math.max(54,35/camera.aspect):52;
 const distance=baseDistance+Math.min(1,speed/(settings.top/3.6))*5*settings.effects;
 camera.position.set(cameraTarget.x,distance,cameraTarget.z+distance*.62);camera.lookAt(cameraTarget);
 scene.fog.near=$('courseOverview').checked?350:105;scene.fog.far=$('courseOverview').checked?600:240;
 if($('courseOverview').checked){camera.position.set(-6,137,86);camera.lookAt(-6,0,-1);}
 const fov=43+Math.min(1,speed/50)*2;if(Math.abs(camera.fov-fov)>.01){camera.fov+=(fov-camera.fov)*(1-Math.exp(-dt*3));camera.updateProjectionMatrix();}
 vegetationClock+=dt;if(vegetationClock>.5){vegetationClock=0;environment.update(camera,quality.detail);}
 sun.position.set(cameraTarget.x-35,65,cameraTarget.z+25);sun.target.position.set(cameraTarget.x,0,cameraTarget.z);
 $('speed').textContent=Math.round(speed*3.6);$('time').textContent=format(elapsed);$('lap').textContent=`${lap}/5`;$('best').textContent=best===null?'—':format(best);$('rev').style.transform=`scaleX(${Math.min(1,speed/(settings.top/3.6))})`;renderer.render(scene,camera);}
requestAnimationFrame(frame);
