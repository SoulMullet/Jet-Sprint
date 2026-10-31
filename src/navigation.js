import {nearestOnTrack} from './track.js';
const label={left:'LEFT',right:'RIGHT',straight:'STRAIGHT','sharp-left':'SHARP LEFT','sharp-right':'SHARP RIGHT'};
const lastRejected=(race,next)=>race.lastCrossing?.gate===next&&['outside-width','adjacent-channel'].includes(race.lastCrossing.code);
export class RouteNavigator {
 constructor(course,width){this.course=course;this.width=width;this.reset();}
 reset(){this.wrong=false;this.rejoining=false;this.offTime=0;this.onTime=0;this.lastNext=1;this.hintUntil=0;this.nextHint=0;this.clock=0;this.recoveryKind='straight';this.candidate='straight';this.candidateTime=0;this.projection={};this.reason='approaching';this.edgeGate=-1;}
 update(b,race,dt,input={}){
  this.clock+=dt;
  const {gates,cues,length}=this.course,next=race.next,g=gates[next],prev=gates[(next+gates.length-1)%gates.length];
  const end=next===0?length:g.distance,width=g.halfWidth??this.width;
  const advanced=next!==this.lastNext;this.lastNext=next;
  const projection=this.course.project(b,prev.distance-8,end+25,this.projection);
  const ahead=(b.x-g.x)*g.tx+(b.z-g.z)*g.tz;
  // Confirm the wrong branch outside shared junction water; proximity alone
  // cannot establish a missed checkpoint while a player rounds a turn.
  const branch=nearestOnTrack(this.course.network,b.x,b.z).segmentId;
  if(this.edgeGate!==next){this.edgeGate=next;this.expectedEdges=new Set(this.course.line.filter(p=>p.distance>=prev.distance-2&&p.distance<=end+1).map(p=>p.edgeId));this.expectedEdges.add(g.edgeId);this.expectedEdges.add(prev.edgeId);this.relevantJunctions=this.course.junctions.filter(j=>j.distance>=prev.distance-12&&j.distance<=end+12).map(j=>this.course.nodes[j.node]);if(prev.distance<12)this.relevantJunctions.push(this.course.nodes.S);}
  const expected=this.expectedEdges;
  const awayFromJunction=this.relevantJunctions.every(p=>Math.hypot(b.x-p.x,b.z-p.z)>13);
  const missedAhead=projection.distance>end+5&&projection.error<width+1;
  const wrongBranch=!expected.has(branch)&&projection.error>width+3&&awayFromJunction;
  const rejected=lastRejected(race,next)&&ahead>0&&projection.distance>end-10;
  const off=missedAhead||wrongBranch||rejected;
  this.offTime=off?this.offTime+dt:0;
  if(this.offTime>.45){this.wrong=true;this.reason=rejected?'rejected-active-gate':missedAhead?'passed-active-gate':'committed-wrong-branch';}
  const facing=Math.cos(b.angle)*g.tx+Math.sin(b.angle)*g.tz;
  this.onTime=!off&&projection.distance<end-2&&projection.error<width&&facing>.25?this.onTime+dt:0;
  if(advanced||this.onTime>.25){this.wrong=false;this.rejoining=false;this.reason='approaching';}
  const progress=Math.max(prev.distance,Math.min(end,projection.distance));
  const cue=cues.find(c=>c.releaseAt>progress)||cues[0];
  let turnDistance=Math.max(0,cue.distance-progress);
  let kind=cue.kind,targetX=g.x,targetZ=g.z;
  if(this.wrong){
   // Return behind the directional gate before guiding through it. Pointing
   // straight at a missed gate from ahead would demand a backwards crossing.
   if(projection.distance<end-3&&projection.error<width)this.rejoining=true;
   if(ahead>3)this.rejoining=false;
   const target=this.course.sample(end+(this.rejoining?3:-10));targetX=target.x;targetZ=target.z;
   const angle=Math.atan2(Math.sin(Math.atan2(targetZ-b.z,targetX-b.x)-b.angle),Math.cos(Math.atan2(targetZ-b.z,targetX-b.x)-b.angle));
   const desired=Math.abs(angle)<.4?'straight':`${Math.abs(angle)>1.75?'sharp-':''}${angle>0?'right':'left'}`;
   if(desired!==this.candidate){this.candidate=desired;this.candidateTime=0;}else this.candidateTime+=dt;
   if(this.candidateTime>.16)this.recoveryKind=desired;
   kind=this.recoveryKind;turnDistance=Math.hypot(targetX-b.x,targetZ-b.z);
  }
  if((input.left||input.right)&&!input.throttle&&(b.pump||0)<.12&&this.clock>this.nextHint){this.hintUntil=this.clock+1.8;this.nextHint=this.clock+8;}
  const nextCue=cues[(cues.indexOf(cue)+1)%cues.length],gap=(nextCue.distance-cue.distance+length)%length;
  const preview=!this.wrong&&gap<45&&turnDistance<50?`THEN ${label[nextCue.kind]}`:'';
  return {kind,preview,targetX,targetZ,reason:this.wrong?this.reason:awayFromJunction?'approaching':'junction-approach',progress,text:this.wrong?'RETURN TO GATE':label[kind],distance:Math.round(turnDistance),wrong:this.wrong,urgent:this.wrong||turnDistance<45,checkpoint:next,notice:this.wrong?'WRONG ROUTE · Return to the required gate':this.clock<this.hintUntil?'Apply throttle to steer':''};
 }
}
