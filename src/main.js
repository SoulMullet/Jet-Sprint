import {createArcadeWorld} from './arcade/river-world.js';
import {ArcadeTuning,mountArcadeTuning} from './arcade/tuning.js';
import {ArcadeRecords,ArcadeService,ArcadeRiverTour,applyArcadeControls} from './arcade/run.js';
import {ArcadeCamera} from './arcade/camera.js';
import {ArcadeScenery} from './arcade/scenery.js';
import {mountModeSelector,mountArcadeUI} from './arcade/ui.js';
import './arcade/arcade.css';
const arcadeMode=new URLSearchParams(location.search).get('mode')==='arcade-river';
import {toMph} from './speed-units.js';
import {handlingDefaults} from './handling.js';
import {careerPropulsionKeys} from './garage/upgrades.js';
import {UpgradeTuning,mountUpgradeLab} from './garage/upgrade-tuning.js';
import {NitrousEffects} from './nitrous-effects.js';
import {RaceMusic,musicURLs} from './race-music.js';
import {RiverEnvironment} from './river-environment.js';
import {PlayerCareer,CareerRiverProgress} from './garage/career.js';
import {MaintenanceTuning,mountMaintenanceLab} from './garage/tuning.js';
import {mountGarage} from './garage/ui.js';
import {createRiverLevels,validateRiverLevels} from './river-levels.js';
import {RiverRunTour} from './river-run.js';
import {mountRiverRunUI,createRiverRunMarkers} from './river-run-ui.js';
import {createReplayFeature} from './replay/feature.js';
import {portableGameData} from './portable-game-data.js';
import {GameplaySettings} from './gameplay-settings.js';
import {mountGameplayLabs} from './gameplay-labs.js';
import {WaterGuidance} from './water-guidance.js';
import {GameplayDiagnostics} from './gameplay-diagnostics.js';
import {reportCourseValidation,validateCampaign} from './course-validation.js';
import * as THREE from 'three';
import './style.css';
import './campaign.css';
import './controls.css';
import './arcade-layout.css';
import './gameplay-polish.css';
import './replay/replay.css';
import './river-run.css';
import './garage/garage.css';
import {protectGameplayGestures} from './gameplay-gestures.js';
import {RacingCameraSettings} from './racing-camera-settings.js';
import {CampaignCameras} from './racing-camera-manager.js';
import {mountRacingCameraLab} from './racing-camera-lab.js';
import {mountOrientationPrompt} from './mobile-orientation.js';
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
import {channel,settings,stepBoat,PHYSICS_STEP} from './physics.js';
import {Engine} from './audio.js';
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
import {RouteNavigator} from './navigation.js';
import {bindControls,editingInput} from './controls.js';
import {ControlSettings} from './control-settings.js';
import {mountControlLab} from './control-lab.js';
import {navigateMenu} from './gamepad-menu.js';
import {trapFocus} from './ui-components.js';
import {createCampaignAdventure,sliceCampaignNetwork} from './campaign-world.js';
import {CampaignStreamer,originBounds} from './campaign-streaming.js';
import {RiverSurface} from './campaign-whitewater.js';
import {TourPresentation} from './campaign-presentation.js';
import {track1,campaignDefinition} from './campaign-data.js';
let replayFeature=null,garage=null,garageWasPaused=false;
await loadGameFonts();
const raceMusic=new RaceMusic({urls:musicURLs(import.meta.env.BASE_URL)});
for(const event of ['pointerdown','keydown'])window.addEventListener(event,()=>raceMusic.unlock(),{capture:true});
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

const arcadeWorld=arcadeMode?createArcadeWorld():null;
const campaignWorld=arcadeWorld?.world??createCampaignAdventure();
const riverLevels=arcadeWorld?.levels??createRiverLevels(campaignWorld);campaignWorld.riverRunLevels=riverLevels;
const profileStorage={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)};
const maintenanceTuning=new MaintenanceTuning(profileStorage);
// Preserve the existing legacy-player migration before Arcade can create shared
// graphics/audio preference saves. Existing career bytes are never rewritten here.
if(arcadeMode){let missing=false;try{missing=!profileStorage.getItem('jet-sprint-player-profile-v1');}catch{}if(missing){const originalWorld=createCampaignAdventure();new PlayerCareer(profileStorage,createRiverLevels(originalWorld),maintenanceTuning,{existingPlayer:preferences.restored});}}
const arcadeTuning=new ArcadeTuning(profileStorage);
const development=new URLSearchParams(location.search).get("dev")==="1";
const upgradeTuning=new UpgradeTuning(profileStorage,{development});
const nitroEffects=new NitrousEffects();
if(!development)for(const id of careerPropulsionKeys)settings[id]=handlingDefaults[id];
if(development)document.body.classList.add("development-practice");
const playerCareer=arcadeMode?null:new PlayerCareer(profileStorage,riverLevels,maintenanceTuning,{existingPlayer:preferences.restored,upgradeTuning,development});
const boatService=arcadeMode?new ArcadeService(arcadeTuning):playerCareer;
const campaignProgress=arcadeMode?new ArcadeRecords(profileStorage,riverLevels):new CareerRiverProgress(playerCareer,()=>input.throttle);
const campaign=arcadeMode?new ArcadeRiverTour(campaignWorld,riverLevels,campaignProgress,arcadeTuning):new RiverRunTour(campaignWorld,riverLevels,campaignProgress);
let venue=campaign.venue,points=venue.points;
document.body.classList.add('river-run');if(arcadeMode)document.body.classList.add('arcade-river');
const visibilitySettings=new GameplaySettings({getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v)});
const courseValidation=[...(arcadeMode?[]:reportCourseValidation(campaignWorld)),...validateRiverLevels(riverLevels)];console.info('[River Run validation]',validateRiverLevels(riverLevels));visibilitySettings.values.debug.checkpoints=preferences.values.navigationDebug;
console.info(`Active track: ${venue.id} / version ${venue.version} / ${campaign.track.routeId}`);
$('buildDebugHud').dataset.track=venue.id;
for(const id of ['buildDebugHud','buildDebug'])$(id).textContent=`${arcadeMode?'ARCADE RIVER':'RIVER RUNS'} · v${__BUILD_VERSION__} · ${__BUILD_COMMIT__}`;
const overview=document.createElement('label');overview.innerHTML='<input id="courseOverview" type="checkbox"> Campaign overview';$('debug').append(overview);
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
// A cheap floor beneath streamed land keeps distant tile silhouettes out of the broad camera view.
const distantGroundGeometry=new THREE.PlaneGeometry(24000,24000);distantGroundGeometry.rotateX(-Math.PI/2);distantGroundGeometry.translate(0,-1.3,-3000);const distantUV=distantGroundGeometry.attributes.uv,distantPosition=distantGroundGeometry.attributes.position;for(let i=0;i<distantUV.count;i++)distantUV.setXY(i,(distantPosition.getX(i)+125)/250,(110-distantPosition.getZ(i))/220);const distantGround=mesh(distantGroundGeometry,environment.ground);distantGround.receiveShadow=true;
const retroVenue=createRetroVenue(scene,nearest);
const campaignStream=new CampaignStreamer(scene,campaignWorld,{water:waterLook.material,ground:environment.ground,bank});campaignStream.prime(venue.points[0]);
const campaignScenery=new TourPresentation(scene,campaignWorld,campaignStream);
const riverEnvironment=new RiverEnvironment(scene,campaignWorld);
const arcadeScenery=arcadeMode?new ArcadeScenery(scene,campaignWorld,waterLook.material):null;
globalThis.__JET_SPRINT_ENVIRONMENT__=Object.freeze({inspect:()=>riverEnvironment.inspect()});
const bigfoot=createBigfoot(scene,forest,nearest);
const start=riverLevels[0].start,startT={x:start.tx,z:start.tz};const stripe=new THREE.Group();stripe.position.set(start.x,.035,start.z);stripe.rotation.y=-Math.atan2(startT.z,startT.x);scene.add(stripe);
for(let x=0;x<2;x++)for(let z=0;z<15;z++)mesh(new THREE.BoxGeometry(.65,.025,.96),(x+z)%2?dark:white,(x-.5)*.65,0,(z-7)*.96,stripe);
for(const side of [-1,1]){mesh(new THREE.BoxGeometry(.25,4,.25),dark,0,2,side*9,stripe);mesh(new THREE.BoxGeometry(.1,1,2),lime,0,3.3,side*8.2,stripe);}
const boat=racingBoat(scene,{cockpitLayers:true});
const markerCanvas=document.createElement('canvas');markerCanvas.width=markerCanvas.height=64;const markerContext=markerCanvas.getContext('2d');markerContext.strokeStyle='#fff0c7';markerContext.lineWidth=4;markerContext.beginPath();markerContext.arc(32,32,23,0,Math.PI*2);markerContext.stroke();const boatMarker=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(markerCanvas),transparent:true,opacity:.75,depthTest:false}));boatMarker.renderOrder=20;scene.add(boatMarker);
const boatPresentation=new BoatPresentation(boat,{tuning:settings,sampleWater:riverSurface.wrapSampler(createWaterSampler(waterLook.uniforms)),fixedStep:true});
const cameraObstacles=scene.children.filter(o=>o.isMesh&&o!==waterMesh&&o!==arcadeScenery?.water);
scene.updateMatrixWorld(true);
const cameraStaticCount=cameraObstacles.length,cameraObstruction=createCameraObstructionQuery(cameraObstacles);
const cameraCollision=(target,position)=>{cameraObstacles.length=cameraStaticCount;campaignStream.appendObstacles(cameraObstacles,target.x,target.z);return cameraObstruction(target,position);};
const arcadeCamera=arcadeMode?new ArcadeCamera(perspective,arcadeTuning,cameraCollision):null;
const legacyCameraSystem=new RacingCameras(perspective,cameraPreferences,(target,position)=>{cameraObstacles.length=cameraStaticCount;campaignStream.appendObstacles(cameraObstacles,target.x,target.z);return cameraObstruction(target,position);});
legacyCameraSystem.overviewCenter={x:-7,z:-28,height:235};
const racingCameraPreferences=new RacingCameraSettings({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)});if(!arcadeMode)for(const level of riverLevels)racingCameraPreferences.inherit(campaignWorld.courses[level.index].id,level.id);if(!arcadeMode)racingCameraPreferences.use(venue.id);
const cameraSystem=new CampaignCameras(perspective,legacyCameraSystem,racingCameraPreferences,campaignWorld,cameraCollision);
let priorCameraMode=cameraPreferences.mode;cameraPreferences.subscribe(()=>{if(priorCameraMode!==cameraPreferences.mode){cameraSystem.debug=true;priorCameraMode=cameraPreferences.mode;}});
const cameraFrame={playing:false,top:85,effects:1,overview:false};
const vegetationCamera={position:new THREE.Vector3()};
// Pooled particles and wake rings: bounded memory and draw calls.
const wakeTrail=new WakeTrail(scene);
const sampleSprayWater=riverSurface.wrapSampler(createWaterSampler(waterLook.uniforms)),sprayWaterSample={height:0,wake:0};
const waterGuidance=new WaterGuidance(scene,visibilitySettings,sampleSprayWater);
const gameplayDiagnostics=new GameplayDiagnostics(scene,campaignWorld,visibilitySettings);
const hfSpray=new HFSpray(scene,waterLook.uniforms,6144,{
 surfaceAt:(x,z)=>{sampleSprayWater(x,z,waterTime.value,sprayWaterSample);return sprayWaterSample.height+sprayWaterSample.wake;},
 isWater:(x,z)=>{const n=nearest(x,z);return Math.hypot(x-n.x,z-n.z)<=(n.waterWidth??channel.water);}
});
const hfWake=new HFWake(scene,waterLook.uniforms);
let fluid=null;
let quality={particles:.7,detail:.7,water:1};
const graphics=new Graphics((preset,name)=>{quality=preset;campaignStream.configure(summerPreferences.values,preset);renderer.setPixelRatio(Math.min(devicePixelRatio,preset.dpr));renderer.setSize(innerWidth,innerHeight);sun.castShadow=!!preset.shadow;renderer.shadowMap.enabled=!!preset.shadow;if(preset.shadow){sun.shadow.mapSize.set(preset.shadow,preset.shadow);sun.shadow.map?.dispose();sun.shadow.map=null;}waterLook.quality.value=preset.water;environment.update(camera,preset.detail);$('graphicsStatus').textContent=name;fluid?.setQuality(name);summerLab?.apply();}, {getItem:()=>preferences.values.graphics,setItem(){}});
fluid=new WaterSystem(renderer,scene,waterMesh,{nearest,width:channel.water,initialMode:arcadeMode?'legacy':preferences.values.waterMode,size:trackConfig.fluidSize,start:{x:start.x+startT.x*7,z:start.z+startT.z*7},quality:graphics.current,onStatus:message=>$('waterStatus').textContent=message});
fluid.setQuality(graphics.current);
if(fluid.solver&&!fluid.solver.available){$('waterMode').value='legacy';$('waterMode').querySelector('[value=simulated]').disabled=true;fluid.setMode('legacy');}



$('testWave').onclick=()=>fluid.disturb(b.x+Math.cos(b.angle)*6,b.z+Math.sin(b.angle)*6);
$('resetWater').onclick=()=>fluid.reset();


const audioSettings=new AudioSettings({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)});
const engine=new Engine({settings:audioSettings.values,baseURL:import.meta.env.BASE_URL});let playing=false,paused=false,gameClock=0,last=performance.now();
const startSequence=new RaceStart(),trackSignals=riverLevels.map(l=>createRaceSignal(scene,l.start,l.start));createRiverRunMarkers(scene,riverLevels);
const doubleTap=createDoubleTap(()=>{if(startSequence.state==='RACING')bigfoot.provoke(b,()=>engine.vocal(true));});
let race=campaign.race;
let navigator=campaign.navigator;
const navigationView=new NavigationView(scene,venue),bigfootView=new BigfootView(scene,bigfoot);
let result=null;
const scoreStorage={getItem(key){try{return localStorage.getItem(key);}catch{return null;}},setItem(key,value){localStorage.setItem(key,value);}};
function board(){const records=readScores(scoreStorage).filter(r=>r.course===result.course&&r.version===gameplayVersion&&r.modified===result.modified).sort((a,b)=>a.total-b.total);
 $('scores').replaceChildren();const note=document.createElement('p');note.textContent=result.modified?'Modified runs':'Standard runs';$('scores').append(note);
 for(const [i,r] of records.entries()){const row=document.createElement('p');row.textContent=`${i+1}. ${r.name} · ${format(r.total)} · best ${format(Math.min(...r.laps))} · ${new Date(r.date).toLocaleDateString()}`;$('scores').append(row);}
 return records.findIndex(r=>r.id===result.id)+1;
}
function finish(){raceMusic.stopRace();startSequence.finish();
 if(campaign.mode==='river-run'){result={id:globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`,course:campaign.level.id,version:gameplayVersion,modified:race.modified||campaign.practice,total:race.total,laps:[],lapCount:0,date:new Date().toISOString()};release();journeyUI.finish(result);$('notice').textContent='River complete · Replay, restart or choose the next river';return;}
 result={id:globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`,course:`${campaign.track.id}/${campaign.track.routeId}`,version:gameplayVersion,modified:race.modified||campaign.practice,total:race.total,laps:[...race.laps],lapCount:campaign.track.laps,date:new Date().toISOString()};
 $('resultStats').replaceChildren();const summary=document.createElement('p');summary.textContent=`Total ${format(result.total)} · Best ${format(Math.min(...result.laps))} · Average ${format(result.total/result.laps.length)} · ${result.modified?'Modified':'Standard'}`;$('resultStats').append(summary);
 const list=document.createElement('ol');for(const t of result.laps){const item=document.createElement('li');item.textContent=format(t);list.append(item);}$('resultStats').append(list);
 $('saveScore').disabled=false;$('saveStatus').textContent='';board();$('notice').textContent=campaign.phase==='CHAMPION'?'Championship complete · Results ready':'Race complete · Follow the river exit';
 const prize=document.createElement('p');prize.textContent=`Prize $${campaign.reward?.prize??0} · Clean achievement $${campaign.reward?.cleanBonus??0} · Wallet $${campaignProgress.values.wallet}`;$('resultStats').append(prize);if(campaign.phase==='CHAMPION'){const series=document.createElement('p');series.textContent=campaign.practice?'PRACTICE / CHAMPIONSHIP FINISH':'SERIES COMPLETE / FOUR TRACKS + THREE RIVERS';$('resultStats').append(series);for(const run of campaign.results){const row=document.createElement('p');row.textContent=`${run.track.name} · ${format(run.total)}`;$('resultStats').append(row);}}
}
$('continueJourney').onclick=()=>{$('results').hidden=true;document.activeElement?.blur();release();};
$('saveScore').onclick=()=>{if(!result||campaign.mode==='river-run')return;try{saveScore(scoreStorage,result,$('playerName').value);const rank=board();$('saveScore').disabled=true;$('saveStatus').textContent=rank?`Saved · local position ${rank}`:'Outside the fastest 10';}catch{$('saveStatus').textContent='Storage unavailable. Results remain visible for this race.';}};
$('raceRestart').onclick=()=>{playing=true;restart();engine.start();};
const controlPreferences=new ControlSettings({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)});
let orientation=null;
function canDrive(){return !garage?.active&&playing&&!paused&&!document.hidden&&!document.body.classList.contains('pit-open')&&$('results').hidden&&!soundLab.testing&&!document.querySelector('.ui-dialog[open]');}
const controls=bindControls({steering:$('steering'),throttle:$('throttle')},controlPreferences,{arcade:true,canDrive:()=>canDrive()&&!orientation?.blocked,onAction:controllerAction,getNitrous:()=>({installed:(playerCareer?.profile.boat.nitrousInstalled??false),fill:(playerCareer?.profile.boat.nitrousFill??0),activation:boatService.balance.nitroActivationThreshold,hysteresis:boatService.balance.nitroHysteresis}),onPress:name=>{if(playing){engine.start();if(name==='throttle')doubleTap.press(performance.now());}}});
const {input}=controls;function release(){controls.release();boatService.stopNitrous();}
protectGameplayGestures($('game'));
window.addEventListener('keydown',e=>{if(e.repeat||replayFeature?.active||garage?.active)return;if(paused&&$('pitConsole').hidden&&['p','escape'].includes(e.key.toLowerCase())){e.preventDefault();setPaused(false);return;}if(arcadeMode&&e.key.toLowerCase()==='r'&&!$('results').hidden){e.preventDefault();restart();engine.start();return;}if(editingInput(e.target)||soundLab.testing)return;const k=e.key.toLowerCase();if(k==='r')restart();if((k==='p'||k==='escape')&&playing){e.preventDefault();setPaused(!paused);}});
window.addEventListener('blur',()=>{if(fluid?.solver)fluid.solver.accumulator=0;doubleTap.reset();release();playerCareer?.flush();engine.pause();});
document.addEventListener('visibilitychange',()=>{doubleTap.reset();release();preferences.flush();audioSettings.flush();controlPreferences.flush();playerCareer?.flush();if(document.hidden){raceMusic.setSuspended(true);engine.pause();}else last=performance.now();});
window.addEventListener('pagehide',()=>{engine.pause(true);raceMusic.stopRace(true);preferences.flush();audioSettings.flush();controlPreferences.flush();playerCareer?.flush();});
let cameraSyncReady=false;
function applyPreferences(ids){const v=preferences.values;
 raceMusic.setPreferences(v.musicVolume,v.musicMute,v.masterVolume,v.mute);
 for(const id of ids)if(Object.hasOwn(settings,id))settings[id]=!development&&careerPropulsionKeys.includes(id)?handlingDefaults[id]:v[id];
 if(playing)race.modified||=modified(settings);
 if(ids.includes('graphics')&&summerPreferences.values.baseQuality!==v.graphics){if(v.graphics==='auto')summerPreferences.set('baseQuality','auto');else summerPreferences.preset(v.graphics);}
 if(cameraSyncReady&&ids.includes('cameraResponse'))cameraPreferences.set('classic','lag',1/v.cameraResponse);
 if(ids.includes('graphics')&&graphics.selected!==v.graphics)graphics.select(v.graphics);
 if(ids.includes('fluidResolution'))fluid.setResolution(v.fluidResolution);
 if(ids.includes('waterMode'))fluid.setMode(arcadeMode?'legacy':v.waterMode);
 if(ids.includes('fluidDebug'))fluid.setDebug(v.fluidDebug);
 if(ids.includes('waveScale'))fluid.setWaveScale(v.waveScale);
 if(ids.includes('repeatWaves'))fluid.repeatWaves=v.repeatWaves;
 if(ids.includes('navigationDebug'))navigationView.setDebug(v.navigationDebug);
 if(ids.includes('bigfootDebug'))bigfootView.setDebug(v.bigfootDebug);
 if(ids.includes('mute')||ids.includes('masterVolume'))engine.setPreferences(v.mute,v.masterVolume);
 summerLab?.apply();
 replayFeature?.noteTuneChange();
}
const settingsUI=mountSettings(preferences,applyPreferences);if(arcadeMode){$('waterMode').closest('label').hidden=true;const note=document.createElement('p');note.textContent='Arcade River uses one continuous lightweight water surface; the original solver preference is retained for Racing.';settingsUI.groups['Water Physics'].prepend(note);}
mountGameplayLabs(visibilitySettings,$('debug'),{validate:()=>{const report=[...(arcadeMode?[]:validateCampaign(campaignWorld,{deep:true})),...validateRiverLevels(riverLevels,waterGuidance.samples,campaign.level.id)];console.info('[Course / collision / navigation validation]',report);return report;},toggleCheckpoints:on=>{preferences.set('navigationDebug',on);navigationView.setDebug(on);}});
globalThis.__JET_SPRINT_VISIBILITY__=Object.freeze({inspect:()=>({settings:structuredClone(visibilitySettings.values),guidance:waterGuidance.inspect(),validation:courseValidation,collision:gameplayDiagnostics.samples,contacts:campaignWorld.collisionNearest.recent})});
const retryScenery=document.createElement('button');retryScenery.id='retryCampaignScenery';retryScenery.textContent='Retry scenery preparation';retryScenery.onclick=()=>campaignStream.retry();settingsUI.groups['Debug Tools'].append(retryScenery);
const physicsLab=mountPhysicsLab(preferences,()=>({boat:b,motion:boatPresentation.motion}),release,{development});if(!arcadeMode){mountMaintenanceLab(physicsLab.root,maintenanceTuning);mountUpgradeLab(physicsLab.root,upgradeTuning);}
const careerPhysicsNote=document.createElement('p');careerPhysicsNote.textContent=arcadeMode?'ARCADE AUTO / Independent speed, recovery and landing assists. No career resources or rewards. Existing hull tuning remains live.':development?'DEVELOPMENT PRACTICE / saved force tuning applies; no prizes or competitive ghosts.':'CAREER / published propulsion balance active. Steering, drift and visual tuning remain live. Saved propulsion values are retained; use ?dev=1 to apply them in practice.';physicsLab.root.prepend(careerPhysicsNote);
for(const id of careerPropulsionKeys){const el=$(id);if(!development||id==='top')el.disabled=true;}
const archivedTop=$('top').closest('label');archivedTop.title='Archived replay target. Career stock speed is set in Development / career performance.';
physicsLab.root.append(settingsUI.groups['River Jumps']);
mountSprayLab(preferences,settingsUI.groups['Spray Effects']);
globalThis.__JET_SPRINT_SPRAY__=Object.freeze({inspect:()=>hfSpray.inspect()});
globalThis.__JET_SPRINT_PHYSICS__=Object.freeze({inspect:()=>({build:'PHYSICS-V1',preset:presetName[preferences.values.physicsPreset],settings:{...settings},boat:{...b},roll:boatPresentation.motion.roll,targetRoll:boatPresentation.motion.targetRoll,pitch:boatPresentation.motion.pitch,targetPitch:boatPresentation.motion.targetPitch,heave:boatPresentation.motion.heave,planing:boatPresentation.motion.planing,outletY:boatPresentation.motion.outletY,audioLoad:engine.load||0,audioRPM:engine.rpm,audioBackend:engine.backend||'not started',careerSpeedMph:boatService.framing().topMph,nitrousActive:boatService.nitrousActive,development,raceState:startSequence.state,elapsed:race.total,lap:race.laps.length,cameraMode:cameraPreferences.mode})});
const reflectionExcluded=[waterMesh,wakeTrail.mesh,hfSpray.mesh,hfWake.mesh,boatMarker];
summerLab=new SummerRenderer({renderer,scene,sun,store:summerPreferences,water:waterLook,fluid,environment,venue:retroVenue,hfScenery,hfSpray,getReflectionExcluded:()=>{reflectionExcluded.length=5;if(arcadeScenery)reflectionExcluded.push(arcadeScenery.water);for(const mesh of campaignStream.waterMeshes)reflectionExcluded.push(mesh);if(fluid.surface)reflectionExcluded.push(fluid.surface.mesh);return reflectionExcluded;},getQuality:()=>quality,waveScale:()=>preferences.values.waveScale/240,getEffects:()=>({particleLimit:hfSpray.budget,activeParticles:hfSpray.activeCount,roosterVisible:hfSpray.mesh.visible&&hfSpray.activeCount>0,roosterStrength:Math.min(1,hfSpray.rate/1000),spray:hfSpray.inspect(),wakePersistence:wakeTrail.persistence,waterMode:fluid.mode,solverReady:!!fluid.surface,emissionRate:lastEmissionRate,gpuEmissionRate:hfSpray.rate||0,wakeStamps:wakeTrail.fade.reduce((n,a)=>n+Number(a>0),0),cameraMode:cameraPreferences.mode,cameraPosition:camera.position.toArray(),cameraQuaternion:camera.quaternion.toArray(),boat:{...b},raceState:startSequence.state}),updateParticles:()=>{}});
summerPreferences.subscribe(()=>{preferences.set('graphics',summerPreferences.values.baseQuality);vegetationClock=1;campaignStream.configure(summerPreferences.values,quality);});campaignStream.configure(summerPreferences.values,quality);
globalThis.__JET_SPRINT_GRAPHICS__=Object.freeze({inspect:()=>summerLab.inspect(),compare:previous=>summerLab.compare(previous)});
mountGraphicsLab(summerPreferences,$('debug'));
cameraSyncReady=true;
mountCameraPanel(cameraPreferences,$('debug'),()=>{$('courseOverview').checked=false;});
if(!arcadeMode)mountRacingCameraLab(racingCameraPreferences,cameraSystem,$('cameraSettings'),campaignWorld);
globalThis.__JET_SPRINT_CAMERA__=Object.freeze({inspect:()=>cameraSystem.inspect()});
globalThis.__JET_SPRINT_ENGINE__=Object.freeze({inspect:()=>engine.inspect()});
const soundLab=mountSoundLab(audioSettings,engine,{onTestChange:on=>{release();if(!on&&(!playing||paused||document.hidden))engine.pause();last=performance.now();}});
const musicSection=document.createElement('details');musicSection.className='settings-section';musicSection.innerHTML='<summary>Race soundtrack</summary><p>Random start / alternating playlist. Music volume is independent of engine volume.</p>';for(const id of ['musicVolume','musicMute'])musicSection.append($(id).closest('label'));const enableMusic=document.createElement('button');enableMusic.id='enableRaceMusic';enableMusic.textContent='Enable / resume music';enableMusic.onclick=()=>raceMusic.unlock();musicSection.append(enableMusic);const musicStatus=document.createElement('p');musicStatus.role='status';musicSection.append(musicStatus);soundLab.root.append(musicSection);globalThis.__JET_SPRINT_MUSIC__=Object.freeze({inspect:()=>raceMusic.inspect()});
soundLab.root.addEventListener('toggle',()=>{if(soundLab.root.open)release();});
bigfootView.mount(settingsUI.groups['Debug Tools'],()=>b,()=>camera);
const controlLab=mountControlLab(controlPreferences,controls);
const arcadeNote=document.createElement('p');arcadeNote.textContent=arcadeMode?'ARCADE AUTO PRESET / Hold LEFT or RIGHT; acceleration and ramp takeoff are automatic. Keyboard and gamepad steering retain your saved response curves.':'Hold LEFT/RIGHT to steer. Slide the throttle thumb upward to 100%, then continue into NITRO without lifting. Archived analog rail calibration settings are retained. Controller and keyboard tuning remain active.';controlLab.root.prepend(arcadeNote);
const replayLabRoot=document.createElement('details');replayLabRoot.id='ghostReplayLab';replayLabRoot.className='settings-section';$('debug').append(replayLabRoot);
const interfaceUI=mountInterface({preferences,audioSettings,summerPreferences,cameraPreferences,release,soundLab});
orientation=mountOrientationPrompt(()=>{release();engine.pause();});
replayFeature=createReplayFeature({world:campaignWorld,scene,boat,cameraSettings:racingCameraPreferences,obstruction:cameraCollision,getTuning:()=>({...settings,careerEngine:(playerCareer?.profile.boat.engineStage??0),careerPump:(playerCareer?.profile.boat.pumpStage??0),careerNitrous:(playerCareer?.profile.boat.nitrousInstalled??false),careerDev:development||arcadeMode,...Object.fromEntries(Object.entries(boatService.balance).map(([k,v])=>["career_"+k,v]))}),build:`${__BUILD_VERSION__}/${__BUILD_COMMIT__}`,root:replayLabRoot,transientVisuals:[hfSpray.mesh,hfWake.mesh,wakeTrail.mesh],storage:scoreStorage,onOpenLab:()=>interfaceUI.open('replays'),onPrime:p=>campaignStream.prime(p),onViewerChange:active=>{release();if(active){if(soundLab.testing)soundLab.setTesting(false);engine.pause();}else{campaignStream.prime(b);if(playing&&!paused&&!orientation.blocked)engine.start();}last=performance.now();},exportFoundation:replaySettings=>portableGameData(campaignWorld,{game:preferences.values,audio:audioSettings.values,graphics:summerPreferences.values,cameras:JSON.parse(racingCameraPreferences.export()),input:controlPreferences.values,visibility:visibilitySettings.values,maintenance:maintenanceTuning.values,replays:replaySettings},`${__BUILD_VERSION__}/${__BUILD_COMMIT__}`)});
globalThis.__JET_SPRINT_REPLAY__=Object.freeze({inspect:()=>replayFeature.inspect()});
globalThis.__JET_SPRINT_INPUT__=Object.freeze({inspect:()=>controls.inspect()});
trapFocus($('pauseMenu'));
function setPaused(on){if(!playing)return;paused=!!on;if(paused)playerCareer?.flush();release();$('pauseMenu').hidden=!paused;document.body.classList.toggle('paused',paused);$('pauseToggle').setAttribute('aria-expanded',String(paused));if(paused){engine.pause();$('resumeRace').focus();}else{engine.start();document.activeElement?.blur();}last=performance.now();}
$('pauseToggle').onclick=()=>setPaused(!paused);$('resumeRace').onclick=()=>setPaused(false);
$('pauseSetup').onclick=()=>interfaceUI.open('controls');
$('pauseRestart').onclick=()=>{restart();engine.start();};
$('pauseAudio').onclick=async()=>{await engine.start();$('pauseAudioStatus').textContent=engine.ctx?.state==='running'?'Audio enabled.':'This browser needs a tap/click or keyboard gesture to allow audio.';};
function controllerAction(action){
 if(garage?.active){if(action==='back'||action==='pause')garage.close();else navigateMenu(action,garage.dialog);return;}
 if(replayFeature?.active){if(action==='back'||action==='pause')replayFeature.close();else if(action==='view'){const mode=replayFeature.cameras.mode==='fixed'?'follow':'fixed';replayFeature.cameras.setMode(mode);$('replayCamera').value=mode;}else navigateMenu(action,replayFeature.viewer);return;}
 const dialog=document.querySelector('.ui-dialog[open]'),pit=$('pitConsole'),pause=$('pauseMenu'),results=$('results');
 if(action==='pause'){if(dialog){dialog.querySelector('[data-confirm="false"]')?.click();return;}if(!pit.hidden){interfaceUI.close();return;}setPaused(!paused);return;}
 if(action==='view'){if(arcadeMode)return;if(!dialog){cameraPreferences.cycle();controls.gamepad.haptic();}return;}
 const root=dialog||(!pit.hidden?pit:!pause.hidden?pause:!results.hidden?results:!playing?$('intro'):null);
 if(action==='back'){if(dialog)dialog.querySelector('[data-confirm="false"]')?.click();else if(!pit.hidden)interfaceUI.close();else if(!results.hidden)(arcadeMode?$('raceRestart'):$('continueJourney')).click();else if(paused)setPaused(false);return;}
 if(root){if(action==='confirm'&&!playing&&!dialog&&pit.hidden&&!root.contains(document.activeElement)){$('start').click();return;}navigateMenu(action,root);controls.gamepad.haptic();}
}
const journeyUI=arcadeMode?mountArcadeUI(campaign,campaignProgress,{getPlaying:()=>playing,getBoat:()=>b,release,retry:()=>{playing=true;restart();engine.start();},onMenu:()=>{playing=false;paused=false;raceMusic.stopRace();release();engine.pause();document.body.classList.remove('racing','paused');$('pauseMenu').hidden=true;restart();}}):mountRiverRunUI(campaign,campaignProgress,riverLevels,{getPlaying:()=>playing,getBoat:()=>b,showResults:()=>{if(result){release();$('results').hidden=false;$('continueJourney').focus();}},onSelect:index=>{if(!playing)restart(index);},onNext:index=>{playing=true;document.body.classList.add('racing');restart(index);engine.start();}});
if(!arcadeMode)garage=mountGarage({career:playerCareer,boat,environment:scene.environment,levels:riverLevels,getPlaying:()=>playing,getLevel:()=>campaign.level,onOpen:()=>{garageWasPaused=paused;release();if(soundLab.testing)soundLab.setTesting(false);if(playing)setPaused(true);engine.pause();},onClose:()=>{if(campaign.reward?.pending&&playerCareer.lastReward?.sequence===campaign.attempt?.sequence){campaign.reward=playerCareer.lastReward;if(result)journeyUI.finish(result);}if(playing&&!garageWasPaused)setPaused(false);last=performance.now();}});
mountModeSelector(arcadeMode);
if(arcadeMode){mountArcadeTuning(physicsLab.root,arcadeTuning,'assist');mountArcadeTuning($('cameraSettings'),arcadeTuning,'camera');}
globalThis.__JET_SPRINT_ARCADE__=Object.freeze({inspect:()=>arcadeMode?{mode:'arcade-river',...campaign.summary(),state:campaign.failed?'FAILED':campaign.done?'FINISHED':startSequence.state,progress:campaign.routeDistance,settings:{...arcadeTuning.values}}:{mode:'racing'}});
globalThis.__JET_SPRINT_GARAGE__=Object.freeze({inspect:()=>garage?.inspect()??{active:false,mode:'arcade-river'}});
globalThis.__JET_SPRINT_CAMPAIGN__=Object.freeze({inspect:()=>({...campaign.inspect(),raceState:startSequence.state,laps:race.laps.length,lapTarget:race.lapCount,raceTime:race.total,streaming:campaignScenery.inspect(),progress:structuredClone(campaignProgress.values)})});
let b,elapsed=0,lap=1,best=null;
function syncCourse(){$('buildDebugHud').dataset.track=campaign.level.id;venue=campaign.venue;points=venue.points;race=campaign.race;navigator=campaign.navigator;navigationView.setCourse(venue);navigationView.setDebug(preferences.values.navigationDebug);}
function restart(index=campaign.index){if(playing)raceMusic.startRace();const keepPractice=campaign.practice&&!campaignProgress.isUnlocked(riverLevels[index]);replayFeature?.reset();cameraSystem.reset();arcadeCamera?.reset();campaign.reset();if(keepPractice)campaign.practiceStage(index);else if(index>0)campaign.resume(index);syncCourse();if(soundLab.testing)soundLab.setTesting(false);const now=performance.now();if(playing&&!paused)gameClock+=Math.max(0,(now-last)/1000);paused=false;$('pauseMenu').hidden=true;document.body.classList.remove('paused');if(document.activeElement?.closest('#pauseMenu,#results'))document.activeElement.blur();$('pauseToggle').setAttribute('aria-expanded','false');last=now;startSequence.reset();playing=document.body.classList.contains('racing');if(playing){startSequence.begin(gameClock,arcadeMode?0:preferences.values.countdownDuration);campaign.begin();}fluid?.reset();fluid?.disturb();race.reset();navigator.reset();race.modified=modified(settings);doubleTap.reset();$('results').hidden=true;result=null;release();engine.reset();const spawn=campaign.level.start;b={x:spawn.x,z:spawn.z,angle:Math.atan2(spawn.tz,spawn.tx),vx:0,vz:0,pump:0,nozzle:0,yawRate:0};campaignStream.prime(b);elapsed=0;lap=0;best=campaignProgress.best(campaign.level.id);wakeTrail.reset();hfSpray.reset();hfWake.reset();boatPresentation.reset();$('notice').textContent='Wait for green, then follow the river to the finish.';journeyUI.update(0,null,true);}
restart();$('restart').onclick=()=>{if(document.body.classList.contains('racing'))playing=true;restart();if(playing)engine.start();};$('start').onclick=()=>{campaignStream.previewVenue=null;playing=true;document.body.classList.add('racing');engine.start();restart(Number($('campaignStart')?.value||0));};
let lastEmissionRate=0;
const hfEffectsOptions={density:1,distance:1,volume:1,effects:1,persistence:3,pose:boatPresentation.motion,impact:0,tuning:preferences.values,emit:true};
function effects(dt,speed){
 const gfx=summerPreferences.values;
 const surfaceSpeed=campaign.airborne?0:speed;
 wakeTrail.update(dt,b,surfaceSpeed,gfx.wakePersistence,gfx.foam*settings.waterVolume/100);
 hfWake.update(dt,b,surfaceSpeed,gfx.wakePersistence,gfx.foam*settings.waterVolume/100);
 hfEffectsOptions.density=gfx.roosterDensity*(1+nitroEffects.amount*.2);hfEffectsOptions.distance=settings.sprayDistance/100;hfEffectsOptions.volume=settings.waterVolume/100;hfEffectsOptions.effects=settings.effects;hfEffectsOptions.persistence=gfx.wakePersistence;hfEffectsOptions.impact=boatPresentation.motion.impact;hfEffectsOptions.tuning=preferences.values;hfEffectsOptions.emit=playing&&!campaign.airborne;
 hfSpray.update(dt,b,speed,input,hfEffectsOptions);lastEmissionRate=hfSpray.rate;
}

function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h);cameraSystem.resize(w,h);arcadeCamera?.resize(w,h);summerLab?.apply();summerLab?.resize();}window.addEventListener('resize',resize);resize();
const beforeStep={x:0,z:0},cameraAhead={},cameraProjection={},engineContact={airborne:false,landed:false};
let vegetationClock=0;
function frame(now){requestAnimationFrame(frame);const rawDt=Math.max(0,(now-last)/1000),dt=Math.min(rawDt,.05);last=Math.max(last,now);const viewing=!!replayFeature?.active;let replayCamera=null,renderBoat=b,renderTour=campaign;if(viewing){replayCamera=replayFeature.update(document.hidden?0:rawDt,campaign,{playing,paused,hidden:document.hidden,width:innerWidth,height:innerHeight});renderBoat=replayFeature.renderBoat;renderTour=replayFeature.renderTour;}if(playing&&!paused&&!document.hidden&&!viewing)graphics.sample(rawDt);waterTime.value=now*.001;let speed=Math.hypot(b.vx,b.vz);const careerPerformance=boatService.framing();engineContact.landed=false;
 controls.update(dt,speed/careerPerformance.topSpeedMps);if(arcadeMode)applyArcadeControls(input,canDrive(),startSequence.state==='RACING',campaign.done);controlLab.update(dt);if(!viewing)riverSurface.update(b,dt);
 if(playing&&!paused&&!document.hidden&&!orientation.blocked&&!soundLab.testing&&!viewing&&!garage?.active){
  gameClock+=rawDt;
  const transitions=startSequence.update(gameClock),latestSignal=transitions[transitions.length-1];
  if(latestSignal&&preferences.values.countdownAudio)engine.signal(latestSignal.kind);
  if(startSequence.state==='RACING'||campaign.done){
   const nitroAllowed=canDrive();const racingDt=!campaign.done?Math.min(dt,Math.max(0,gameClock-startSequence.startAt)):dt;let advanced=0;
   while(advanced<racingDt-1e-10){const step=Math.min(PHYSICS_STEP,racingDt-advanced);beforeStep.x=b.x;beforeStep.z=b.z;if(!arcadeMode)replayFeature.beforeStep(campaign,b,boatPresentation.motion,input,startSequence);if(!arcadeMode)campaign.leaf.jumpTuning=preferences.values;const boatPerformance=boatService.updateNitrous(input,step,nitroAllowed&&!campaign.done);b.nitrous=boatPerformance.nitrous;b.engineStage=boatPerformance.engineStage;if(campaign.beforePhysics(b,step))stepBoat(b,input,step,campaignWorld.collisionNearest,boatPerformance);campaignWorld.collisionNearest.record(b);advanced+=step;const transition=campaign.step(beforeStep,b,step,settings,gameClock-racingDt+advanced,startSequence);boatPresentation.step(b,step,now*.001-racingDt+advanced);if(!arcadeMode){replayFeature.session.noteServicePenalty(boatService.framing().powerScale);replayFeature.afterStep(campaign,b,boatPresentation.motion,input,transition,step);}
    if(transition==='race-complete'||transition==='river-complete'||transition==='arcade-failed')finish();if(transition==='arrival'){syncCourse();startSequence.begin(gameClock-racingDt+advanced,preferences.values.countdownDuration);campaign.pendingCountdown=false;}
    if(campaign.landed){engineContact.landed=true;boatPresentation.land(campaign.landingSpeed);hfSpray.simulation.landingBurst(b,Math.min(6,1+campaign.landingSpeed*.7)*preferences.values.landingSplash);}
    elapsed=race.done?race.total:race.total-race.lapStart;lap=Math.min(campaign.track.laps,race.laps.length+1);best=campaignProgress.best(campaign.level.id);
   }
   speed=Math.hypot(b.vx,b.vz);effects(dt,speed);if(campaign.index===0&&campaign.phase==='RACE')bigfoot.update(dt,b,camera,{speed,distance:settings.sprayDistance/100,volume:settings.waterVolume/100,throttle:input.throttle},()=>engine.vocal(false));engineContact.airborne=campaign.airborne;engine.update(speed,input.throttle,dt,careerPerformance.topSpeedMps,false,campaign.airborne?0:b.engineLoad,b,engineContact);
  }else{b.vx=b.vz=0;speed=0;playerCareer?.step(dt,b,null,preferences.values.prestartRevving?input.throttle:0);engine.update(0,preferences.values.prestartRevving?input.throttle:0,dt,careerPerformance.topSpeedMps,true);}
  fluid.focus.x=b.x+Math.cos(b.angle)*7;fluid.focus.z=b.z+Math.sin(b.angle)*7;fluid.update(dt);
 }
 if(soundLab.testing&&!document.hidden){soundLab.stepTest(dt);engine.update(0,soundLab.throttle,dt,careerPerformance.topSpeedMps,false,.7,null,soundLab.contact);speed=0;}
 if(!playing&&raceMusic.active)raceMusic.stopRace();
 raceMusic.setSuspended(paused||document.hidden||orientation.blocked||!!garage?.active||viewing||soundLab.testing);
 if(musicStatus.textContent!==raceMusic.status)musicStatus.textContent=raceMusic.status;
 soundLab.update();
 if(!playing&&!soundLab.testing&&!viewing){effects(dt,0);}
 retroVenue.update(document.hidden?0:dt,b);
 const navigating=playing&&!paused&&!document.hidden&&!soundLab.testing&&!viewing&&(startSequence.state==='RACING'||campaign.done);
 if(!navigating&&preferences.values.bigfootDebug&&!document.hidden)bigfoot.update(dt,b,camera);
 let navigationCue=null;
 if(navigating){const cue=navigationCue=campaign.cue(b,dt,input);const notice=cue.notice||(campaign.done?'Run complete · Clock stopped':'Follow the river arrows · Start to finish');if($('notice').textContent!==notice)$('notice').textContent=notice;}
 waterGuidance.update(paused?0:dt,campaign,b,navigationCue,waterTime.value,playing&&!viewing);
 navigationView.update(b,race,navigationCue,navigating,dt);bigfootView.update(b,dt);
 const lamps=startSequence.lamps(gameClock);trackSignals.forEach((signal,i)=>signal.update(i===campaign.index?lamps:{upper:false,lower:false,green:false}));
 const signalHUD=$('startSignal'),show=startSequence.active&&preferences.values.startHud&&(startSequence.state!=='RACING'||gameClock<startSequence.startAt+.24);
 signalHUD.hidden=!show||viewing;signalHUD.style.opacity='1';signalHUD.classList.toggle('leaving',startSequence.state==='RACING');
 for(const id of ['upper','lower','green'])$('signal-'+id).classList.toggle('lit',lamps[id]);
 const signalText=startSequence.state==='READY'?'READY':startSequence.state==='COUNTDOWN'?'SET':'GO!';if($('signalText').textContent!==signalText)$('signalText').textContent=signalText;

 if(!viewing&&(!playing||startSequence.state!=='RACING'&&!campaign.done))boatPresentation.step(b,dt,now*.001);
 boatPresentation.update(b,input,dt,now*.001,engine.rpm,careerPerformance.topMph*1.609344,campaign);physicsLab.update(dt);
 if(!viewing)replayFeature.update(document.hidden?0:rawDt,campaign,{playing,paused,hidden:document.hidden,width:innerWidth,height:innerHeight});
 campaignScenery.update(dt,renderTour,renderBoat,now*.001);riverEnvironment.update(playing&&!paused&&!garage?.active&&!viewing&&!document.hidden?dt:0,renderBoat,summerPreferences.values);journeyUI.update(dt,result);garage?.update(dt);arcadeScenery?.update(now*.001,campaign);
 // Rendering-only camera controller: it never writes boat or race state.
 if(!viewing){waterBoat.value.set(b.x,0,b.z);waterStrength.value=Math.min(1,speed/20);}
 const cameraPath=campaign.level.route,ahead=navigationCue?{x:navigationCue.targetX,z:navigationCue.targetZ}:cameraPath.sample(Math.min(cameraPath.length,cameraPath.project(b,0,cameraPath.length,cameraProjection).distance+12+speed*.8),cameraAhead);
 if(!viewing){cameraSystem.overviewCenter.x+=(b.x-cameraSystem.overviewCenter.x)*(1-Math.exp(-dt*3));cameraSystem.overviewCenter.z+=(b.z-cameraSystem.overviewCenter.z)*(1-Math.exp(-dt*3));}
 cameraFrame.playing=playing;cameraFrame.top=careerPerformance.topMph*1.609344;cameraFrame.effects=settings.effects;cameraFrame.overview=$('courseOverview').checked;
 cameraFrame.tour=campaign;
 nitroEffects.restore();camera=viewing?replayCamera:arcadeCamera?arcadeCamera.update(b,boat,campaign,paused||orientation.blocked?0:Math.min(rawDt,.1)):cameraSystem.update(b,boat,ahead,paused||orientation.blocked?0:Math.min(rawDt,.25),cameraFrame);
 nitroEffects.update(camera,dt,boatService.nitrousActive,boatService.balance.nitroCameraIntensity,!viewing&&playing&&!paused&&!garage?.active&&!orientation.blocked);
 gameplayDiagnostics.update(dt,b,campaign,camera);if(viewing)gameplayDiagnostics.group.visible=false;
 boatMarker.visible=!arcadeMode&&!viewing&&!!racingCameraPreferences.values.flat.marker&&cameraSystem.state!=='RIVER_FOLLOW'&&!cameraSystem.debug;boatMarker.position.set(b.x,boat.position.y+3,b.z);const markerSize=7*Math.max(1,Math.min(4,12/Math.max(1,cameraSystem.boatPixels??12)));boatMarker.scale.set(markerSize,markerSize,1);
 if(!cameraSystem.debug){const label=$('cameraSwitch').querySelector('span');const name=cameraSystem.state==='FLAT_TRACK_FIXED'?'Track':cameraSystem.state==='RIVER_FOLLOW'?'River':'Sweep';if(label)label.textContent=name;$('cameraSwitch').dataset.tooltip=`${name} camera / developer comparison`;$('cameraSwitch').setAttribute('aria-label',`Camera: ${name}. Switch to developer comparison`);}
 const viewDistance=camera.position.distanceTo(viewing?replayFeature.cameras.target:(arcadeCamera?.target??cameraSystem.target));
 vegetationClock+=dt;if(vegetationClock>.5){vegetationClock=0;
  vegetationCamera.position.set(renderBoat.x,0,renderBoat.z+35);
  environment.update(viewing||!cameraSystem.debug&&cameraSystem.state==='FLAT_TRACK_FIXED'||cameraPreferences.mode==='classic'||cameraFrame.overview?camera:vegetationCamera,quality.detail*summerPreferences.values.vegetation);
 }
 summerLab.update(rawDt,viewing?replayFeature.cameras.target:(arcadeCamera?.target??cameraSystem.target),cameraFrame.overview);
 const fogShift=Math.max(0,viewDistance-70);scene.fog.near+=fogShift;scene.fog.far+=fogShift;
 if(viewing)hfSpray.mesh.visible=false;if(arcadeMode){waterMesh.visible=false;for(const water of campaignStream.waterMeshes)water.visible=false;}
 const comparison=!!summerLab.comparison;hfSpray.uniforms.comparison.value=Number(comparison);wakeTrail.mesh.visible&&=comparison&&!viewing;hfWake.mesh.visible&&=!comparison&&!viewing;
 setInstrumentText($('speed'),Math.round(toMph(speed)));setInstrumentText($('time'),format(elapsed));setInstrumentText($('lap'),`${lap}/${campaign.track.laps}`);setInstrumentText($('best'),best===null?'—':format(best));interfaceUI.update(dt,engine.rpm,audioSettings.values.maxRPM,toMph(speed),Math.max(150,careerPerformance.topMph*(1+boatService.balance.nitroSpeedInfluence)));if(garage?.active)garage.render(renderer,dt);else summerLab.render(camera,dt);}
requestAnimationFrame(frame);
import('./campaign-debug.js').then(({mountCampaignDebug})=>mountCampaignDebug({campaign,world:campaignWorld,scenery:campaignScenery,startSequence,getRace:()=>race,getBoat:()=>b,getPlaying:()=>playing,getResult:()=>result,getFPS:()=>summerLab.fpsNode.textContent,parent:settingsUI.groups['Debug Tools'],jump:stage=>{
 replayFeature.reset();if(paused)setPaused(false);interfaceUI.close();release();engine.start();result=null;elapsed=0;lap=1;best=null;const p=campaign.practiceStage(Number(stage));syncCourse();playing=true;document.body.classList.add('racing');startSequence.finish();startSequence.begin(gameClock,arcadeMode?0:preferences.values.countdownDuration);race.modified=true;
 raceMusic.startRace();Object.assign(b,{x:p.x,z:p.z,angle:Math.atan2(p.tz,p.tx),vx:0,vz:0,pump:0,nozzle:0,yawRate:0,collisionImpulse:0});campaignStream.previewVenue=null;campaignStream.prime(b);cameraSystem.reset();boatPresentation.reset();hfSpray.reset();hfWake.reset();wakeTrail.reset();$('results').hidden=true;last=performance.now();
}}));
