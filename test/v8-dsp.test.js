import test from 'node:test';import assert from 'node:assert/strict';
import {V8Synth,firingBanks} from '../src/v8-dsp.js';import {defaultAudio,enginePresets,audioControls} from '../src/audio-settings.js';
function render(settings,rpm,seconds=2){const synth=new V8Synth(48000,settings),l=new Float32Array(128),r=new Float32Array(128);let peak=0,energy=0,variation=0,last=0;for(let i=0;i<seconds*48000/128;i++){synth.render(l,r,rpm,.5,.4);for(let n=0;n<128;n++){assert.ok(Number.isFinite(l[n])&&Number.isFinite(r[n]));peak=Math.max(peak,Math.abs(l[n]),Math.abs(r[n]));energy+=l[n]**2;variation+=Math.abs(l[n]-last);last=l[n];}}return {synth,peak,energy,variation};}
test('a four-stroke V8 emits eight events per two revolutions, with cross-plane banks',()=>{
 const s={...defaultAudio(),camLope:0,pulseIrregularity:0},out=render(s,900,4);
 assert.ok(Math.abs(out.synth.firings-240)<=1);assert.equal(firingBanks.filter(b=>b===0).length,4);
 assert.notEqual(firingBanks.join(''),'01010101');assert.ok(out.energy>1&&out.peak<.7);
});
test('presets and extreme settings remain finite, bounded and audible from 600 to 9000 RPM',()=>{
 const extremes=[Object.fromEntries(Object.entries(audioControls).map(([k,s])=>[k,s.max])),Object.fromEntries(Object.entries(audioControls).map(([k,s])=>[k,s.min]))];
 for(const s of [...Object.values(enginePresets).map(p=>p.values),...extremes])for(const rpm of [600,900,9000]){const out=render(s,rpm,.3);assert.ok(out.peak<=.7);assert.ok(out.energy>=0);}
});
test('cam lope, pulse duration and harmonics change the rendered idle',()=>{
 const base=defaultAudio(),a=render(base,900),b=render({...base,camLope:0,pulseIrregularity:0},900),c=render({...base,pulseDuration:75,harmonics:90},900);
 assert.ok(Math.abs(a.energy-b.energy)>.01);assert.ok(Math.abs(a.variation-c.variation)>1);
 const synth=a.synth;synth.configure({...base,pulseDuration:15,camLope:100});const l=new Float32Array(128),r=new Float32Array(128);for(let i=0;i<50;i++)synth.render(l,r,900);assert.ok(synth.settings.pulseDuration>15&&synth.settings.pulseDuration<16);
});
