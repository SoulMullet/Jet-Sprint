import {handlingDefaults} from './handling.js';
export const SETTINGS_SCHEMA=2;
export const GAME_VERSION='0.13.0';
export const settingsKey='jet-sprint-settings';
export const presetsKey='jet-sprint-presets';
const number=(category,label,defaultValue,min,max,step=1,unit='')=>({category,label,type:'number',default:defaultValue,min,max,step,unit});
const choice=(category,label,defaultValue,options)=>({category,label,type:'enum',default:defaultValue,options});
const bool=(category,label,defaultValue)=>({category,label,type:'boolean',default:defaultValue});
export const registry={
 top:number('Boat Handling','Top speed',handlingDefaults.top,85,180,1,' km/h'),drift:number('Boat Handling','Drift',handlingDefaults.drift,0,100,1,'%'),steer:number('Boat Handling','Steering response',handlingDefaults.steer,20,100,1,'%'),acceleration:number('Boat Handling','Acceleration',handlingDefaults.acceleration,15,28),cameraResponse:number('Boat Handling','Camera response',8,3,12),effects:number('Spray Effects','Speed effects',1,.5,1.5,.1),sprayDistance:number('Spray Effects','Spray distance',100,0,200,1,'%'),waterVolume:number('Spray Effects','Water volume',100,0,200,1,'%'),
 nozzleAuthority:number('Boat Handling','Nozzle authority',handlingDefaults.nozzleAuthority,10,45,1,'°'),pumpResponse:number('Boat Handling','Pump response',handlingDefaults.pumpResponse,.03,.5,.01,' s'),pumpDecay:number('Boat Handling','Pump decay',handlingDefaults.pumpDecay,.03,.6,.01,' s'),lateralResistance:number('Boat Handling','Lateral resistance',handlingDefaults.lateralResistance,1,15,.5),yawDamping:number('Boat Handling','Yaw damping',handlingDefaults.yawDamping,1.5,10,.1),
 waterMode:choice('Water Physics','Water mode','legacy',['simulated','legacy']),fluidResolution:choice('Water Physics','Simulation grid','auto',['auto','64','96','128','192']),fluidDebug:choice('Water Physics','Water debug','0',['0','1','2','3']),waveScale:number('Water Physics','Visual wave height',240,0,300,1,'%'),repeatWaves:bool('Water Physics','Repeat diagnostic waves',false),
 graphics:choice('Graphics','Graphics quality','auto',['auto','low','medium','high','ultra']),mute:bool('Audio','Mute all sound',false),masterVolume:number('Audio','Master volume',100,0,100,1,'%'),
 navigationDebug:bool('Debug Tools','Navigation Debug',false),bigfootDebug:bool('Debug Tools','Bigfoot Debug',false),
 countdownDuration:number('Race Start','Countdown seconds (next start)',5,2,15,.5,' s'),countdownAudio:bool('Race Start','Countdown audio',true),startHud:bool('Race Start','Starting light HUD',true),prestartRevving:bool('Race Start','Pre-start engine revving',true)
};
export const defaultSettings=()=>Object.fromEntries(Object.entries(registry).map(([id,s])=>[id,s.default]));
const aliases={topSpeed:'top',steering:'steer',sprayLength:'sprayDistance',graphicsQuality:'graphics',waveExaggeration:'waveScale'};
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const safeKey=k=>!['__proto__','constructor','prototype'].includes(k);
function valueFor(id,value,notes){const s=registry[id];if(s.type==='boolean'){if(typeof value!=='boolean')throw Error(`${s.label} must be true or false.`);return value;}if(s.type==='enum'){if(typeof value!=='string'||!s.options.includes(value))throw Error(`Unsupported ${s.label}.`);return value;}if(typeof value!=='number'||!Number.isFinite(value))throw Error(`${s.label} must be a finite number.`);const clamped=Math.max(s.min,Math.min(s.max,value)),rounded=Math.max(s.min,Math.min(s.max,Math.round((clamped-s.min)/s.step)*s.step+s.min)),result=Number(rounded.toFixed(6));if(result!==value)notes.push(`${s.label} adjusted to ${result}${s.unit}.`);return result;}
const migrations={
 0:input=>({...input,schemaVersion:1,settings:Object.fromEntries(Object.entries(input.settings??input.values).filter(([id])=>safeKey(id)).map(([id,value])=>[Object.hasOwn(aliases,id)?aliases[id]:id,value]))}),
 1:input=>({...input,schemaVersion:2})
};
export function migratePreset(input){
 if(!plain(input))throw Error('Preset must be a JSON object.');
 const schema=input.schemaVersion??input.schema;
 if(!Number.isInteger(schema)||schema<0||schema>SETTINGS_SCHEMA)throw Error('Unsupported settings schema version.');
 let raw=input.settings??input.values;if(!plain(raw))throw Error('Preset needs a settings object.');
 const migrationNotes=[];for(let v=schema;v<SETTINGS_SCHEMA;v++){if(v===0)for(const key of Object.keys(raw))if(Object.hasOwn(aliases,key))migrationNotes.push(`${key} migrated to ${aliases[key]}.`);input=migrations[v](input);migrationNotes.push(`Settings schema ${v} migrated to ${v+1}; existing values retained.`);}raw=input.settings??input.values;
 const values=defaultSettings(),legacy=Object.assign(Object.create(null),plain(input.legacy)?Object.fromEntries(Object.entries(input.legacy).filter(([k])=>safeKey(k))):{}),notes=[...migrationNotes];
 for(const [key,value] of Object.entries(raw)){if(!safeKey(key))continue;const id=key;if(Object.hasOwn(registry,id)){values[id]=valueFor(id,value,notes);}else legacy[key]=value;}
 for(const [id,value] of Object.entries(legacy))if(Object.hasOwn(registry,id)&&!Object.hasOwn(raw,id)){values[id]=valueFor(id,value,notes);delete legacy[id];}
 return {values,legacy,notes};
}
export function parsePreset(text){if(typeof text!=='string'||text.length>200000)throw Error('Preset is too large (maximum 200 KB).');let parsed;try{parsed=JSON.parse(text);}catch{throw Error('Invalid JSON. Paste or open an exported preset.');}return migratePreset(parsed);}
export class SettingsStore {
 constructor(storage){this.storage=storage;this.values=defaultSettings();this.legacy={};this.listeners=new Set();this.warnings=[];this.timer=null;this.restored=false;
  let savedText=null;
  try{const text=savedText=storage.getItem(settingsKey);if(text){const migrated=parsePreset(text);this.values=migrated.values;this.legacy=migrated.legacy;this.warnings.push(...migrated.notes);this.restored=true;this.schedule();return;}}catch(error){if(savedText)this.legacy.unreadableSavedSettings=savedText.slice(0,200000);this.warnings.push(`Saved settings could not be restored: ${error.message}`);}
  // Migrate the two historical keys, without deleting them or touching race data.
  try{const water=JSON.parse(storage.getItem('jet-sprint-water')||'null');if(plain(water))for(const [id,value] of Object.entries(water)){try{if(Object.hasOwn(registry,id))this.values[id]=valueFor(id,value,this.warnings);else if(safeKey(id))this.legacy[id]=value;}catch(error){this.legacy[id]=value;this.warnings.push(error.message);}}}catch(error){this.warnings.push(`Legacy water settings unavailable: ${error.message}`);}
  try{const graphics=storage.getItem('jet-sprint-graphics');if(graphics)this.values.graphics=valueFor('graphics',graphics,this.warnings);}catch(error){this.warnings.push(`Legacy graphics setting unavailable: ${error.message}`);}
  this.schedule();
 }
 subscribe(callback){this.listeners.add(callback);return ()=>this.listeners.delete(callback);}
 set(id,value){if(!Object.hasOwn(registry,id))throw Error('Unknown setting.');const notes=[];const next=valueFor(id,value,notes);if(this.values[id]===next)return;this.values[id]=next;this.emit([id],notes);this.schedule();}
 emit(ids,notes=[]){for(const callback of this.listeners)callback(ids,notes);}
 schedule(){clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(),250);}
 flush(){clearTimeout(this.timer);this.timer=null;try{this.storage.setItem(settingsKey,this.exportText());return true;}catch(error){this.emit([],['Settings are active, but storage is unavailable. Export a backup to keep them.']);return false;}}
 exportText(){return JSON.stringify({schemaVersion:SETTINGS_SCHEMA,gameVersion:GAME_VERSION,exportedAt:new Date().toISOString(),settings:this.values,legacy:this.legacy},null,2);}
 importText(text){const next=parsePreset(text);this.values=next.values;this.legacy=next.legacy;this.emit(Object.keys(registry),next.notes);this.schedule();return next.notes;}
 reset(){this.values=defaultSettings();this.emit(Object.keys(registry));this.schedule();}
}
export class NamedPresets {
 constructor(storage){this.storage=storage;this.records=[];this.warning='';try{const data=JSON.parse(storage.getItem(presetsKey)||'null');if(data){if(data.schemaVersion!==1||!Array.isArray(data.records))throw Error('Unsupported saved preset collection.');this.records=data.records.filter(r=>typeof r.id==='string'&&typeof r.name==='string'&&typeof r.json==='string');}}catch(e){this.warning=e.message;}}
 write(records){this.storage.setItem(presetsKey,JSON.stringify({schemaVersion:1,records}));this.records=records;}
 name(value){const name=value.trim().slice(0,40);if(!name)throw Error('Enter a preset name.');return name;}
 save(name,json,overwrite=false){name=this.name(name);parsePreset(json);const existing=this.records.find(r=>r.name.toLowerCase()===name.toLowerCase());if(existing&&!overwrite)throw Error('A preset with that name already exists.');const item={id:existing?.id||`${Date.now()}-${Math.random()}`,name,json};this.write([...this.records.filter(r=>r.id!==item.id),item]);return item.id;}
 get(id){const item=this.records.find(r=>r.id===id);if(!item)throw Error('Select a saved preset.');return item;}
 rename(id,name){const item=this.get(id);name=this.name(name);if(this.records.some(r=>r.id!==id&&r.name.toLowerCase()===name.toLowerCase()))throw Error('That preset name is already in use.');this.write(this.records.map(r=>r.id===item.id?{...r,name}:r));}
 delete(id){this.get(id);this.write(this.records.filter(r=>r.id!==id));}
}
