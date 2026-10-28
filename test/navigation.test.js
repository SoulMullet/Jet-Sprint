import test from 'node:test';
import assert from 'node:assert/strict';
import {createCourse,prescribedRoute} from '../src/course.js';
import {RouteNavigator} from '../src/navigation.js';
import {Race,defaults} from '../src/race.js';
import {nearestOnTrack,channelGeometry,channelBankGeometry} from '../src/track.js';
import {channel} from '../src/physics.js';
import {makeDomain} from '../src/fluid/numerics.js';
const venue=createCourse();
test('network has shared intersections, alternate routes and separate closed race walk',()=>{
 assert.equal(venue.network.paths.length,11);assert.ok(venue.gates.length>=18&&venue.gates.length<40);
 const alternate=createCourse(['S-A','A-D','D-B','B-C','C-S']);assert.notEqual(alternate.length,venue.length);assert.deepEqual(alternate.edges.map(e=>e.points.map(p=>[p.x,p.z])),venue.edges.map(e=>e.points.map(p=>[p.x,p.z])));
 assert.throws(()=>createCourse([...prescribedRoute,'S-A']));
 for(const p of venue.gates){const q=nearestOnTrack(venue.network,p.x,p.z);assert.ok(Math.hypot(q.x-p.x,q.z-p.z)<.03);}
});
test('following the actual prescribed route completes exactly five laps with stable cues',()=>{
 const r=new Race(venue.gates,channel.hullLimit),nav=new RouteNavigator(venue,channel.hullLimit);let before=venue.sample(0),wrong=0;const cueIds=new Set();
 for(let d=.25;d<=venue.length*5+1&&!r.done;d+=.25){const after=venue.sample(d);after.angle=Math.atan2(after.tz,after.tx);r.step(before,after,.01,defaults);const cue=nav.update(after,r,.01);wrong+=Number(cue.wrong);cueIds.add(cue.kind);before=after;}
 assert.equal(r.done,true);assert.equal(r.laps.length,5);assert.equal(wrong,0);assert.ok(cueIds.has('sharp-right'));assert.ok(cueIds.has('straight'));
});
test('wrong branch cannot skip gates; recovery must cross the same required gate',()=>{
 const r=new Race(venue.gates,channel.hullLimit),nav=new RouteNavigator(venue,channel.hullLimit);let before=venue.sample(0);
 for(let d=.25;d<70;d+=.25){const after=venue.sample(d);r.step(before,after,.01,defaults);before=after;}
 const required=r.next;
 // Drive the outer A-D alternative, away from the required A-J interior branch.
 const edge=venue.edges.find(e=>e.id==='A-D');for(const after of edge.points){r.step(before,after,.05,defaults);nav.update({...after,angle:0},r,.05);before=after;}
 assert.equal(r.laps.length,0);assert.ok(r.next<required+4);assert.equal(nav.wrong,true);const missed=r.next;
 const g=venue.gates[missed],back={x:g.x-g.tx*2,z:g.z-g.tz*2};r.step(before,back,.01,defaults);r.step(back,{x:g.x+g.tx*.1,z:g.z+g.tz*.1},.01,defaults);assert.equal(r.next,(missed+1)%venue.gates.length);
 const cue=nav.update({...g,angle:0},r,.01);assert.equal(cue.wrong,false);
});
test('later gates, backwards crossing and short circuits never award laps',()=>{
 const r=new Race(venue.gates,channel.hullLimit);for(let lap=0;lap<6;lap++)for(const i of [5,10,15,0]){const g=venue.gates[i];r.step({x:g.x-g.tx,z:g.z-g.tz},{x:g.x+g.tx,z:g.z+g.tz},.1,defaults);}assert.equal(r.next,1);assert.equal(r.laps.length,0);
});
test('navigator handles left cues and tutorial cooldown without changing race state',()=>{
 const c={...venue,cues:venue.cues.map(c=>({...c,kind:'left'}))},r=new Race(c.gates,6.5),n=new RouteNavigator(c,6.5),b={...c.sample(0),angle:0,pump:0};const cue=n.update(b,r,.1,{left:true});assert.equal(cue.kind,'left');assert.equal(cue.notice,'Apply throttle to steer');n.update(b,r,2);assert.equal(n.update(b,r,.1,{left:true}).notice,'');assert.equal(r.next,1);n.reset();assert.equal(n.wrong,false);
});
test('merged channel rendering and solver mask share every branch with no rectangular bridges',()=>{
 const water=channelGeometry(venue.network,channel.water),bank=channelBankGeometry(venue.network,channel.bank,channel.water);
 for(const geo of [water,bank]){const p=geo.attributes.position,n=geo.attributes.normal;for(let i=0;i<p.count;i++){const q=nearestOnTrack(venue.network,p.getX(i),p.getZ(i)),d=Math.hypot(q.x-p.getX(i),q.z-p.getZ(i));assert.ok(d<=channel.bank+.05);assert.ok(n.getY(i)>.99);if(geo===bank)assert.ok(d>channel.water-.05);}}
 const domain=makeDomain(96,144,(x,z)=>nearestOnTrack(venue.network,x,z),channel.water);for(const e of venue.edges)for(const p of e.points){const x=Math.floor((p.x+72)/domain.dx),y=Math.floor((p.z+72)/domain.dx);assert.equal(domain.mask[y*96+x],1);}
 water.dispose();bank.dispose();
});

test('turn distance holds at zero until the junction releases, without wrapping a lap',()=>{const r=new Race(venue.gates,channel.hullLimit),n=new RouteNavigator(venue,channel.hullLimit),cue=venue.cues[0];r.next=venue.gates.findIndex(g=>g.distance>cue.distance+1);const position=venue.sample(cue.distance+1),out=n.update({...position,angle:0},r,.01);assert.equal(out.kind,cue.kind);assert.equal(out.distance,0);});

test('recovery approaches from behind a missed directional gate, then guides forward',()=>{const r=new Race(venue.gates,channel.hullLimit),n=new RouteNavigator(venue,channel.hullLimit),g=venue.gates[1];const b={x:g.x+g.tx*12,z:g.z+g.tz*12,angle:Math.atan2(g.tz,g.tx)};let cue=n.update(b,r,.5);assert.equal(cue.wrong,true);assert.ok((cue.targetX-g.x)*g.tx+(cue.targetZ-g.z)*g.tz< -6);b.x=g.x-g.tx*4;b.z=g.z-g.tz*4;b.angle+=Math.PI;cue=n.update(b,r,.01);assert.equal(cue.wrong,true);assert.ok((cue.targetX-g.x)*g.tx+(cue.targetZ-g.z)*g.tz>1);assert.equal(r.next,1);});

test('rounded hairpin racing lines inside navigable water complete all gates without false warnings',()=>{
 for(const span of [6,10,14,18]){
  const r=new Race(venue.gates,channel.hullLimit),n=new RouteNavigator(venue,channel.hullLimit);let before=venue.sample(0);
  for(let d=.2;d<venue.length+.2;d+=.2){
   let b=venue.sample(d);const corner=venue.cues.find(q=>q.node&&q.distance>span&&q.distance<venue.length-span&&Math.abs(d-q.distance)<span);
   if(corner){const a=venue.sample(corner.distance-span),p=venue.sample(corner.distance),e=venue.sample(corner.distance+span),t=(d-corner.distance+span)/(2*span);b={x:(1-t)**2*a.x+2*t*(1-t)*p.x+t*t*e.x,z:(1-t)**2*a.z+2*t*(1-t)*p.z+t*t*e.z};}
   const water=nearestOnTrack(venue.network,b.x,b.z);assert.ok(Math.hypot(b.x-water.x,b.z-water.z)<=channel.hullLimit,`line leaves water at ${d}`);
   b.angle=Math.atan2(b.z-before.z,b.x-before.x);r.step(before,b,.01,defaults);assert.equal(n.update(b,r,.01).wrong,false,`false warning at ${d}`);before=b;
  }
  assert.equal(r.laps.length,1,`rounded line ${span} deadlocked`);
 }
});
test('every full-width gate accepts drift crossings at several angles and rejects reverse or adjacent lanes',()=>{
 for(const [index,g] of venue.gates.entries()){
  for(const offset of [-6.5,0,6.5])assert.equal(g.accept(g.x-g.tz*offset,g.z+g.tx*offset),true,`gate ${index} narrows inside water`);
  for(const offset of [-4.5,0,4.5])for(const slope of [-1,0,1]){
   const r=new Race(venue.gates,6.5);r.next=index;const point=(forward,side)=>({x:g.x+g.tx*forward-g.tz*side,z:g.z+g.tz*forward+g.tx*side});
   const before=point(-1,offset-slope),after=point(1,offset+slope);r.step(before,after,.01,defaults);assert.equal(r.lastCrossing.code,'accepted',`gate ${index}, offset ${offset}, slope ${slope}`);
   r.reset();r.next=index;r.step(after,before,.01,defaults);assert.equal(r.next,index);assert.equal(r.check.code,'wrong-direction');
   const r2=new Race(venue.gates,6.5);r2.next=index;r2.step(point(-1,12),point(1,12),.01,defaults);assert.equal(r2.next,index);assert.equal(r2.check.code,'outside-width');
  }
 }
});
test('shared intersection approaches retain intended instructions before a genuine missed gate',()=>{
 const r=new Race(venue.gates,6.5),n=new RouteNavigator(venue,6.5),junction=venue.junctions.find(j=>j.node==='J');
 r.next=venue.gates.findIndex(g=>g.distance>junction.distance);
 const b=venue.sample(junction.distance-3);b.angle=Math.atan2(b.tz,b.tx);
 for(let i=0;i<90;i++)assert.equal(n.update(b,r,1/60).wrong,false);
 assert.equal(r.next,venue.gates.findIndex(g=>g.distance>junction.distance));
});
