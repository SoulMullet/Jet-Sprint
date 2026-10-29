export const cameraKey='jet-sprint-cameras-v1';
export const cameraModes=['classic','chase','cockpit','overhead'];
export const cameraNames={classic:'Classic Arcade',chase:'Chase',cockpit:'Cockpit',overhead:'Overhead'};
export const cameraDefaults={
 classic:{distance:52,height:52,fov:43,lag:.125,lookAhead:1},
 chase:{distance:11,height:5,fov:62,lag:.18,lookAhead:5},
 cockpit:{height:1.68,fov:72,lag:.1,lookAhead:18},
 overhead:{distance:5,height:65,zoom:1,lag:.14,lookAhead:6}
};
// Limits keep the chase boom above the banks and the eye inside the real seat.
export const cameraControls={
 distance:{label:'Distance',min:6,max:100,step:1,unit:' m'},
 height:{label:'Height',min:3,max:100,step:1,unit:' m'},
 fov:{label:'Field of view',min:35,max:90,step:1,unit:'°'},
 zoom:{label:'Zoom',min:.65,max:2,step:.05,unit:'×'},
 lag:{label:'Camera lag',min:.04,max:.65,step:.005,unit:' s'},
 lookAhead:{label:'Look-ahead',min:0,max:30,step:.5,unit:' m'}
};
export function controlFor(mode,key){
 const base=cameraControls[key];
 if(mode==='classic'&&key==='lookAhead')return {...base,min:0,max:2,step:.05,unit:'×'};
 if(mode==='cockpit'&&key==='height')return {...base,min:1.6,max:1.9,step:.01};
 if(mode==='cockpit'&&key==='lookAhead')return {...base,min:6,max:35};
 if(mode==='chase'&&key==='distance')return {...base,max:26};
 if(mode==='chase'&&key==='height')return {...base,max:14};
 if(mode==='overhead'&&key==='distance')return {...base,min:0,max:15};
 if(mode==='overhead'&&key==='height')return {...base,min:40,max:100};
 if(mode==='classic'&&key==='height')return {...base,min:32};
 return base;
}
const defaults=()=>Object.fromEntries(cameraModes.map(mode=>[mode,{...cameraDefaults[mode]}]));
export class CameraSettings {
 constructor(storage,legacyResponse=8){
  this.storage=storage;this.mode='classic';this.modes=defaults();this.listeners=new Set();this.warning='';
  this.modes.classic.lag=1/Math.max(3,Math.min(12,legacyResponse));
  try{const raw=storage.getItem(cameraKey);if(raw){const data=JSON.parse(raw);if(data.schema!==1)throw Error('Unsupported camera settings.');if(cameraModes.includes(data.mode))this.mode=data.mode;
   for(const mode of cameraModes)for(const key of Object.keys(this.modes[mode])){const value=data.modes?.[mode]?.[key];if(typeof value==='number'&&Number.isFinite(value)){const r=controlFor(mode,key);this.modes[mode][key]=Math.max(r.min,Math.min(r.max,value));}}
  }}catch{this.warning='Camera settings could not be restored; defaults are active.';}
 }
 subscribe(fn){this.listeners.add(fn);return ()=>this.listeners.delete(fn);}
 emit(){for(const fn of this.listeners)fn();}
 save(){try{this.storage.setItem(cameraKey,JSON.stringify({schema:1,mode:this.mode,modes:this.modes}));this.warning='';}catch{this.warning='Camera settings are active; device storage is unavailable.';}this.emit();}
 select(mode){if(!cameraModes.includes(mode))throw Error('Unknown camera mode.');if(mode===this.mode)return;this.mode=mode;this.save();}
 cycle(){this.select(cameraModes[(cameraModes.indexOf(this.mode)+1)%cameraModes.length]);}
 set(mode,key,value){if(!cameraModes.includes(mode)||!Object.hasOwn(cameraDefaults[mode],key)||!Number.isFinite(value))throw Error('Invalid camera setting.');const r=controlFor(mode,key),next=Math.max(r.min,Math.min(r.max,value));if(this.modes[mode][key]===next)return;this.modes[mode][key]=next;this.save();}
 reset(){this.mode='classic';this.modes=defaults();this.save();}
}
