import test from 'node:test';import assert from 'node:assert/strict';import {Engine} from '../src/audio.js';
test('staged and stationary revving reach the selected maximum smoothly and return to idle',()=>{
 const e=new Engine();e.update(0,true,1/60,85/3.6,true);assert.ok(e.rpm>900&&e.rpm<1500);
 for(let i=0;i<300;i++)e.update(0,true,1/60,85/3.6,true);
 assert.ok(e.rpm>e.settings.maxRPM-5&&e.rpm<=e.settings.maxRPM);
 for(let i=0;i<600;i++)e.update(0,false,1/60,85/3.6,true);assert.ok(Math.abs(e.rpm-900)<1);
 e.setSettings({...e.settings,idleRPM:800,maxRPM:4500});e.reset();
 for(let i=0;i<300;i++)e.update(0,.5,1/60,85/3.6,true);assert.ok(Math.abs(e.rpm-2650)<2);
});
test('racing RPM responds to pump load and speed without altering boat physics',()=>{
 const e=new Engine();for(let i=0;i<180;i++)e.update(0,1,1/60);const loaded=e.rpm;
 assert.ok(loaded>900&&loaded<3000);for(let i=0;i<180;i++)e.update(85/3.6,1,1/60);assert.ok(e.rpm>6000);
 const before=e.rpm;e.update(0,0,1/60);assert.ok(e.rpm<before&&e.rpm>before-400);
});
