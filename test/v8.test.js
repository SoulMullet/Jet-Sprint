import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioSettings,audioRegistry,audioKey,audioPresetsKey,factoryPresets,parseAudio,validateAudio} from '../src/v8-settings.js';
import {V8Core,firingBanks} from '../src/v8-core.js';
import {Engine} from '../src/audio.js';
const defaults=factoryPresets['Marine Jet Sprint V8'];
function storage(){const map=new Map([['jet-sprint-settings','physics-original'],['jet-sprint-presets','physics-presets'],['jet-sprint-scores','scores-original']]);return {map,getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};}
test('all 32 sound sliders and all engine presets roundtrip independently of physics settings',()=>{
 assert.equal(Object.keys(audioRegistry).length,32);
 const s=storage(),a=new AudioSettings(s);assert.equal(a.preset,'Marine Jet Sprint V8');assert.equal(a.values.idleRPM,880);
 for(const name of Object.keys(factoryPresets)){a.select(name);a.flush();const b=new AudioSettings(s);assert.equal(b.preset,name);assert.deepEqual(b.values,a.values);}
 for(const [id,r] of Object.entries(audioRegistry))a.change(id,r.max);
 a.save('My idle');a.change('idleRPM',600);a.load('My idle');a.flush();assert.equal(a.values.idleRPM,1300);assert.equal(a.preset,'Custom');assert.ok(s.map.has(audioKey)&&s.map.has(audioPresetsKey));
 assert.equal(s.map.get('jet-sprint-settings'),'physics-original');assert.equal(s.map.get('jet-sprint-presets'),'physics-presets');assert.equal(s.map.get('jet-sprint-scores'),'scores-original');
 a.select('Marine Jet Sprint V8');a.importText(new AudioSettings(s).exportText());assert.equal(a.values.idleRPM,1300);a.flush();
});
test('audio import is atomic, clamps bounds and rejects non-audio/corrupt data',()=>{
 const a=new AudioSettings(storage()),before=a.exportText();for(const json of ['{}','null','{','{"schemaVersion":2,"settings":{}}','{"type":"jet-sprint-v8","schemaVersion":1,"audio":{"idleRPM":"bad"}}']){assert.throws(()=>a.importText(json));assert.equal(a.exportText(),before);}
 assert.equal(validateAudio({idleRPM:99000}).idleRPM,1300);assert.equal(validateAudio({maxRPM:0}).maxRPM,4500);assert.throws(()=>validateAudio({pulseDuration:NaN}));
});
test('storage denial preserves live edits and JSON export with a visible warning',()=>{
 const a=new AudioSettings({getItem(){throw Error('denied');},setItem(){throw Error('denied');}});a.change('camLope',90);assert.equal(a.flush(),false);assert.match(a.warning,/cannot save/);assert.equal(parseAudio(a.exportText()).values.camLope,90);
});
function render(v,rpm,seconds=2){const core=new V8Core(48000,v),l=new Float32Array(128),r=new Float32Array(128);core.setState(rpm,rpm===v.idleRPM?0:1);let peak=0,total=0,samples=0;for(let b=0;b<seconds*48000/128;b++){core.render(l,r);for(let i=0;i<l.length;i++){assert.ok(Number.isFinite(l[i])&&Number.isFinite(r[i]));peak=Math.max(peak,Math.abs(l[i]),Math.abs(r[i]));total+=l[i]*l[i];samples++;}}return {core,peak,rms:Math.sqrt(total/samples)};}
test('four-stroke firing clock emits eight pulses per 720 degrees without skipped cylinders',()=>{
 assert.deepEqual(firingBanks,[0,1,1,0,1,0,0,1]);const v={...defaults,camLope:0,idleInstability:0,pulseIrregularity:0};const {core}=render(v,900,4);assert.ok(Math.abs(core.events-4*900/15)<4);
});
test('factory voices and all slider extremes stay finite with headroom at idle and redline',()=>{
 for(const v of [...Object.values(factoryPresets),validateAudio(Object.fromEntries(Object.entries(audioRegistry).map(([id,s])=>[id,s.min]))),validateAudio(Object.fromEntries(Object.entries(audioRegistry).map(([id,s])=>[id,s.max])))]){
  for(const rpm of [v.idleRPM,v.maxRPM]){const out=render(v,rpm);assert.ok(out.peak<2,'DSP source must retain headroom for the output safety chain');if(v.pulseStrength>0||v.rumble>0)assert.ok(out.rms>.001);}
 }
});
test('live extreme edits are smoothed instead of resetting the pulse phase or jumping gain',()=>{
 const core=new V8Core(48000,defaults),l=new Float32Array(128),r=new Float32Array(128);for(let i=0;i<200;i++)core.render(l,r);const last=l[127],events=core.events;core.configure({...defaults,pulseStrength:100,combustion:100,camLope:100,pulseDuration:90});core.render(l,r);assert.ok(Math.abs(l[0]-last)<.1);assert.ok(core.values.pulseDuration>42&&core.values.pulseDuration<46);assert.ok(core.events>=events);
});
test('fractional throttle, configurable rise/fall and load change only audio RPM',()=>{
 const e=new Engine();e.update(0,.5,1/60,30,true);assert.ok(e.rpm>880&&e.rpm<1000);for(let i=0;i<300;i++)e.update(0,.5,1/60,30,true);assert.ok(Math.abs(e.rpm-(880+(6500-880)*.5))<2);
 for(let i=0;i<300;i++)e.update(0,0,1/60,30,true);assert.ok(e.rpm<881);
 const slow=new Engine({...defaults,rpmRise:600}),fast=new Engine({...defaults,rpmRise:18000});for(let i=0;i<60;i++){slow.update(0,1,1/60,30,true);fast.update(0,1,1/60,30,true);}assert.ok(fast.rpm>slow.rpm+2000);
});
