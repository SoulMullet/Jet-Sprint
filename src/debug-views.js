import * as THREE from 'three';
import {interfaceFont,repaintAfterFonts} from './typography.js';
function spriteLabel(text,color='#dfff72',width=256,height=64){
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d'),texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));sprite.renderOrder=12;
 let value=text;const set=text=>{value=text;ctx.clearRect(0,0,width,height);ctx.fillStyle='#102b32e8';ctx.fillRect(0,0,width,height);ctx.strokeStyle=color;ctx.lineWidth=4;ctx.strokeRect(2,2,width-4,height-4);ctx.fillStyle=color;ctx.font=`600 34px ${interfaceFont}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,width/2,height/2);texture.needsUpdate=true;};set(text);repaintAfterFonts(()=>set(value));
 sprite.scale.set(5,5*height/width,1);return {sprite,set};
}
function line(points,color,segments=false){const geometry=new THREE.BufferGeometry().setFromPoints(points),material=new THREE.LineBasicMaterial({color,transparent:true,opacity:.8,depthTest:false,depthWrite:false});const mesh=segments?new THREE.LineSegments(geometry,material):new THREE.Line(geometry,material);mesh.renderOrder=10;return mesh;}
const v=(x,y,z)=>new THREE.Vector3(x,y,z);
const reasons={approaching:'Approaching: no forward crossing yet','beyond-plane':'Ahead of plane: waiting for a valid crossing','outside-width':'Rejected: outside gate boundary','adjacent-channel':'Rejected: adjacent channel','wrong-direction':'Rejected: reverse crossing',accepted:'Accepted: forward crossing inside boundary'};
function readout(id){const el=document.createElement('div');el.id=id;el.className='debug-readout';el.hidden=true;el.setAttribute('role','status');document.body.append(el);return el;}
export class NavigationView {
 constructor(scene,course){
  this.scene=scene;this.course=course;this.enabled=false;this.group=new THREE.Group();this.group.name='Navigation Debug';this.group.visible=false;scene.add(this.group);this.built=false;this.labels=[];this.labelGroups=new Map();
  this.target=spriteLabel('◇ NEXT GATE','#dfff72');this.target.sprite.scale.set(3.6,.9,1);scene.add(this.target.sprite);this.target.sprite.visible=false;
  this.status=readout('navigationDebugReadout');this.age=0;
 }
 build(){
  if(this.built)return;this.built=true;
  const route=this.course.line.map(p=>v(p.x,.45,p.z));route.push(route[0].clone());this.group.add(line(route,'#4ce5ff'));
  const boundaries=[];
  this.course.gates.forEach((g,i)=>{
   const key=`${g.x.toFixed(2)},${g.z.toFixed(2)}`,shared=this.labelGroups.get(key);
   if(shared){shared.indices.push(i);shared.label.set(shared.indices.join(' / '));this.labels.push(shared.label.sprite);return;}
   const w=g.halfWidth||7.1,nx=-g.tz,nz=g.tx;
   boundaries.push(v(g.x-nx*w,.8,g.z-nz*w),v(g.x+nx*w,.8,g.z+nz*w));
   // Arrow points in the required direction of crossing, not toward a waypoint.
   boundaries.push(v(g.x-g.tx*2,.8,g.z-g.tz*2),v(g.x+g.tx*2,.8,g.z+g.tz*2));
   for(const side of [-1,1])boundaries.push(v(g.x+g.tx*.6+nx*side,.8,g.z+g.tz*.6+nz*side),v(g.x+g.tx*2,.8,g.z+g.tz*2));
   const label=spriteLabel(i===0?'0 · FINISH':String(i),'#e7faf3',128,64);label.sprite.position.set(g.x,2.2,g.z);label.sprite.scale.set(2.4,1.2,1);this.group.add(label.sprite);this.labels.push(label.sprite);this.labelGroups.set(key,{label,indices:[i]});
  });
  this.group.add(line(boundaries,'#e1efce',true));this.active=line([v(0,0,0),v(0,0,0)],'#e0ff3e');this.group.add(this.active);this.targetLine=line([v(0,0,0),v(0,0,0)],'#e0ff3e');this.group.add(this.targetLine);
 }
 setDebug(enabled){this.enabled=enabled;if(enabled)this.build();this.group.visible=enabled;this.status.hidden=!enabled;}
 setCourse(course){if(this.course===course)return;this.group.traverse(o=>{o.geometry?.dispose();if(o.material){o.material.map?.dispose();o.material.dispose();}});this.group.clear();this.course=course;this.built=false;this.labels=[];this.labelGroups.clear();this.lastGate=null;if(this.enabled)this.build();}
 update(boat,race,cue,visible,dt){
  const gateIndex=race.done?0:race.next,g=this.course.gates[gateIndex];this.target.sprite.visible=visible&&this.enabled;
  if(visible)this.target.sprite.position.set(cue?.targetX??g.x,1.8,cue?.targetZ??g.z);
  if(!this.enabled)return;
  const link=this.targetLine.geometry.attributes.position;link.setXYZ(0,boat.x,.65,boat.z);link.setXYZ(1,cue?.targetX??g.x,.65,cue?.targetZ??g.z);link.needsUpdate=true;this.targetLine.geometry.computeBoundingSphere();
  if(this.lastGate!==gateIndex){this.lastGate=gateIndex;for(const {label,indices} of this.labelGroups.values()){const active=indices.includes(gateIndex);label.sprite.material.color.set(active?'#f6ff55':'#ffffff');label.sprite.scale.set(active?3.3:2.4,active?1.65:1.2,1);}
   const p=this.active.geometry.attributes.position,w=g.halfWidth||7.1;p.setXYZ(0,g.x+g.tz*w,1,g.z-g.tx*w);p.setXYZ(1,g.x-g.tz*w,1,g.z+g.tx*w);p.needsUpdate=true;this.active.geometry.computeBoundingSphere();}
  this.age+=dt;if(this.age<.1)return;this.age=0;
  const last=race.lastCrossing,reason=race.done?`Finished: all ${race.lapCount} laps accepted`:race.check.gate!==race.next?'Approaching: previous gate accepted':reasons[race.check.code]||race.check.code;
  this.status.textContent=`NAV DEBUG · Gate ${gateIndex}/${this.course.gates.length-1}\n${reason}\nTarget ${(cue?.targetX??g.x).toFixed(1)}, ${(cue?.targetZ??g.z).toFixed(1)} · side ${race.check.signed.toFixed(1)} m · offset ${race.check.lateral.toFixed(1)} m${cue?`\nRoute: ${cue.reason}`:''}${last?`\nLast: gate ${last.gate} · ${reasons[last.code]}`:''}`;
 }
}
export class BigfootView {
 constructor(scene,actor){
  this.actor=actor;this.enabled=false;this.status=readout('bigfootDebugReadout');this.status.classList.add('bigfoot-readout');
  this.label=spriteLabel('BIGFOOT · HIDDEN','#ffc17d',512,64);this.label.sprite.scale.set(9,1.15,1);scene.add(this.label.sprite);this.label.sprite.visible=false;
  this.path=line([v(0,0,0),v(0,0,0)],'#ffb46b');scene.add(this.path);this.path.visible=false;this.age=0;
 }
 setDebug(enabled){this.enabled=enabled;this.label.sprite.visible=this.path.visible=enabled;this.status.hidden=!enabled;if(this.controls)this.controls.hidden=!enabled;}
 mount(panel,boat,camera){
  const wrap=document.createElement('div');wrap.hidden=!this.enabled;this.controls=wrap;panel.append(wrap);
  const trigger=document.createElement('button');trigger.id='triggerBigfoot';trigger.type='button';trigger.textContent='Trigger Bigfoot Now';trigger.onclick=()=>{const ok=this.actor.triggerNow(boat(),typeof camera==='function'?camera():camera);this.status.textContent=ok?'Bigfoot triggered · Walking to Shore':'No safe shoreline corridor available.';};
  const reset=document.createElement('button');reset.id='resetBigfoot';reset.type='button';reset.textContent='Reset Bigfoot';reset.onclick=()=>this.actor.reset();wrap.append(trigger,reset);
 }
 update(boat,dt){
  if(!this.enabled)return;const state=this.actor.getDebugState(boat),p=state.position;this.label.sprite.position.set(p.x,7,p.z);
  const text=`BIGFOOT · ${state.state.toUpperCase()}${state.reaction!=='normal'?` · ${state.reaction.toUpperCase()}`:''}`;
  if(text!==this.lastLabel){this.label.set(text);this.lastLabel=text;}
  const positions=this.path.geometry.attributes.position;for(let i=0;i<2;i++)positions.setXYZ(i,state.path[i].x,.7,state.path[i].z);positions.needsUpdate=true;this.path.geometry.computeBoundingSphere();
  this.age+=dt;if(this.age<.1)return;this.age=0;
  this.status.textContent=`BIGFOOT DEBUG · ${state.state}${state.reaction!=='normal'?` (${state.reaction})`:''}\nPosition ${p.x.toFixed(1)}, ${p.z.toFixed(1)} · ${state.distance.toFixed(1)} m from boat\nSafe encounter sites: ${state.sites}`;
 }
}
