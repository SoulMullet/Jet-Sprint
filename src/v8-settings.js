// Deliberately separate from jet-sprint-settings and the handling preset schema.
export const audioKey='jet-sprint-v8-audio-v1';
export const audioPresetsKey='jet-sprint-v8-presets-v1';
const slider=(group,label,value,min=0,max=100,step=1,unit='%')=>({group,label,value,min,max,step,unit});
export const audioRegistry={
 idleRPM:slider('Engine behavior','Idle RPM',880,600,1300,10,' RPM'),
 maxRPM:slider('Engine behavior','Maximum RPM',6500,4500,9000,100,' RPM'),
 throttleResponse:slider('Engine behavior','Throttle response',8,1,20,.5,' /s'),
 rpmRise:slider('Engine behavior','RPM rise speed',4200,600,18000,100,' RPM/s'),
 rpmFall:slider('Engine behavior','RPM fall speed',2600,300,15000,100,' RPM/s'),
 loadEffect:slider('Engine behavior','Engine load effect',65),
 idleInstability:slider('Engine behavior','Idle instability',30),
 camLope:slider('Engine behavior','Camshaft lope intensity',78),
 exhaustBass:slider('Exhaust characteristics','Exhaust bass',72),
 exhaustMid:slider('Exhaust characteristics','Exhaust midrange',56),
 exhaustTreble:slider('Exhaust characteristics','Exhaust treble',24),
 pulseStrength:slider('Exhaust characteristics','Exhaust pulse strength',82),
 resonance:slider('Exhaust characteristics','Exhaust resonance',65),
 rasp:slider('Exhaust characteristics','Exhaust rasp',19),
 growl:slider('Exhaust characteristics','Exhaust growl',68),
 crackle:slider('Exhaust characteristics','Exhaust crackle',12),
 distortion:slider('Exhaust characteristics','Exhaust distortion',24),
 muffler:slider('Exhaust characteristics','Muffler attenuation',28),
 pulseSharpness:slider('Combustion characteristics','Pulse sharpness',38),
 pulseDuration:slider('Combustion characteristics','Pulse duration',42,10,90,1,' ms'),
 pulseIrregularity:slider('Combustion characteristics','Pulse irregularity',24),
 harmonics:slider('Combustion characteristics','Harmonic richness',52),
 rumble:slider('Combustion characteristics','Low-frequency rumble',66),
 mechanical:slider('Combustion characteristics','Mechanical noise',12),
 vibration:slider('Combustion characteristics','Engine vibration',28),
 combustion:slider('Combustion characteristics','Combustion intensity',75),
 volume:slider('Spatial and environmental audio','Overall engine volume',68),
 lowEmphasis:slider('Spatial and environmental audio','Low-frequency emphasis',55),
 water:slider('Spatial and environmental audio','Water/exhaust interaction',28),
 reflections:slider('Spatial and environmental audio','Environmental reflections',14),
 stereoWidth:slider('Spatial and environmental audio','Stereo width',42),
 distance:slider('Spatial and environmental audio','Distance attenuation',16)
};
const defaults=()=>Object.fromEntries(Object.entries(audioRegistry).map(([id,s])=>[id,s.value]));
export const factoryPresets={
 'Big Cam V8 Idle':{...defaults(),idleRPM:820,camLope:94,idleInstability:42,pulseIrregularity:32,exhaustBass:88,pulseDuration:53,growl:82,rumble:82,muffler:35,exhaustTreble:14},
 'Naturally Aspirated Race V8':{...defaults(),idleRPM:1050,maxRPM:8000,camLope:48,idleInstability:18,rpmRise:6800,rpmFall:4200,exhaustMid:72,exhaustTreble:42,harmonics:72,rasp:35,muffler:14,pulseDuration:30},
 'Marine Jet Sprint V8':defaults(),
 'Open Headers V8':{...defaults(),idleRPM:920,camLope:84,pulseStrength:95,exhaustMid:78,exhaustTreble:60,distortion:42,muffler:0,rasp:48,crackle:24,volume:56,pulseSharpness:65}
};
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function validateAudio(input){
 if(!plain(input))throw Error('Audio settings must be an object.');
 const result=defaults();
 for(const [id,s] of Object.entries(audioRegistry)){
  if(!Object.hasOwn(input,id))continue;
  const n=input[id];if(typeof n!=='number'||!Number.isFinite(n))throw Error(s.label+' must be a finite number.');
  result[id]=Number((s.min+Math.round((Math.max(s.min,Math.min(s.max,n))-s.min)/s.step)*s.step).toFixed(4));
 }
 return result;
}
export function parseAudio(text){
 if(typeof text!=='string'||text.length>100000)throw Error('Audio JSON exceeds 100 KB.');
 let data;try{data=JSON.parse(text);}catch{throw Error('Invalid audio JSON.');}
 if(!plain(data)||data.type!=='jet-sprint-v8'||data.schemaVersion!==1)throw Error('Open a V8 Sound Lab export; game/physics presets use their own importer.');
 return {values:validateAudio(data.audio),preset:Object.hasOwn(factoryPresets,data.preset)?data.preset:'Custom'};
}
export class AudioSettings {
 constructor(storage){
  this.storage=storage;this.values=defaults();this.preset='Marine Jet Sprint V8';this.listeners=new Set();this.warning='';this.saved=[];
  try{const text=storage.getItem(audioKey);if(text)Object.assign(this,parseAudio(text));}catch(error){this.warning='Audio settings could not be restored: '+error.message;}
  try{const saved=JSON.parse(storage.getItem(audioPresetsKey)||'[]');if(!Array.isArray(saved))throw Error('Invalid preset collection.');this.saved=saved.slice(0,50).filter(r=>plain(r)&&typeof r.name==='string'&&typeof r.json==='string');}catch(error){this.warning+=' Saved audio presets unavailable: '+error.message;}
 }
 subscribe(fn){this.listeners.add(fn);return ()=>this.listeners.delete(fn);}
 emit(){for(const fn of this.listeners)fn(this.values);}
 change(id,value){if(!Object.hasOwn(audioRegistry,id))throw Error('Unknown audio setting.');this.values=validateAudio({...this.values,[id]:value});this.preset='Custom';this.emit();this.schedule();}
 select(name){if(name==='Custom'){this.preset=name;this.emit();this.schedule();return;}if(!Object.hasOwn(factoryPresets,name))throw Error('Unknown engine preset.');this.values={...factoryPresets[name]};this.preset=name;this.emit();this.schedule();}
 schedule(){clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(),180);}
 flush(){clearTimeout(this.timer);try{this.storage.setItem(audioKey,this.exportText());this.warning='';return true;}catch{this.warning='Sound is active, but this browser cannot save it. Export JSON to keep a copy.';this.emit();return false;}}
 exportText(){return JSON.stringify({type:'jet-sprint-v8',schemaVersion:1,preset:this.preset,audio:this.values},null,2);}
 importText(text){const next=parseAudio(text);this.values=next.values;this.preset=next.preset;this.emit();this.schedule();}
 save(name){name=String(name).trim().slice(0,40);if(!name)throw Error('Enter an audio preset name.');if(this.saved.length>=50&&!this.saved.some(r=>r.name===name))throw Error('Maximum 50 saved audio presets.');const next=[...this.saved.filter(r=>r.name!==name),{name,json:this.exportText()}];this.storage.setItem(audioPresetsKey,JSON.stringify(next));this.saved=next;return name;}
 load(name){const record=this.saved.find(r=>r.name===name);if(!record)throw Error('Choose a saved audio preset.');this.importText(record.json);}
}
