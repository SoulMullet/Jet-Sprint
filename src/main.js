import * as THREE from 'three';
import './style.css';
import './campaign.css';
import './controls.css';
import {loadGameFonts,setInstrumentText} from './typography.js';
import {mountInterface} from './interface.js';
import {SummerSettings} from './summer-settings.js';
import {SummerRenderer,mountGraphicsLab} from './graphics-lab.js';
import {WakeTrail} from './wake-trail.js';
import {BoatPresentation} from './boat-presentation.js';
import {createWaterSampler} from './hull-motion.js';
import {mountPhysicsLab} from './physics-lab.js';
import {presetName} from './handling.js';
import {HFSpray} from './hf-effects.js';
import {mountSprayLab} from './spray-lab.js';
import {HFWake} from './hf-wake.js';
import {HFScenery} from './hf-scenery.js';
import {renderGeometry} from './fluid/render-geometry.js';
import {CameraSettings} from './camera-settings.js';
import {RacingCameras,createCameraObstructionQuery} from './cameras.js';
import {mountCameraPanel} from './camera-panel.js';
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
import {courseId,routeId,gameplayVersion} from './course.js';
import {NavigationView,BigfootView} from './debug-views.js';
import {RouteNavigator,mountNavigator} from './navigation.js';
import {bindControls,editingInput} from './controls.js';
import {ControlSettings} from './control-settings.js';
import {mountControlLab} from './control-lab.js';
import {navigateMenu} from './gamepad-menu.js';
import {trapFocus} from './ui-components.js';
import {createCampaignAdventure,sliceCampaignNetwork} from './campaign-world.js';
import {CampaignStreamer,originBounds} from './campaign-streaming.js';
import {CampaignTour} from './campaign-tour.js';
import {CampaignProgress} from './campaign-progress.js';
import {RiverSurface} from './campaign-whitewater.js';
import {TourPresentation} from './campaign-presentation.js';
import {mountCampaignUI} from './campaign-ui.js';
import {track1,campaignDefinition} from './campaign-data.js';
await loadGameFonts();
const preferences=new SettingsStore({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)});
for(const id of Object.keys(settings))if(Object.hasOwn(preferences.values,id))settings[id]=preferences.values[id];
const summerPreferences=new SummerSettings({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)},matchMedia('(pointer:coarse)').matches);
let summerLab=null;
if(!summerPreferences.restored&&(preferences.restored||preferences.values.graphics!=='auto')){
 if(preferences.values.graphics==='auto'){summerPreferences.values.baseQuality='auto';summerPreferences.values.preset='custom';}
 else summerPreferences.preset(preferences.values.graphics);
}
preferences.values.graphics=summerPreferences.values.baseQuality;
const cameraPreferences=new CameraSettings({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)},settings.cameraResponse);
const $=id=>document.getElementById(id);
const scene=new THREE.Scene();scene.background=new THREE.Color('#a6d4cb');scene.fog=new THREE.Fog('#a6d4cb',150,260);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.outputColorSpace=THREE.SRGBColorSpace;$('game').appendChild(renderer.domElement);
const perspective=new THREE.PerspectiveCamera(43,1,1,600);
let camera=perspective;
const sun=lighting(scene,renderer);sun.shadow.camera.layers.enable(1);
const mat=(color,roughness=.8)=>new THREE.MeshStandardMaterial({color,roughness});
const waterTime={value:0},waterBoat={value:new THREE.Vector3()},waterStrength={value:0};
const bank=mat('#645b45'),dark=mat('#183237'),lime=mat('#e0ef64'),white=mat('#ddd6b7');
function mesh(geo,material,x=0,y=0,z=0,parent=scene){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);parent.add(m);return m;}

const campaignWorld=createCampaignAdventure(),N=600;let venue=campaignWorld.courses[0],points=venue.points;
const campaignProgress=new CampaignProgress({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)});
const campaign=new CampaignTour(campaignWorld,campaignProgress);
console.info(`Active track: ${venue.id} / version ${venue.version} / ${routeId}`);
$('buildDebugHud').dataset.track=venue.id;
for(const id of ['buildDebugHud','buildDebug'])$(id).textContent=`CAMPAIGN-4 · v${__BUILD_VERSION__} · ${__BUILD_COMMIT__}`;
const overview=document.createElement('label');overview.innerHTML='<input id="courseOverview" type="checkbox"> Campaign overview';$('debug').append(overview);
const tangents=points.map(p=>({x:p.tx,z:p.tz}));
// Bank, render surface, collision and bathymetry share the same channel network.
const outline=sliceCampaignNetwork(campaignWorld.network,originBounds);
const shore=mesh(shorelineGeometry(outline,channel.water,channel.bank),bank);shore.receiveShadow=true;
const waterLook=waterMaterial(outline,channel.water,waterTime,waterBoat,waterStrength);
const riverSurface=new RiverSurface(campaignWorld,waterLook);
const riverGeometry=channelGeometry(outline,channel.water);
mesh(riverGeometry,mat('#516b49'),0,-1.15,0);
const waterMesh=mesh(renderGeometry(riverGeometry,(x,z)=>nearestOnTrack(outline,x,z),channel.water),waterLook.material);waterMesh.receiveShadow=true;
function nearest(x,z){return campaignWorld.nearest(x,z);}
// Mark the outside of every branch, excluding all merged intersection water.
const markerGeometry=new THREE.CylinderGeometry(.23,.32,.65,6),markerMatrix=new THREE.Matrix4();
const markerLocations=[[],[]];let markerIndex=0;
for(const edge of venue.edges)for(let i=0;i<edge.points.length-1;i+=6){const p=edge.points[i],q=edge.points[i+1],length=Math.hypot(q.x-p.x,q.z-p.z),tx=(q.x-p.x)/length,tz=(q.z-p.z)/length;
 for(const side of [-1,1]){const x=p.x-tz*(channel.bank-.2)*side,z=p.z+tx*(channel.bank-.2)*side,n=nearest(x,z);if(Math.hypot(x-n.x,z-n.z)>channel.water+.5)markerLocations[markerIndex++%2].push([x,z]);}}
for(const [i,material] of [lime,white].entries()){const locations=markerLocations[i],markers=new THREE.InstancedMesh(markerGeometry,material,locations.length);locations.forEach(([x,z],i)=>{markerMatrix.makeTranslation(x,.2,z);markers.setMatrixAt(i,markerMatrix);});scene.add(markers);}
// Deterministic landscaping, kept clear of the water.
let seed=trackConfig.seed;function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
const environment=terrain(scene,venue.edges.flatMap(e=>e.points),nearest,random,outline),forest=environment.trees;
const hfScenery=new HFScenery(scene,environment,shore,nearest,waterLook.uniforms);
const retroVenue=createRetroVenue(scene,nearest);
const campaignStream=new CampaignStreamer(scene,campaignWorld,{water:waterLook.material,ground:environment.ground,bank});campaignStream.prime(venue.points[0]);
const campaignScenery=new TourPresentation(scene,campaignWorld,campaignStream);
const bigfoot=createBigfoot(scene,forest,nearest);
const start=points[0],startT=tangents[0];const stripe=new THREE.Group();stripe.position.set(start.x,.035,start.z);stripe.rotation.y=-Math.atan2(startT.z,startT.x);scene.add(stripe);
for(let x=0;x<2;x++)for(let z=0;z<15;z++)mesh(new THREE.BoxGeometry(.65,.025,.96),(x+z)%2?dark:white,(x-.5)*.65,0,(z-7)*.96,stripe);
for(const side of [-1,1]){mesh(new THREE.BoxGeometry(.25,4,.25),dark,0,2,side*9,stripe);mesh(new THREE.BoxGeometry(.1,1,2),lime,0,3.3,side*8.2,stripe);}
const boat=racingBoat(scene,{cockpitLayers:true});
const boatPresentation=new BoatPresentation(boat,{tuning:settings,sampleWater:riverSurface.wrapSampler(createWaterSampler(waterLook.uniforms)),fixedStep:true});
const cameraObstacles=scene.children.filter(o=>o.isMesh&&o!==waterMesh);
scene.updateMatrixWorld(true);
const cameraStaticCount=cameraObstacles.length,cameraObstruction=createCameraObstructionQuery(cameraObstacles);
const cameraSystem=new RacingCameras(perspective,cameraPreferences,(target,position)=>{cameraObstacles.length=cameraStaticCount;campaignStream.appendObstacles(cameraObstacles,target.x,target.z);return cameraObstruction(target,position);});
cameraSystem.overviewCenter={x:-7,z:-28,height:235};
const cameraFrame={playing:false,top:85,effects:1,overview:false};
const vegetationCamera={position:new THREE.Vector3()};
// Pooled particles and wake rings: bounded memory and draw calls.
const wakeTrail=new WakeTrail(scene);
const sampleSprayWater=riverSurface.wrapSampler(createWaterSampler(waterLook.uniforms)),sprayWaterSample={height:0,wake:0};
const hfSpray=new HFSpray(scene,waterLook.uniforms,6144,{
 surfaceAt:(x,z)=>{sampleSprayWater(x,z,waterTime.value,sprayWaterSample);return sprayWaterSample.height+sprayWaterSample.wake;},
 isWater:(x,z)=>{const n=nearest(x,z);return Math.hypot(x-n.x,z-n.z)<=(n.waterWidth??channel.water);}
});
const hfWake=new HFWake(scene,waterLook.uniforms);
let fluid=null;
let quality={particles:.7,detail:.7,water:1};
const graphics=new Graphics((preset,name)=>{quality=preset;campaignStream.configure(summerPreferences.values,preset);renderer.setPixelRatio(Math.min(devicePixelRatio,preset.dpr));renderer.setSize(innerWidth,innerHeight);sun.castShadow=!!preset.shadow;renderer.shadowMap.enabled=!!preset.shadow;if(preset.shadow){sun.shadow.mapSize.set(preset.shadow,preset.shadow);sun.shadow.map?.dispose();sun.shadow.map=null;}waterLook.quality.value=preset.water;environment.update(camera,preset.detail);$('graphicsStatus').textContent=name;fluid?.setQuality(name);summerLab?.apply();}, {getItem:()=>preferences.values.graphics,setItem(){}});
fluid=new WaterSystem(renderer,scene,waterMesh,{nearest,width:channel.water,initialMode:preferences.values.waterMode,size:trackConfig.fluidSize,start:{x:start.x+startT.x*7,z:start.z+startT.z*7},quality:graphics.current,onStatus:message=>$('waterStatus').textContent=message});
fluid.setQuality(graphics.current);
if(fluid.solver&&!fluid.solver.available){$('waterMode').value='legacy';$('waterMode').querySelector('[value=simulated]').disabled=true;fluid.setMode('legacy');}



$('testWave').onclick=()=>fluid.disturb(b.x+Math.cos(b.angle)*6,b.z+Math.sin(b.angle)*6);
$('resetWater').onclick=()=>fluid.reset();


const audioSettings=new AudioSettings({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)});
const engine=new Engine({settings:audioSettings.values,workletURL});let playing=false,paused=false,gameClock=0,last=performance.now();
const startSequence=new RaceStart(),trackSignals=campaignWorld.courses.map(c=>createRaceSignal(scene,c.points[0],c.points[0]));
const doubleTap=createDoubleTap(()=>{if(startSequence.state==='RACING')bigfoot.provoke(b,()=>engine.vocal(true));});
let race=campaign.race;
let navigator=campaign.navigator;const navigatorHUD=mountNavigator($('navigator'));
const navigationView=new NavigationView(scene,venue),bigfootView=new BigfootView(scene,bigfoot);
let result=null;
const scoreStorage={getItem(key){try{return localStorage.getItem(key);}catch{return null;}},setItem(key,value){localStorage.setItem(key,value);}};
function board(){const records=readScores(scoreStorage).filter(r=>r.course===result.course&&r.version===gameplayVersion&&r.modified===result.modified).sort((a,b)=>a.total-b.total);
 $('scores').replaceChildren();const note=document.createElement('p');note.textContent=result.modified?'Modified runs':'Standard runs';$('scores').append(note);
 for(const [i,r] of records.entries()){const row=document.createElement('p');row.textContent=`${i+1}. ${r.name} · ${format(r.total)} · best ${format(Math.min(...r.laps))} · ${new Date(r.date).toLocaleDateString()}`;$('scores').append(row);}
 return records.findIndex(r=>r.id===result.id)+1;
}
function finish(){startSequence.finish();
 result={id:globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`,course:`${campaign.track.id}/${campaign.track.routeId}`,version:gameplayVersion,modified:race.modified||campaign.practice,total:race.total,laps:[...race.laps],lapCount:campaign.track.laps,date:new Date().toISOString()};
 $('resultStats').replaceChildren();const summary=document.createElement('p');summary.textContent=`Total ${format(result.total)} · Best ${format(Math.min(...result.laps))} · Average ${format(result.total/result.laps.length)} · ${result.modified?'Modified':'Standard'}`;$('resultStats').append(summary);
 const list=document.createElement('ol');for(const t of result.laps){const item=document.createElement('li');item.textContent=format(t);list.append(item);}$('resultStats').append(list);
 $('saveScore').disabled=false;$('saveStatus').textContent='';board();$('notice').textContent=campaign.phase==='CHAMPION'?'Championship complete · Results ready':'Race complete · Follow the river exit';
 const prize=document.createElement('p');prize.textContent=`Prize $${campaign.reward?.prize??0} · Clean achievement $${campaign.reward?.cleanBonus??0} · Wallet $${campaignProgress.values.wallet}`;$('resultStats').append(prize);if(campaign.phase==='CHAMPION'){const series=document.createElement('p');series.textContent=campaign.practice?'PRACTICE / CHAMPIONSHIP FINISH':'SERIES COMPLETE / FOUR TRACKS + THREE RIVERS';$('resultStats').append(series);for(const run of campaign.results){const row=document.createElement('p');row.textContent=`${run.track.name} · ${format(run.total)}`;$('resultStats').append(row);}}
}
$('continueJourney').onclick=()=>{$('results').hidden=true;document.activeElement?.blur();release();};
$('saveScore').onclick=()=>{if(!result)return;try{saveScore(scoreStorage,result,$('playerName').value);const rank=board();$('saveScore').disabled=true;$('saveStatus').textContent=rank?`Saved · local position ${rank}`:'Outside the fastest 10';}catch{$('saveStatus').textContent='Storage unavailable. Results remain visible for this race.';}};
$('raceRestart').onclick=()=>{playing=true;restart();engine.start();};
const controlPreferences=new ControlSettings({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)});
function canDrive(){return playing&&!paused&&!document.hidden&&!document.body.classList.contains('pit-open')&&$('results').hidden&&!soundLab.testing&&!document.querySelector('.ui-dialog[open]');}
const controls=bindControls({steering:$('steering'),throttle:$('throttle')},controlPreferences,{canDrive,onAction:controllerAction,onPress:name=>{if(playing){engine.start();if(name==='throttle')doubleTap.press(performance.now());}}});
const {input,release}=controls;
// Older Safari may still dispatch touch gestures: cancel only on play surfaces.
for(const el of [$('game'),document.querySelector('.controls')]){
 for(const event of ['touchstart','touchmove','touchend','gesturestart','gesturechange','contextmenu'])el.addEventListener(event,e=>e.preventDefault(),{passive:false});
}
window.addEventListener('keydown',e=>{if(e.repeat)return;if(paused&&$('pitConsole').hidden&&['p','escape'].includes(e.key.toLowerCase())){e.preventDefault();setPaused(false);return;}if(editingInput(e.target)||soundLab.testing)return;const k=e.key.toLowerCase();if(k==='r')restart();if((k==='p'||k==='escape')&&playing){e.preventDefault();setPaused(!paused);}});
window.addEventListener('blur',()=>{if(fluid?.solver)fluid.solver.accumulator=0;doubleTap.reset();release();engine.pause();});
document.addEventListener('visibilitychange',()=>{doubleTap.reset();release();preferences.flush();audioSettings.flush();controlPreferences.flush();if(document.hidden)engine.pause();else last=performance.now();});
window.addEventListener('pagehide',()=>{preferences.flush();audioSettings.flush();controlPreferences.flush();});
let cameraSyncReady=false;
function applyPreferences(ids){const v=preferences.values;
 for(const id of ids)if(Object.hasOwn(settings,id))settings[id]=v[id];
 if(playing)race.modified||=modified(settings);
 if(ids.includes('graphics')&&summerPreferences.values.baseQuality!==v.graphics){if(v.graphics==='auto')summerPreferences.set('baseQuality','auto');else summerPreferences.preset(v.graphics);}
 if(cameraSyncReady&&ids.includes('cameraResponse'))cameraPreferences.set('classic','lag',1/v.cameraResponse);
 if(ids.includes('graphics')&&graphics.selected!==v.graphics)graphics.select(v.graphics);
 if(ids.includes('fluidResolution'))fluid.setResolution(v.fluidResolution);
 if(ids.includes('waterMode'))fluid.setMode(v.waterMode);
 if(ids.includes('fluidDebug'))fluid.setDebug(v.fluidDebug);
 if(ids.includes('waveScale'))fluid.setWaveScale(v.waveScale);
 if(ids.includes('repeatWaves'))fluid.repeatWaves=v.repeatWaves;
 if(ids.includes('navigationDebug'))navigationView.setDebug(v.navigationDebug);
 if(ids.includes('bigfootDebug'))bigfootView.setDebug(v.bigfootDebug);
 if(ids.includes('mute')||ids.includes('masterVolume'))engine.setPreferences(v.mute,v.masterVolume);
 summerLab?.apply();
}
const settingsUI=mountSettings(preferences,applyPreferences);
const retryScenery=document.createElement('button');retryScenery.id='retryCampaignScenery';retryScenery.textContent='Retry scenery preparation';retryScenery.onclick=()=>campaignStream.retry();settingsUI.groups['Debug Tools'].append(retryScenery);
const physicsLab=mountPhysicsLab(preferences,()=>({boat:b,motion:boatPresentation.motion}),release);
mountSprayLab(preferences,settingsUI.groups['Spray Effects']);
globalThis.__JET_SPRINT_SPRAY__=Object.freeze({inspect:()=>hfSpray.inspect()});
globalThis.__JET_SPRINT_PHYSICS__=Object.freeze({inspect:()=>({build:'PHYSICS-V1',preset:presetName[preferences.values.physicsPreset],settings:{...settings},boat:{...b},roll:boatPresentation.motion.roll,targetRoll:boatPresentation.motion.targetRoll,pitch:boatPresentation.motion.pitch,targetPitch:boatPresentation.motion.targetPitch,heave:boatPresentation.motion.heave,planing:boatPresentation.motion.planing,outletY:boatPresentation.motion.outletY,audioLoad:engine.load||0,audioRPM:engine.rpm,audioBackend:engine.backend||'not started',raceState:startSequence.state,elapsed:race.total,lap:race.laps.length,cameraMode:cameraPreferences.mode})});
const reflectionExcluded=[waterMesh,wakeTrail.mesh,hfSpray.mesh,hfWake.mesh];
summerLab=new SummerRenderer({renderer,scene,sun,store:summerPreferences,water:waterLook,fluid,environment,venue:retroVenue,hfScenery,hfSpray,getReflectionExcluded:()=>{reflectionExcluded.length=4;for(const mesh of campaignStream.waterMeshes)reflectionExcluded.push(mesh);if(fluid.surface)reflectionExcluded.push(fluid.surface.mesh);return reflectionExcluded;},getQuality:()=>quality,waveScale:()=>preferences.values.waveScale/240,getEffects:()=>({particleLimit:hfSpray.budget,activeParticles:hfSpray.activeCount,roosterVisible:hfSpray.activeCount>0,roosterStrength:Math.min(1,hfSpray.rate/1000),spray:hfSpray.inspect(),wakePersistence:wakeTrail.persistence,waterMode:fluid.mode,solverReady:!!fluid.surface,emissionRate:lastEmissionRate,gpuEmissionRate:hfSpray.rate||0,wakeStamps:wakeTrail.fade.reduce((n,a)=>n+Number(a>0),0),cameraMode:cameraPreferences.mode,cameraPosition:camera.position.toArray(),cameraQuaternion:camera.quaternion.toArray(),boat:{...b},raceState:startSequence.state}),updateParticles:()=>{}});
summerPreferences.subscribe(()=>{preferences.set('graphics',summerPreferences.values.baseQuality);vegetationClock=1;campaignStream.configure(summerPreferences.values,quality);});campaignStream.configure(summerPreferences.values,quality);
globalThis.__JET_SPRINT_GRAPHICS__=Object.freeze({inspect:()=>summerLab.inspect(),compare:previous=>summerLab.compare(previous)});
mountGraphicsLab(summerPreferences,$('debug'));
cameraSyncReady=true;
mountCameraPanel(cameraPreferences,$('debug'),()=>{$('courseOverview').checked=false;});
const soundLab=mountSoundLab(audioSettings,engine,{onTestChange:on=>{release();if(!on&&!playing)engine.pause();last=performance.now();}});
soundLab.root.addEventListener('toggle',()=>{if(soundLab.root.open)release();});
bigfootView.mount(settingsUI.groups['Debug Tools'],()=>b,()=>camera);
const controlLab=mountControlLab(controlPreferences,controls);
const interfaceUI=mountInterface({preferences,audioSettings,summerPreferences,cameraPreferences,release,soundLab});
globalThis.__JET_SPRINT_INPUT__=Object.freeze({inspect:()=>controls.inspect()});
trapFocus($('pauseMenu'));
function setPaused(on){if(!playing)return;paused=!!on;release();$('pauseMenu').hidden=!paused;document.body.classList.toggle('paused',paused);$('pauseToggle').setAttribute('aria-expanded',String(paused));if(paused){engine.pause();$('resumeRace').focus();}else{engine.start();document.activeElement?.blur();}last=performance.now();}
$('pauseToggle').onclick=()=>setPaused(!paused);$('resumeRace').onclick=()=>setPaused(false);
$('pauseSetup').onclick=()=>interfaceUI.open('controls');
$('pauseRestart').onclick=()=>{restart();engine.start();};
$('pauseAudio').onclick=async()=>{await engine.start();$('pauseAudioStatus').textContent=engine.ctx?.state==='running'?'Audio enabled.':'This browser needs a tap/click or keyboard gesture to allow audio.';};
function controllerAction(action){
 const dialog=document.querySelector('.ui-dialog[open]'),pit=$('pitConsole'),pause=$('pauseMenu'),results=$('results');
 if(action==='pause'){if(dialog){dialog.querySelector('[data-confirm="false"]')?.click();return;}if(!pit.hidden){interfaceUI.close();return;}setPaused(!paused);return;}
 if(action==='view'){if(!dialog){cameraPreferences.cycle();controls.gamepad.haptic();}return;}
 const root=dialog||(!pit.hidden?pit:!pause.hidden?pause:!results.hidden?results:!playing?$('intro'):null);
 if(action==='back'){if(dialog)dialog.querySelector('[data-confirm="false"]')?.click();else if(!pit.hidden)interfaceUI.close();else if(!results.hidden)$('continueJourney').click();else if(paused)setPaused(false);return;}
 if(root){if(action==='confirm'&&!playing&&!dialog&&pit.hidden&&!root.contains(document.activeElement)){$('start').click();return;}navigateMenu(action,root);controls.gamepad.haptic();}
}
const journeyUI=mountCampaignUI(campaign,campaignProgress,campaignWorld,()=>{if(result){release();$('results').hidden=false;$('continueJourney').focus();}},index=>{campaignStream.previewVenue=index>0?index:null;});
globalThis.__JET_SPRINT_CAMPAIGN__=Object.freeze({inspect:()=>({...campaign.inspect(),raceState:startSequence.state,laps:race.laps.length,lapTarget:race.lapCount,raceTime:race.total,streaming:campaignScenery.inspect(),progress:structuredClone(campaignProgress.values)})});
let b,elapsed=0,lap=1,best=null;
function syncCourse(){venue=campaign.venue;points=venue.points;race=campaign.race;navigator=campaign.navigator;navigationView.setCourse(venue);navigationView.setDebug(preferences.values.navigationDebug);}
function restart(index=campaign.practice?0:campaign.index){cameraSystem.reset();campaign.reset();if(index>0)campaign.resume(index);syncCourse();if(soundLab.testing)soundLab.setTesting(false);const now=performance.now();if(playing&&!paused)gameClock+=Math.max(0,(now-last)/1000);paused=false;$('pauseMenu').hidden=true;document.body.classList.remove('paused');if(document.activeElement?.closest('#pauseMenu,#results'))document.activeElement.blur();$('pauseToggle').setAttribute('aria-expanded','false');last=now;startSequence.reset();playing=document.body.classList.contains('racing');if(playing){startSequence.begin(gameClock,preferences.values.countdownDuration);campaign.begin();}fluid?.reset();fluid?.disturb();race.reset();navigator.reset();race.modified=modified(settings);doubleTap.reset();$('results').hidden=true;result=null;release();engine.reset();const spawn=index>0?campaign.stagingPath.sample(0):start;b={x:spawn.x,z:spawn.z,angle:Math.atan2(spawn.tz,spawn.tx),vx:0,vz:0,pump:0,nozzle:0,yawRate:0};campaignStream.prime(b);elapsed=0;lap=1;wakeTrail.reset();hfSpray.reset();hfWake.reset();boatPresentation.reset();$('notice').textContent='Follow your navigator. Three laps, then upstream.';}
restart();$('restart').onclick=()=>{if(document.body.classList.contains('racing'))playing=true;restart();if(playing)engine.start();};$('start').onclick=()=>{campaignStream.previewVenue=null;playing=true;document.body.classList.add('racing');engine.start();restart(Number($('campaignStart')?.value||0));};
let lastEmissionRate=0;
const hfEffectsOptions={density:1,distance:1,volume:1,effects:1,persistence:3,pose:boatPresentation.motion,impact:0,tuning:preferences.values,emit:true};
function effects(dt,speed){
 const gfx=summerPreferences.values;
 const surfaceSpeed=campaign.airborne?0:speed;
 wakeTrail.update(dt,b,surfaceSpeed,gfx.wakePersistence,gfx.foam*settings.waterVolume/100);
 hfWake.update(dt,b,surfaceSpeed,gfx.wakePersistence,gfx.foam*settings.waterVolume/100);
 hfEffectsOptions.density=gfx.roosterDensity;hfEffectsOptions.distance=settings.sprayDistance/100;hfEffectsOptions.volume=settings.waterVolume/100;hfEffectsOptions.effects=settings.effects;hfEffectsOptions.persistence=gfx.wakePersistence;hfEffectsOptions.impact=boatPresentation.motion.impact;hfEffectsOptions.tuning=preferences.values;hfEffectsOptions.emit=playing&&!campaign.airborne;
 hfSpray.update(dt,b,speed,input,hfEffectsOptions);lastEmissionRate=hfSpray.rate;
}

function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h);cameraSystem.resize(w,h);summerLab?.apply();summerLab?.resize();}window.addEventListener('resize',resize);resize();
const beforeStep={x:0,z:0};
let vegetationClock=0;
function frame(now){requestAnimationFrame(frame);const rawDt=Math.max(0,(now-last)/1000),dt=Math.min(rawDt,.05);last=Math.max(last,now);if(playing&&!paused&&!document.hidden)graphics.sample(rawDt);waterTime.value=now*.001;let speed=Math.hypot(b.vx,b.vz);
 controls.update(dt,speed/(settings.top/3.6));controlLab.update(dt);riverSurface.update(b,dt);
 if(playing&&!paused&&!document.hidden&&!soundLab.testing){
  gameClock+=rawDt;
  const transitions=startSequence.update(gameClock),latestSignal=transitions[transitions.length-1];
  if(latestSignal&&preferences.values.countdownAudio)engine.signal(latestSignal.kind);
  if(startSequence.state==='RACING'||campaign.phase!=='RACE'||campaign.index>0){
   const racingDt=campaign.phase==='RACE'&&campaign.index===0?Math.min(dt,Math.max(0,gameClock-startSequence.startAt)):dt;let advanced=0;
   while(advanced<racingDt-1e-10){const step=Math.min(1/120,racingDt-advanced);beforeStep.x=b.x;beforeStep.z=b.z;if(campaign.beforePhysics(b,step))stepBoat(b,input,step,nearest);advanced+=step;const transition=campaign.step(beforeStep,b,step,settings,gameClock-racingDt+advanced,startSequence);boatPresentation.step(b,step,now*.001-racingDt+advanced);
    if(transition==='race-complete')finish();if(transition==='arrival'){syncCourse();startSequence.begin(gameClock-racingDt+advanced,preferences.values.countdownDuration);campaign.pendingCountdown=false;}
    if(campaign.landed)hfSpray.simulation.impact(b.x,0,b.z,1.5);
    elapsed=race.done?race.total:race.total-race.lapStart;lap=Math.min(campaign.track.laps,race.laps.length+1);best=race.laps.length?Math.min(...race.laps):null;
   }
   speed=Math.hypot(b.vx,b.vz);effects(dt,speed);if(campaign.index===0&&campaign.phase==='RACE')bigfoot.update(dt,b,camera,{speed,distance:settings.sprayDistance/100,volume:settings.waterVolume/100,throttle:input.throttle},()=>engine.vocal(false));engine.update(speed,input.throttle,dt,settings.top/3.6,false,campaign.airborne?0:b.engineLoad);
  }else{b.vx=b.vz=0;speed=0;engine.update(0,preferences.values.prestartRevving?input.throttle:0,dt,settings.top/3.6,true);}
  fluid.focus.x=b.x+Math.cos(b.angle)*7;fluid.focus.z=b.z+Math.sin(b.angle)*7;fluid.update(dt);
 }
 if(soundLab.testing&&!document.hidden){engine.update(0,soundLab.throttle,dt,settings.top/3.6,true);speed=0;}
 soundLab.update();
 if(!playing&&!soundLab.testing){effects(dt,0);}
 retroVenue.update(document.hidden?0:dt,b);
 const navigating=playing&&!paused&&!document.hidden&&!soundLab.testing&&(startSequence.state==='RACING'||campaign.phase!=='RACE');
 if(!navigating&&preferences.values.bigfootDebug&&!document.hidden)bigfoot.update(dt,b,camera);
 let navigationCue=null;
 if(navigating){const cue=navigationCue=campaign.cue(b,dt,input);navigatorHUD.update(cue,!$('debug').open&&!soundLab.root.open&&(campaign.phase==='STAGING'||!preferences.values.startHud||gameClock>=startSequence.startAt+2));const notice=cue.notice||(campaign.phase==='RACE'?'Follow the arrows · Three laps':campaign.phase==='EXIT'?'Race clock stopped · Follow the exit gate':'Bonus: speed + clean gates · Side ramp optional');if($('notice').textContent!==notice)$('notice').textContent=notice;}else navigatorHUD.update(null,false);
 navigationView.update(b,race,navigationCue,navigating&&campaign.phase==='RACE',dt);bigfootView.update(b,dt);
 const lamps=startSequence.lamps(gameClock);trackSignals.forEach((signal,i)=>signal.update(i===campaign.index?lamps:{upper:false,lower:false,green:false}));
 const signalHUD=$('startSignal'),show=startSequence.active&&preferences.values.startHud&&(startSequence.state!=='RACING'||gameClock<startSequence.startAt+2);
 signalHUD.hidden=!show;signalHUD.style.opacity=startSequence.state==='RACING'?String(Math.min(1,Math.max(0,startSequence.startAt+2-gameClock))):'1';
 for(const id of ['upper','lower','green'])$('signal-'+id).classList.toggle('lit',lamps[id]);
 const signalText=startSequence.state==='READY'?'READY':startSequence.state==='COUNTDOWN'?'SET':'GO!';if($('signalText').textContent!==signalText)$('signalText').textContent=signalText;

 if(!playing||startSequence.state!=='RACING'&&campaign.phase==='RACE')boatPresentation.step(b,dt,now*.001);
 boatPresentation.update(b,input,dt,now*.001,engine.rpm,settings.top);boat.position.y+=campaign.height;if(campaign.airborne)boat.rotation.z+=Math.atan2(campaign.verticalVelocity,Math.max(1,speed))*.35;physicsLab.update(dt);
 campaignScenery.update(dt,campaign,b,now*.001);journeyUI.update(dt,result);
 // Rendering-only camera controller: it never writes boat or race state.
 waterBoat.value.set(b.x,0,b.z);waterStrength.value=Math.min(1,speed/20);
 const near=nearest(b.x,b.z),ahead=campaign.phase==='RACE'||!navigationCue?points[(near.index+Math.round(12+speed*.8))%N]:{x:navigationCue.targetX,z:navigationCue.targetZ};
 cameraSystem.overviewCenter.x+=(b.x-cameraSystem.overviewCenter.x)*(1-Math.exp(-dt*3));cameraSystem.overviewCenter.z+=(b.z-cameraSystem.overviewCenter.z)*(1-Math.exp(-dt*3));
 cameraFrame.playing=playing;cameraFrame.top=settings.top;cameraFrame.effects=settings.effects;cameraFrame.overview=$('courseOverview').checked;
 camera=cameraSystem.update(b,boat,ahead,dt,cameraFrame);
 scene.fog.near=cameraFrame.overview?350:105;scene.fog.far=cameraFrame.overview?600:240;
 vegetationClock+=dt;if(vegetationClock>.5){vegetationClock=0;
  vegetationCamera.position.set(b.x,0,b.z+35);
  environment.update(cameraPreferences.mode==='classic'||cameraFrame.overview?camera:vegetationCamera,quality.detail*summerPreferences.values.vegetation);
 }
 summerLab.update(rawDt,cameraSystem.target,cameraFrame.overview);
 const comparison=!!summerLab.comparison;hfSpray.uniforms.comparison.value=Number(comparison);wakeTrail.mesh.visible&&=comparison;hfWake.mesh.visible&&=!comparison;
 setInstrumentText($('speed'),Math.round(speed*3.6));setInstrumentText($('time'),format(elapsed));setInstrumentText($('lap'),`${lap}/${campaign.track.laps}`);setInstrumentText($('best'),best===null?'—':format(best));interfaceUI.update(dt,engine.rpm,audioSettings.values.maxRPM,speed*3.6,settings.top);summerLab.render(camera,dt);}
requestAnimationFrame(frame);
if(import.meta.env.DEV)import('./campaign-debug.js').then(({mountCampaignDebug})=>mountCampaignDebug({campaign,world:campaignWorld,scenery:campaignScenery,startSequence,getRace:()=>race,getBoat:()=>b,getPlaying:()=>playing,getResult:()=>result,getFPS:()=>summerLab.fpsNode.textContent,parent:settingsUI.groups['Debug Tools'],jump:stage=>{
 if(paused)setPaused(false);release();const p=campaign.practiceStage(Number(stage));syncCourse();playing=true;document.body.classList.add('racing');startSequence.finish();if(campaign.phase==='RACE'){startSequence.begin(gameClock,preferences.values.countdownDuration);}race.modified=true;
 Object.assign(b,{x:p.x,z:p.z,angle:Math.atan2(p.tz,p.tx),vx:0,vz:0,pump:0,yawRate:0});campaignStream.prime(b);cameraSystem.reset();boatPresentation.reset();hfSpray.reset();hfWake.reset();wakeTrail.reset();$('results').hidden=true;last=performance.now();
}}));
