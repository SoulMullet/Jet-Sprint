import * as THREE from 'three';
import {nearestOnTrack} from './track.js';
import {projectRoute} from './route-math.js';
import {trackConfig} from './track-layout.js';

export const courseId=trackConfig.id;
export const routeId='serpentine-rotation-v2';
export const gameplayVersion='0.9-course-v2';
export const prescribedRoute=trackConfig.route;
export function createCourse(route=prescribedRoute){
 const nodes=Object.fromEntries(Object.entries(trackConfig.nodes).map(([id,[x,z]])=>[id,new THREE.Vector3(x,0,z)]));
 const edges=trackConfig.edges.map(({id,from,to,via})=>{
  const c=new THREE.CatmullRomCurve3([nodes[from],...via.map(([x,z])=>new THREE.Vector3(x,0,z)),nodes[to]],false,'centripetal');
  const n=Math.ceil(c.getLength()/trackConfig.sampleSpacing);
  return {id,from,to,points:Array.from({length:n+1},(_,i)=>c.getPointAt(i/n))};
 });
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
 // Validate channel commitments, not five-metre waypoints at hairpin apices.
 // Entry/exit gates sit outside each shared junction; intermediate cross-sections
 // retain route integrity on long edges. Favour low-curvature sections so an
 // ordinary rounded racing line does not pass around the end of a gate plane.
 const gateDistances=[0];
 for(const j of junctions){
  const first=j.startDistance+12,last=j.distance-12,own={paths:[lookup.get(j.edgeId).points]},candidates=[];
  for(let d=first;d<=last;d+=.5){
   const g=sample(d),clear=[-7.1,-4,0,4,7.1].every(offset=>{
    const x=g.x-g.tz*offset,z=g.z+g.tx*offset,p=nearestOnTrack(own,x,z),n=nearestOnTrack(network,x,z),a=Math.hypot(x-p.x,z-p.z),b=Math.hypot(x-n.x,z-n.z);
    return n.segmentId===g.edgeId||a<=b+.6;
   });
   if(clear){const a=sample(d-4),b=sample(d+4),curvature=Math.acos(Math.max(-1,Math.min(1,a.tx*b.tx+a.tz*b.tz)));candidates.push({distance:d,curvature});}
  }
  if(!candidates.length)throw Error(`No unambiguous gate cross-section for ${j.edgeId}`);
  const intervals=Math.max(1,Math.ceil((last-first)/25)),selected=[];
  for(let i=0;i<=intervals;i++){
   const desired=first+(last-first)*i/intervals;
   const candidate=candidates.reduce((a,b)=>b.curvature*8+Math.abs(b.distance-desired)*.2<a.curvature*8+Math.abs(a.distance-desired)*.2?b:a);
   if(selected.every(d=>Math.abs(candidate.distance-d)>9))selected.push(candidate.distance);
  }
  gateDistances.push(...selected.sort((a,b)=>a-b));
 }
 const gates=gateDistances.map(distance=>{
  const g={...sample(distance),halfWidth:7.1};
  const edge=lookup.get(g.edgeId),own={paths:[edge.points]};
  g.accept=(x,z)=>{const p=nearestOnTrack(own,x,z),n=nearestOnTrack(network,x,z),d=Math.hypot(x-p.x,z-p.z),other=Math.hypot(x-n.x,z-n.z);return d<=7.3&&(n.segmentId===g.edgeId||d<=other+.6);};
  return g;
 });
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
 return {id:courseId,version:trackConfig.version,seed:trackConfig.seed,routeId,network,nodes,edges,legs,points,gates,cues,length,sample,line,junctions,project:(point,min,max,out)=>projectRoute(line,length,point,min,max,out)};
}
