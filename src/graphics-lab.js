import * as THREE from 'three';
import {SummerPost} from './summer-post.js';
import {summerControls} from './summer-settings.js';
export function mountGraphicsLab(store,parent){
 const root=document.createElement('details');root.id='graphicsLab';root.className='settings-section';const title=document.createElement('summary');title.textContent='Graphics Quality Lab';root.append(title);parent.prepend(root);
 const status=document.createElement('p');status.id='summerStatus';status.role='status';root.append(status);
 const toolbar=document.createElement('div');root.append(toolbar);for(const name of ['mobile','high','ultra']){const b=document.createElement('button');b.type='button';b.id='summer-'+name;b.textContent=name[0].toUpperCase()+name.slice(1)+' preset';b.onclick=()=>store.preset(name);toolbar.append(b);}
 const groups={};for(const [key,r] of Object.entries(summerControls)){
  if(!groups[r.group]){const d=document.createElement('details');d.className='summer-group';const s=document.createElement('summary');s.textContent=r.group;d.append(s);root.append(d);groups[r.group]=d;}
  const l=document.createElement('label'),out=document.createElement('output'),input=document.createElement(key==='shadowResolution'?'select':'input');l.textContent=r.label+' ';out.id='summer-'+key+'-value';if(key==='shadowResolution'){for(const size of [256,512,1024,2048]){const o=document.createElement('option');o.value=size;o.textContent=size+' px';input.append(o);}}else input.type='range';input.id='summer-'+key;input.min=r.min;input.max=r.max;input.step=r.step;input.setAttribute('aria-label',r.label);input.oninput=input.onchange=()=>store.set(key,Number(input.value));l.append(out,input);groups[r.group].append(l);
 }
 const shadowLabel=document.createElement('label');shadowLabel.textContent='Shadow quality ';const shadow=document.createElement('select');shadow.id='summer-shadows';for(const v of ['off','soft']){const o=document.createElement('option');o.value=v;o.textContent=v;shadow.append(o);}shadow.onchange=()=>store.set('shadows',shadow.value);shadowLabel.append(shadow);groups.Lighting.append(shadowLabel);
 const baseLabel=document.createElement('label');baseLabel.textContent='Adaptive graphics preset ';const base=document.createElement('select');base.id='summer-baseQuality';for(const v of ['auto','low','medium','high']){const o=document.createElement('option');o.value=v;o.textContent=v;base.append(o);}base.onchange=()=>store.set('baseQuality',base.value);baseLabel.append(base);groups.Performance.append(baseLabel);
 const fpsLabel=document.createElement('label'),fps=document.createElement('input');fps.type='checkbox';fps.id='summer-showFPS';fps.onchange=()=>store.set('showFPS',fps.checked);fpsLabel.append(fps,document.createTextNode(' Show FPS'));groups.Performance.append(fpsLabel);
 const json=document.createElement('textarea');json.id='summerJSON';json.rows=6;json.setAttribute('aria-label','Summer graphics settings JSON');root.append(json);
 const action=(label,id,fn)=>{const b=document.createElement('button');b.type='button';b.id=id;b.textContent=label;b.onclick=async()=>{try{await fn();}catch(e){status.textContent=e.message;}};root.append(b);};
 action('Copy settings JSON','summer-copy',async()=>{json.value=store.export();try{await navigator.clipboard.writeText(json.value);status.textContent='Graphics JSON copied.';}catch{json.focus();status.textContent='Select and copy the JSON below.';}});
 action('Paste JSON','summer-paste',async()=>{try{json.value=await navigator.clipboard.readText();status.textContent='Review JSON, then Import.';}catch{json.focus();status.textContent='Paste into the JSON box, then Import.';}});
 action('Import JSON','summer-import',()=>store.import(json.value));action('Reset graphics defaults','summer-reset',()=>store.reset());
 const refresh=()=>{for(const key of Object.keys(summerControls)){document.getElementById('summer-'+key).value=store.values[key];document.getElementById('summer-'+key+'-value').textContent=Number(store.values[key].toFixed(2));}base.value=store.values.baseQuality;shadow.value=store.values.shadows;fps.checked=store.values.showFPS;status.textContent=store.warning||`SUMMER 1987 · ${store.values.preset} · settings update live`;};store.subscribe(refresh);refresh();
}
export class SummerRenderer {
 constructor({renderer,scene,sun,store,water,fluid,environment,venue,getQuality,updateParticles,waveScale=()=>1,getEffects=()=>({})}){
  Object.assign(this,{renderer,scene,sun,store,water,fluid,environment,venue,getQuality,updateParticles,waveScale,getEffects});this.post=new SummerPost(renderer,scene);this.ambient=scene.children.find(x=>x.isHemisphereLight);this.frames=0;this.elapsed=0;this.fpsNode=document.createElement('div');this.fpsNode.id='summerFPS';document.body.append(this.fpsNode);this.apply();store.subscribe(()=>this.apply());
 }
 apply(){
  const v=this.store.values,q=this.getQuality();const dpr=Math.min(devicePixelRatio,v.pixelRatioCap,q.dpr)*v.resolutionScale,resize=dpr!==this.lastDpr||innerWidth!==this.lastWidth||innerHeight!==this.lastHeight;
  if(resize){this.renderer.setPixelRatio(dpr);this.renderer.setSize(innerWidth,innerHeight);this.lastDpr=dpr;this.lastWidth=innerWidth;this.lastHeight=innerHeight;}this.updateParticles(dpr);
  const shadow=v.shadows==='soft',res=2**Math.floor(Math.log2(v.shadowResolution*Math.min(1,q.dpr/1.35)));this.renderer.shadowMap.enabled=shadow;this.sun.castShadow=shadow;if(!shadow&&this.sun.shadow.map){this.sun.shadow.map.dispose();this.sun.shadow.map=null;}
  if(this.sun.shadow.mapSize.x!==res){this.sun.shadow.map?.dispose();this.sun.shadow.map=null;this.sun.shadow.mapSize.set(res,res);}
  this.sun.color.setRGB(1,.98-v.sunWarmth*.16,.92-v.sunWarmth*.28);this.ambient.intensity=v.ambient;this.renderer.toneMappingExposure=v.exposure;
  const materials=[this.water.material,this.fluid.surface?.material];for(const m of materials){if(!m)continue;m.envMapIntensity=v.reflections;m.opacity=1-v.transparency;m.transparent=true;m.depthWrite=false;}
  this.fluid.timeScale=v.waveSpeed;this.fluid.setWaveScale(this.waveScale()*240*v.waveIntensity/.8);
  this.water.uniforms.summerWaves.value=v.waveIntensity*this.waveScale();this.water.uniforms.summerSpeed.value=v.waveSpeed;this.water.uniforms.summerFoam.value=v.foam;
  this.venue.setDensity?.(v.spectators);this.environment.drawDistance=v.drawDistance;
  this.post.configure(v.bloom,v.saturation);if(resize)this.post.resize();this.fpsNode.hidden=!v.showFPS;
 }
 update(dt,target,overview){
  const v=this.store.values,angle=v.sunElevation*Math.PI/180;this.sun.position.set(target.x-70*Math.cos(angle),Math.sin(angle)*90,target.z+45*Math.cos(angle));this.sun.target.position.set(target.x,0,target.z);this.venue.setDrawDistance?.(v.drawDistance,target);
  this.scene.fog.near=overview?350:70+70*(1-v.haze/2);this.scene.fog.far=overview?650:Math.max(150,v.drawDistance+120-v.haze*50);
  if(dt>2)return;this.frames++;this.elapsed+=dt;if(this.elapsed>=.75){this.fpsNode.textContent=`${Math.round(this.frames/this.elapsed)} FPS · ${this.renderer.domElement.width}×${this.renderer.domElement.height}`;this.elapsed=0;this.frames=0;}
 }
 inspect(){const u=this.water.uniforms,v=this.store.values;return {build:'summer-1987',pixelRatio:this.renderer.getPixelRatio(),width:this.renderer.domElement.width,height:this.renderer.domElement.height,shadows:this.sun.castShadow,shadowResolution:this.sun.shadow.mapSize.x,exposure:this.renderer.toneMappingExposure,sunY:this.sun.position.y,sunColor:this.sun.color.toArray(),ambient:this.ambient.intensity,hazeNear:this.scene.fog.near,hazeFar:this.scene.fog.far,water:{simulationWaveScale:this.fluid.waveScale,simulationSpeed:this.fluid.timeScale,waves:u.summerWaves.value,speed:u.summerSpeed.value,foam:u.summerFoam.value,reflections:this.water.material.envMapIntensity,opacity:this.water.material.opacity},spectators:this.venue.getSpectatorCount?.(),drawDistance:this.environment.drawDistance,visibleTrees:this.environment.visibleTrees,visiblePropBatches:this.venue.staticMeshes.filter(m=>m.visible).length,bloom:this.post.grade?.uniforms.bloom.value||0,saturation:this.post.grade?.uniforms.saturation.value||1,postEnabled:this.post.enabled,fpsVisible:!this.fpsNode.hidden,...this.getEffects()};}
 resize(){this.post.resize();}
 render(camera){this.post.render(camera);}
}
