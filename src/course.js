import * as THREE from 'three';
import {course} from './physics.js';
import {nearestOnTrack} from './track.js';

export const courseId='emerald-network';
export const routeId='crosswater-1';
export const gameplayVersion='0.7';
// Geometry is a graph, independent of the prescribed lap. Directed edges may be
// reused in other route definitions without changing the banks or solver mask.
export const prescribedRoute=['S-A','A-J','J-B','B-C','C-J','J-D','D-B','B-C','C-S'];
const outerCurve=new THREE.CatmullRomCurve3(course.map(([x,z])=>new THREE.Vector3(x,0,z)),true,'centripetal');
const at=t=>outerCurve.getPointAt(t);
const v=(x,z)=>new THREE.Vector3(x,0,z);
const fractions={S:0,A:.2,D:.4,B:.65,C:.8};
export function createCourse(route=prescribedRoute){
 const nodes=Object.fromEntries(Object.entries(fractions).map(([id,t])=>[id,at(t)]));nodes.J=v(0,0);
 const edges=[];
 for(const [from,to,t0,t1] of [['S','A',0,.2],['A','D',.2,.4],['D','B',.4,.65],['B','C',.65,.8],['C','S',.8,1]]){
  const n=Math.ceil((t1-t0)*240),points=Array.from({length:n+1},(_,i)=>at(t0+(t1-t0)*i/n));
  edges.push({id:`${from}-${to}`,from,to,points});
 }
 for(const [from,to,via] of [['A','J',[[28,-16],[14,-9]]],['J','B',[[-18,11],[-34,17]]],['C','J',[[-25,-18],[-12,-11]]],['J','D',[[11,10],[23,23]]]]){
  const c=new THREE.CatmullRomCurve3([nodes[from],...via.map(([x,z])=>v(x,z)),nodes[to]],false,'centripetal');
  const n=Math.ceil(c.getLength()/1.4);edges.push({id:`${from}-${to}`,from,to,points:Array.from({length:n+1},(_,i)=>c.getPointAt(i/n))});
 }
 const lookup=new Map(edges.map(e=>[e.id,e]));
 const legs=route.map(id=>{const e=lookup.get(id);if(!e)throw Error(`Unknown route edge: ${id}`);return e;});
 for(let i=0;i<legs.length;i++)if(legs[i].to!==legs[(i+1)%legs.length].from)throw Error('Race route must be a connected closed walk.');
 if(legs[0].from!=='S')throw Error('Race route must begin at start node S.');
 const line=[],junctions=[];let length=0;
 for(const edge of legs){
  const startDistance=length;
  for(let i=0;i<edge.points.length-1;i++){
   const p=edge.points[i],q=edge.points[i+1];line.push({x:p.x,z:p.z,distance:length,edgeId:edge.id});length+=p.distanceTo(q);
  }
  junctions.push({node:edge.to,distance:length,edgeId:edge.id,startDistance});
 }
 const sample=distance=>{
  distance=((distance%length)+length)%length;
  let lo=0,hi=line.length-1;while(lo<hi){const m=Math.ceil((lo+hi)/2);if(line[m].distance<=distance)lo=m;else hi=m-1;}
  const p=line[lo],q=line[(lo+1)%line.length],span=(lo+1===line.length?length:q.distance)-p.distance,t=(distance-p.distance)/span,dx=q.x-p.x,dz=q.z-p.z,l=Math.hypot(dx,dz);
  return {x:p.x+dx*t,z:p.z+dz*t,tx:dx/l,tz:dz/l,distance,edgeId:p.edgeId};
 };
 const points=Array.from({length:600},(_,i)=>sample(length*i/600));
 // Preserve a route index for the existing camera's unchanged lookahead formula.
 for(const e of edges){e.points.id=e.id;for(const p of e.points)p.routeIndex=nearestOnTrack(points,p.x,p.z).index;}
 const network={paths:edges.map(e=>e.points)};
 // Dense finite-width directional gates leave no unvalidated shortcut between
 // intersections. Race alone owns progression; navigation never awards gates.
 const count=Math.ceil(length/5),gates=Array.from({length:count},(_,i)=>sample(length*i/count));
 const cues=junctions.map((j,i)=>{
  const incoming=sample(j.distance-2),outgoing=sample(j.distance+2);
  const angle=Math.atan2(incoming.tx*outgoing.tz-incoming.tz*outgoing.tx,incoming.tx*outgoing.tx+incoming.tz*outgoing.tz);
  const sharp=Math.abs(angle)>1.45,straight=Math.abs(angle)<.38;
  return {id:i,node:j.node,distance:j.distance,releaseAt:j.distance+5,angle,kind:straight?'straight':`${sharp?'sharp-':''}${angle>0?'right':'left'}`};
 });
 // Include tight bends between junctions, particularly the left/right chicane
 // on the west channel. Junction cues always take priority over nearby bends.
 const bends=[];
 for(let d=10;d<length-10;d+=2){const p=sample(d-6),q=sample(d+6),angle=Math.atan2(p.tx*q.tz-p.tz*q.tx,p.tx*q.tx+p.tz*q.tz);
  if(Math.abs(angle)>.65&&!cues.some(c=>Math.abs(d-c.distance)<16))bends.push({distance:d,angle});}
 bends.sort((a,b)=>Math.abs(b.angle)-Math.abs(a.angle));
 for(const bend of bends){if(cues.some(c=>Math.abs(c.distance-bend.distance)<16))continue;
  const previous=cues.filter(c=>c.distance<bend.distance).sort((a,b)=>b.distance-a.distance)[0];
  const direction=bend.angle>0?'right':'left';if(previous?.kind.includes(direction))continue;
  cues.push({id:`bend-${bend.distance}`,node:null,distance:bend.distance,releaseAt:bend.distance+2,angle:bend.angle,kind:`${Math.abs(bend.angle)>1.45?'sharp-':''}${direction}`});}
 cues.sort((a,b)=>a.distance-b.distance);
 return {id:courseId,routeId,network,nodes,edges,legs,points,gates,cues,length,sample};
}
