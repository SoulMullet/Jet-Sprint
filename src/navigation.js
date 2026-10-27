function distanceToSegment(b,a,c){const dx=c.x-a.x,dz=c.z-a.z,t=Math.max(0,Math.min(1,((b.x-a.x)*dx+(b.z-a.z)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(b.x-a.x-dx*t,b.z-a.z-dz*t);}
const label={left:'LEFT',right:'RIGHT',straight:'STRAIGHT','sharp-left':'SHARP LEFT','sharp-right':'SHARP RIGHT'};
export class RouteNavigator {
 constructor(course,width){this.course=course;this.width=width;this.reset();}
 reset(){this.wrong=false;this.rejoining=false;this.offTime=0;this.onTime=0;this.lastNext=1;this.hintUntil=0;this.nextHint=0;this.clock=0;this.recoveryKind='straight';this.candidate='straight';this.candidateTime=0;}
 update(b,race,dt,input={}){
  this.clock+=dt;
  const {gates,cues,length}=this.course,next=race.next,g=gates[next],prev=gates[(next+gates.length-1)%gates.length],following=gates[(next+1)%gates.length];
  const advanced=next!==this.lastNext;this.lastNext=next;
  const distance=Math.min(distanceToSegment(b,prev,g),distanceToSegment(b,g,following));
  const ahead=(b.x-g.x)*g.tx+(b.z-g.z)*g.tz;
  const off=distance>this.width+1.2||ahead>6;
  this.offTime=off?this.offTime+dt:0;
  if(this.offTime>.35)this.wrong=true;
  const facing=Math.cos(b.angle)*g.tx+Math.sin(b.angle)*g.tz;
  this.onTime=!off&&ahead<.2&&facing>.25?this.onTime+dt:0;
  if(advanced||this.onTime>.25){this.wrong=false;this.rejoining=false;}
  const progress=prev.distance;
  const cue=cues.find(c=>c.releaseAt>progress)||cues[0];
  let turnDistance=Math.max(0,cue.distance-progress);
  // Project only inside the expected corridor: a wrong branch cannot jump the
  // instruction or checkpoint to a nearby later section of the route.
  const along=Math.max(0,Math.min(Math.hypot(g.x-prev.x,g.z-prev.z),(b.x-prev.x)*prev.tx+(b.z-prev.z)*prev.tz));
  turnDistance=Math.max(0,turnDistance-along);
  let kind=cue.kind,targetX=g.x,targetZ=g.z;
  if(this.wrong){
   // Return behind the directional gate before guiding through it. Pointing
   // straight at a missed gate from ahead would demand a backwards crossing.
   if(ahead< -3&&distance<this.width)this.rejoining=true;
   if(ahead>3)this.rejoining=false;
   const offset=this.rejoining?2:-7;targetX=g.x+g.tx*offset;targetZ=g.z+g.tz*offset;
   const angle=Math.atan2(Math.sin(Math.atan2(targetZ-b.z,targetX-b.x)-b.angle),Math.cos(Math.atan2(targetZ-b.z,targetX-b.x)-b.angle));
   const desired=Math.abs(angle)<.4?'straight':`${Math.abs(angle)>1.75?'sharp-':''}${angle>0?'right':'left'}`;
   if(desired!==this.candidate){this.candidate=desired;this.candidateTime=0;}else this.candidateTime+=dt;
   if(this.candidateTime>.16)this.recoveryKind=desired;
   kind=this.recoveryKind;turnDistance=Math.hypot(targetX-b.x,targetZ-b.z);
  }
  if((input.left||input.right)&&!input.throttle&&(b.pump||0)<.12&&this.clock>this.nextHint){this.hintUntil=this.clock+1.8;this.nextHint=this.clock+8;}
  const nextCue=cues[(cues.indexOf(cue)+1)%cues.length],gap=(nextCue.distance-cue.distance+length)%length;
  const preview=!this.wrong&&gap<45&&turnDistance<50?`THEN ${label[nextCue.kind]}`:'';
  return {kind,preview,targetX,targetZ,text:this.wrong?'RETURN TO GATE':label[kind],distance:Math.round(turnDistance),wrong:this.wrong,urgent:this.wrong||turnDistance<45,checkpoint:next,notice:this.wrong?'WRONG ROUTE · Return to the required gate':this.clock<this.hintUntil?'Apply throttle to steer':''};
 }
}
export function mountNavigator(root){
 const arrow=root.querySelector('path'),text=root.querySelector('strong'),distance=root.querySelector('span'),preview=root.querySelector('small');
 const paths={straight:'M40 56 V10 M24 26 L40 10 L56 26',right:'M18 56 V35 Q18 20 34 20 H65 M50 5 L65 20 L50 35','sharp-right':'M15 57 V26 Q15 9 33 9 H43 Q62 9 62 28 V48 M49 35 L62 48 L75 35'};
 let previous='';
 return {update(cue,visible){root.hidden=!visible;if(!visible)return;const key=cue.kind+cue.wrong;
  if(previous!==key){arrow.setAttribute('d',paths[cue.kind.replace('left','right')]);arrow.setAttribute('transform',cue.kind.includes('left')?'translate(80 0) scale(-1 1)':'');text.textContent=cue.text;root.classList.toggle('wrong',cue.wrong);if(previous)root.animate?.([{opacity:.35,transform:'translateX(-50%) translateY(3px)'},{opacity:1,transform:'translateX(-50%) translateY(0)'}],{duration:180});previous=key;}
  if(preview.textContent!==cue.preview)preview.textContent=cue.preview;preview.hidden=!cue.preview;
  const value=`${cue.distance} m`;if(distance.textContent!==value)distance.textContent=value;root.classList.toggle('urgent',cue.urgent);
 }};
}
