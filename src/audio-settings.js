// Audio has its own schema and keys: existing handling presets are never migrated
// or rewritten by the Sound Lab.
export const AUDIO_KEY='jet-sprint-v8-settings';
export const AUDIO_PRESETS_KEY='jet-sprint-v8-presets';
const control=(group,label,value,min=0,max=100,step=1,unit='%')=>({group,label,default:value,min,max,step,unit});
export const audioControls={
 idleRPM:control('Engine behavior','Idle RPM',900,600,1300,10,' RPM'),
 maxRPM:control('Engine behavior','Maximum RPM',6800,4500,9000,100,' RPM'),
 throttleResponse:control('Engine behavior','Throttle response',65),
 rpmRise:control('Engine behavior','RPM rise speed',55),
 rpmFall:control('Engine behavior','RPM fall speed',40),
 loadEffect:control('Engine behavior','Engine load effect',65),
 idleInstability:control('Engine behavior','Idle instability',28),
 camLope:control('Engine behavior','Camshaft lope intensity',72),
 exhaustBass:control('Exhaust characteristics','Exhaust bass',75),
 exhaustMid:control('Exhaust characteristics','Exhaust midrange',48),
 exhaustTreble:control('Exhaust characteristics','Exhaust treble',25),
 pulseStrength:control('Exhaust characteristics','Exhaust pulse strength',80),
 resonance:control('Exhaust characteristics','Exhaust resonance',62),
 rasp:control('Exhaust characteristics','Exhaust rasp',18),
 growl:control('Exhaust characteristics','Exhaust growl',68),
 crackle:control('Exhaust characteristics','Exhaust crackle',12),
 distortion:control('Exhaust characteristics','Exhaust distortion',24),
 muffler:control('Exhaust characteristics','Muffler attenuation',25),
 pulseSharpness:control('Combustion characteristics','Pulse sharpness',42),
 pulseDuration:control('Combustion characteristics','Pulse duration',44,15,85,1,' ms'),
 pulseIrregularity:control('Combustion characteristics','Pulse irregularity',25),
 harmonics:control('Combustion characteristics','Harmonic richness',45),
 rumble:control('Combustion characteristics','Low-frequency rumble',65),
 mechanical:control('Combustion characteristics','Mechanical noise',15),
 vibration:control('Combustion characteristics','Engine vibration',22),
 combustion:control('Combustion characteristics','Combustion intensity',72),
 engineVolume:control('Spatial and environmental audio','Overall engine volume',75),
 lowEmphasis:control('Spatial and environmental audio','Low-frequency emphasis',60),
 waterInteraction:control('Spatial and environmental audio','Water / exhaust interaction',32),
 reflections:control('Spatial and environmental audio','Environmental reflections',20),
 stereoWidth:control('Spatial and environmental audio','Stereo width',55),
 distance:control('Spatial and environmental audio','Distance attenuation',10)
};
export const defaultAudio=()=>Object.fromEntries(Object.entries(audioControls).map(([key,s])=>[key,s.default]));
const preset=(name,changes)=>({name,values:{...defaultAudio(),...changes}});
export const enginePresets={
 'big-cam':preset('Big Cam V8 Idle',{idleRPM:850,camLope:92,idleInstability:42,pulseIrregularity:38,exhaustBass:88,resonance:78,pulseDuration:55,growl:76,rasp:10}),
 'race':preset('Naturally Aspirated Race V8',{idleRPM:1050,maxRPM:8200,camLope:48,rpmRise:80,rpmFall:65,throttleResponse:85,exhaustMid:66,harmonics:68,rasp:38,muffler:10,pulseDuration:30}),
 'marine':preset('Marine Jet Sprint V8',{}),
 'headers':preset('Open Headers V8',{idleRPM:900,camLope:80,muffler:0,pulseStrength:95,exhaustMid:72,exhaustTreble:55,distortion:42,rasp:45,crackle:32,engineVolume:65})
};
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function validateAudio(values){
 if(!plain(values))throw Error('Audio settings must be an object.');
 const result=defaultAudio();
 for(const [key,s] of Object.entries(audioControls)){
  if(!Object.hasOwn(values,key))continue;
  const value=values[key];if(typeof value!=='number'||!Number.isFinite(value))throw Error(`${s.label} must be a finite number.`);
  result[key]=Number(Math.max(s.min,Math.min(s.max,s.min+Math.round((value-s.min)/s.step)*s.step)).toFixed(4));
 }
 return result;
}
export function parseAudio(text){
 if(typeof text!=='string'||text.length>100000)throw Error('Audio JSON exceeds 100 KB.');
 let data;try{data=JSON.parse(text);}catch{throw Error('Invalid audio JSON.');}
 if(!plain(data)||data.type!=='jet-sprint-v8'||data.schemaVersion!==1)throw Error('Choose a V8 Sound Lab export (schema 1). Physics presets use Game Settings.');
 return {values:validateAudio(data.settings),preset:Object.hasOwn(enginePresets,data.preset)?data.preset:'custom'};
}
export class AudioSettings {
 constructor(storage){
  this.storage=storage;this.values=defaultAudio();this.preset='marine';this.listeners=new Set();this.warning='';this.records=[];
  try{const text=storage.getItem(AUDIO_KEY);if(text)Object.assign(this,parseAudio(text));}catch(e){this.warning=`Audio defaults loaded: ${e.message}`;}
  try{const saved=JSON.parse(storage.getItem(AUDIO_PRESETS_KEY)||'[]');if(!Array.isArray(saved))throw Error('Invalid saved presets.');
   this.records=saved.filter(r=>plain(r)&&typeof r.name==='string'&&typeof r.json==='string').slice(0,50);
  }catch(e){this.warning=e.message;}
 }
 subscribe(fn){this.listeners.add(fn);return ()=>this.listeners.delete(fn);}
 emit(){for(const fn of this.listeners)fn(this.values);}
 set(key,value){if(!Object.hasOwn(audioControls,key))throw Error('Unknown audio control.');this.values=validateAudio({...this.values,[key]:value});this.preset='custom';this.emit();this.schedule();}
 select(id){if(!Object.hasOwn(enginePresets,id))return;this.values={...enginePresets[id].values};this.preset=id;this.emit();this.schedule();}
 reset(){this.select('marine');}
 schedule(){clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(),200);}
 flush(){clearTimeout(this.timer);try{this.storage.setItem(AUDIO_KEY,this.exportText());return true;}catch{this.warning='Audio is active, but storage is unavailable. Export JSON to keep it.';this.emit();return false;}}
 exportText(){return JSON.stringify({type:'jet-sprint-v8',schemaVersion:1,preset:this.preset,settings:this.values},null,2);}
 importText(text){const next=parseAudio(text);this.values=next.values;this.preset=next.preset;this.emit();this.schedule();}
 save(name){name=name.trim().slice(0,40);if(!name)throw Error('Enter a preset name.');const records=[...this.records.filter(r=>r.name.toLowerCase()!==name.toLowerCase()),{name,json:this.exportText()}];if(records.length>50)throw Error('Maximum 50 saved audio presets.');this.storage.setItem(AUDIO_PRESETS_KEY,JSON.stringify(records));this.records=records;}
 load(name){const record=this.records.find(r=>r.name===name);if(!record)throw Error('Choose a saved audio preset.');this.importText(record.json);}
}
