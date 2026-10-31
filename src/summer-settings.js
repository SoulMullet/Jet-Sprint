export const summerKey='jet-sprint-summer-graphics-v1';
const n=(group,label,value,min,max,step=.05)=>({group,label,value,min,max,step});
export const summerControls={
 waveIntensity:n('Water','Wave intensity',.8,0,2),waveSpeed:n('Water','Wave speed',1,0,2),reflections:n('Water','Reflection strength',1.1,0,2),transparency:n('Water','Water transparency',.12,0,.45),foam:n('Water','Foam intensity',1,0,2),roosterDensity:n('Water','Rooster-tail density',1,0,2),sprayCount:n('Water','Spray particle limit',896,128,1200,16),wakePersistence:n('Water','Wake persistence (s)',3, .5,6,.1),
 sunElevation:n('Lighting','Sun elevation (degrees)',35,15,75,1),sunWarmth:n('Lighting','Sun warmth',.65,0,1),ambient:n('Lighting','Ambient brightness',1.25,.4,2),haze:n('Lighting','Atmospheric haze',.7,0,2),bloom:n('Lighting','Highlight bloom',.12,0,.5,.01),exposure:n('Lighting','Exposure',1.05,.6,1.5,.01),saturation:n('Lighting','Color saturation',1.08,.7,1.35,.01),
 vegetation:n('Environment','Vegetation density',.85,.2,1),spectators:n('Environment','Spectator density',1,.25,1),drawDistance:n('Environment','Object draw distance (m)',160,60,220,10),particleQuality:n('Environment','Particle quality',.9,.25,1),
 resolutionScale:n('Performance','Resolution scale',1,.5,1),pixelRatioCap:n('Performance','Pixel ratio cap',1.7,1,2,.1),shadowResolution:n('Performance','Shadow resolution',1024,256,2048,256)
};
export const summerOptions={waterDetail:['low','medium','high','ultra'],reflectionQuality:['off','low','medium','high'],postQuality:['off','low','high'],wildlife:['on','off']};
export const summerDefaults=()=>({...Object.fromEntries(Object.entries(summerControls).map(([k,v])=>[k,v.value])),shadows:'soft',showFPS:false,baseQuality:'high',preset:'high',waterDetail:'high',reflectionQuality:'medium',postQuality:'low',wildlife:'on'});
export const summerProfiles={
 low:{baseQuality:'low',waterDetail:'low',reflectionQuality:'off',postQuality:'off',resolutionScale:.8,pixelRatioCap:1,shadowResolution:256,shadows:'off',bloom:0,saturation:1,vegetation:.4,spectators:.5,drawDistance:95,particleQuality:.4,sprayCount:256},
 medium:{baseQuality:'medium',waterDetail:'medium',reflectionQuality:'off',postQuality:'off',resolutionScale:.9,pixelRatioCap:1.35,shadowResolution:512,bloom:0,saturation:1,vegetation:.65,spectators:.75,drawDistance:125,particleQuality:.65,sprayCount:640},
 high:{baseQuality:'high'},ultra:{baseQuality:'ultra',waterDetail:'ultra',reflectionQuality:'high',postQuality:'high',pixelRatioCap:2,shadowResolution:2048,bloom:.1,saturation:1.02,vegetation:1,particleQuality:1,sprayCount:1200,drawDistance:220}
};
// Preserve old exported Mobile profiles and button integrations.
summerProfiles.mobile=summerProfiles.low;
export function detectedSummerPreset(mobile=false,memory=8){return mobile?(memory<=4?'low':'medium'):'high';}
export function parseSummer(text){
 if(typeof text!=='string'||text.length>30000)throw Error('Graphics JSON must be smaller than 30 KB.');
 const data=JSON.parse(text);if(data?.type!=='jet-sprint-summer-graphics'||data.schema!==1||!data.values||typeof data.values!=='object'||Array.isArray(data.values))throw Error('This is not a Summer graphics preset.');
 const values=summerDefaults(),legacyProfile=summerProfiles[data.values.preset]||summerProfiles[data.values.baseQuality];
 // New expensive features inherit an old preset's budget without replacing any saved knob.
 if(legacyProfile)for(const key of Object.keys(summerOptions))if(legacyProfile[key]!==undefined)values[key]=legacyProfile[key];
 for(const [key,value] of Object.entries(data.values)){
  if(Object.hasOwn(summerControls,key)){if(typeof value!=='number'||!Number.isFinite(value))throw Error(`${key} must be finite.`);const r=summerControls[key];values[key]=Math.max(r.min,Math.min(r.max,value));}
  else if(key==='baseQuality'){if(!['auto','low','medium','high','ultra'].includes(value))throw Error('Invalid graphics preset.');values[key]=value;}
  else if(Object.hasOwn(summerOptions,key)){if(!summerOptions[key].includes(value))throw Error(`Invalid ${key}.`);values[key]=value;}
  else if(key==='shadows'){if(!['off','soft'].includes(value))throw Error('Invalid shadow quality.');values[key]=value;}
  else if(key==='showFPS'){if(typeof value!=='boolean')throw Error('Invalid FPS toggle.');values[key]=value;}
  else if(key==='preset')values[key]=['mobile','low','medium','high','ultra','custom'].includes(value)?value:'custom';
 }
 values.shadowResolution=2**Math.round(Math.log2(values.shadowResolution));return values;
}
export class SummerSettings {
 constructor(storage,mobile=false){this.storage=storage;this.listeners=new Set();this.warning='';const preset=detectedSummerPreset(mobile,globalThis.navigator?.deviceMemory||4);this.values={...summerDefaults(),...summerProfiles[preset],preset};this.restored=false;try{const data=storage.getItem(summerKey);if(data){this.values=parseSummer(data);this.restored=true;}}catch{this.warning='Saved graphics could not be restored; defaults are active.';}}
 subscribe(fn){this.listeners.add(fn);return ()=>this.listeners.delete(fn);}
 export(){return JSON.stringify({type:'jet-sprint-summer-graphics',schema:1,values:this.values},null,2);}
 save(action='change'){try{this.storage.setItem(summerKey,this.export());this.warning='';}catch{this.warning='Graphics are live, but storage is unavailable. Copy JSON to keep them.';}for(const fn of this.listeners)fn(action);}
 set(key,value){if(!Object.hasOwn(summerControls,key)&&!Object.hasOwn(summerOptions,key)&&!['shadows','showFPS','baseQuality'].includes(key))throw Error('Unknown graphics control.');const next=parseSummer(JSON.stringify({type:'jet-sprint-summer-graphics',schema:1,values:{...this.values,[key]:value}}));next.preset='custom';this.values=next;this.save();}
 preset(name){if(!Object.hasOwn(summerProfiles,name))throw Error('Unknown graphics preset.');this.values={...summerDefaults(),...summerProfiles[name],preset:name};this.save('preset');}
 reset(){this.values=summerDefaults();this.save('reset');}
 import(text){this.values=parseSummer(text);this.save('import');}
}
