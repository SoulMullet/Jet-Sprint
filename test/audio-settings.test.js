import test from 'node:test';import assert from 'node:assert/strict';
import {AudioSettings,AUDIO_KEY,AUDIO_PRESETS_KEY,defaultAudio,parseAudio,audioControls} from '../src/audio-settings.js';
const storage=()=>{const data=new Map([['jet-sprint-settings','existing physics']]);return {data,getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};};
test('all 32 audio controls persist independently and named presets round-trip',()=>{
 const s=storage(),store=new AudioSettings(s);assert.equal(Object.keys(audioControls).length,32);assert.equal(store.preset,'marine');
 store.set('camLope',90);store.set('idleRPM',850);store.flush();store.save('My idle');store.select('race');store.load('My idle');store.flush();
 const restored=new AudioSettings(s);assert.equal(restored.values.camLope,90);assert.equal(restored.values.idleRPM,850);assert.equal(restored.preset,'custom');
 assert.equal(s.data.get('jet-sprint-settings'),'existing physics');assert.ok(s.data.has(AUDIO_KEY)&&s.data.has(AUDIO_PRESETS_KEY));
 restored.reset();restored.flush();assert.deepEqual(restored.values,defaultAudio());assert.equal(restored.records.length,1);
});
test('audio imports validate before mutation, clamp values and reject physics or future schemas',()=>{
 const store=new AudioSettings(storage());const original=store.exportText();
 for(const text of ['{','null',JSON.stringify({type:'jet-sprint-v8',schemaVersion:2,settings:{}}),JSON.stringify({schemaVersion:2,settings:{top:180}}),JSON.stringify({type:'jet-sprint-v8',schemaVersion:1,settings:{camLope:'loud'}})]){assert.throws(()=>store.importText(text));assert.equal(store.exportText(),original);}
 const parsed=parseAudio(JSON.stringify({type:'jet-sprint-v8',schemaVersion:1,settings:{idleRPM:1,maxRPM:20000,camLope:200}}));assert.equal(parsed.values.idleRPM,600);assert.equal(parsed.values.maxRPM,9000);assert.equal(parsed.values.camLope,100);
});
test('unavailable storage keeps live audio usable and provides export',()=>{
 const store=new AudioSettings({getItem(){throw Error('Denied');},setItem(){throw Error('Full');}});store.set('camLope',95);assert.equal(store.flush(),false);assert.equal(parseAudio(store.exportText()).values.camLope,95);assert.match(store.warning,/storage/);
});
