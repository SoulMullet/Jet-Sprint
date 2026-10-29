import test from 'node:test';import assert from 'node:assert/strict';
import {createCourse} from '../src/course.js';import {shorelineGeometry,landGeometry,nearestOnTrack} from '../src/track.js';import {channel} from '../src/physics.js';
test('sloped banks and clipped land meet at a shared height without terrain in water',()=>{
 const course=createCourse(),bank=shorelineGeometry(course.network,channel.water,channel.bank),land=landGeometry(course.network,channel.bank);
 assert.ok(bank.attributes.position.count<8000);assert.ok(land.attributes.position.count<25000);
 for(const [geo,isLand] of [[bank,false],[land,true]]){
  const p=geo.attributes.position,n=geo.attributes.normal;
  for(let i=0;i<p.count;i++){const near=nearestOnTrack(course.network,p.getX(i),p.getZ(i)),d=Math.hypot(p.getX(i)-near.x,p.getZ(i)-near.z);assert.ok(Number.isFinite(p.getY(i))&&Number.isFinite(n.getY(i)));assert.ok(d>=channel.water-.055);if(isLand){assert.ok(d>=channel.bank-.055);assert.ok(p.getY(i)>=.3499);}else{assert.ok(p.getY(i)>=-.061&&p.getY(i)<=.351);if(Math.abs(d-channel.bank)<.001)assert.ok(Math.abs(p.getY(i)-.35)<.001);}}
  geo.dispose();
 }
});

test('raised terrain has conforming interior edges with no T-junction cracks',()=>{
 const c=createCourse(),g=landGeometry(c.network,channel.bank),p=g.attributes.position,idx=g.index.array,edges=new Map();
 for(let i=0;i<idx.length;i+=3)for(let j=0;j<3;j++){const a=idx[i+j],b=idx[i+(j+1)%3],key=a<b?`${a}/${b}`:`${b}/${a}`;edges.set(key,(edges.get(key)||0)+1);}
 for(const [key,count] of edges){assert.ok(count<=2);if(count!==1)continue;const [a,b]=key.split('/').map(Number),outer=Math.abs(p.getX(a))===125&&p.getX(a)===p.getX(b)||Math.abs(p.getZ(a))===110&&p.getZ(a)===p.getZ(b);
  if(outer)continue;for(const i of [a,b]){const n=nearestOnTrack(c.network,p.getX(i),p.getZ(i)),d=Math.hypot(n.x-p.getX(i),n.z-p.getZ(i));assert.ok(Math.abs(d-channel.bank)<.055,`unmatched interior edge at ${p.getX(i)}, ${p.getZ(i)}`);}
 }
});
