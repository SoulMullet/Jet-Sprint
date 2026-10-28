import test from 'node:test';
import assert from 'node:assert/strict';
import {settings,channel,stepBoat} from '../src/physics.js';
import {createCourse} from '../src/course.js';
import {trackConfig} from '../src/track-layout.js';
const open=(x,z)=>({x,z,index:0});
const fresh=()=>({x:0,z:0,angle:0,vx:0,vz:0});
const drive={throttle:true,left:false,right:false};
test('full throttle approaches configured 85 km/h',()=>{const b=fresh();for(let i=0;i<3600;i++)stepBoat(b,drive,1/120,open);assert.ok(Math.abs(Math.hypot(b.vx,b.vz)*3.6-settings.top)<2);});
test('steering responds immediately and coast slows down',()=>{const b=fresh();stepBoat(b,{...drive,right:true},1/120,open);assert.ok(b.angle>0);b.vx=20;const before=Math.hypot(b.vx,b.vz);for(let i=0;i<120;i++)stepBoat(b,{left:false,right:false,throttle:false},1/120,open);assert.ok(Math.hypot(b.vx,b.vz)<before);});
test('bank collision bounds the hull and reflects outward momentum',()=>{const b={...fresh(),z:7,vz:10};stepBoat(b,{},1/120,(x)=>({x,z:0,index:0}));assert.ok(b.z<=channel.hullLimit);assert.ok(b.vz<0);for(let i=0;i<600;i++)stepBoat(b,drive,1/120,(x)=>({x,z:0,index:0}));assert.ok(Number.isFinite(b.x));assert.ok(Math.abs(b.z)<=channel.hullLimit);assert.ok(b.x>1);});
test('drift tuning retains more lateral momentum',()=>{const saved=settings.drift;const run=d=>{settings.drift=d;const b={...fresh(),vx:12,vz:8};stepBoat(b,{},1/120,open);return b.vz;};assert.ok(run(100)>run(0));settings.drift=saved;});

test('steering responsiveness scales powered yaw while release retains damped inertia',()=>{const saved=settings.steer;const run=tuning=>{settings.steer=tuning;const b={...fresh(),vx:18};for(let i=0;i<30;i++)stepBoat(b,{right:true,throttle:true},1/120,open);return b;};const old=run(75),b=run(85);assert.ok(b.angle>old.angle*1.1);assert.ok(b.yawRate<2);const before=b.yawRate;for(let i=0;i<24;i++)stepBoat(b,{},1/120,open);assert.ok(b.yawRate<before);for(let i=0;i<48;i++)stepBoat(b,{},1/120,open);assert.ok(b.yawRate<before*.15);settings.steer=saved;});
test('editable network stays in the solver domain and channels retain hull clearance',()=>{const c=createCourse();for(const edge of c.edges)for(const {x,z} of edge.points){assert.ok(Number.isFinite(x)&&Number.isFinite(z));assert.ok(Math.abs(x)+channel.bank<trackConfig.fluidSize/2&&Math.abs(z)+channel.bank<trackConfig.fluidSize/2);}assert.ok(channel.water>5.9);assert.ok(channel.hullLimit<channel.water);});
test('the visible water contains the whole hull at any drift angle',()=>{assert.ok(channel.water-channel.hullLimit>=2.5);});
test('extended 180 km/h setting converges and bank contact remains bounded',()=>{const saved=settings.top;settings.top=180;try{const b=fresh();for(let i=0;i<7200;i++)stepBoat(b,drive,1/120,open);assert.ok(Math.abs(Math.hypot(b.vx,b.vz)*3.6-180)<3);const c={...fresh(),z:6.4,vz:50};for(let i=0;i<120;i++)stepBoat(c,{},1/120,x=>({x,z:0,index:0}));assert.ok(Math.abs(c.z)<=channel.hullLimit);}finally{settings.top=saved;}});
