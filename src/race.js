import {handlingDefaults,forceKeys} from './handling.js';
export const defaults=handlingDefaults;
export const modified=s=>forceKeys.some(k=>(s[k]??defaults[k])!==defaults[k]);
export const format=t=>{const ms=Math.round(t*1000);return `${String(Math.floor(ms/60000)).padStart(2,'0')}:${(Math.floor(ms/1000)%60).toString().padStart(2,'0')}.${(ms%1000).toString().padStart(3,'0')}`;};
export class Race {
 constructor(gates,width,lapCount=5){this.gates=gates;this.width=width;this.lapCount=lapCount;this.reset();}
 reset(){this.total=0;this.laps=[];this.lapStart=0;this.next=1;this.done=false;this.modified=false;this.check={code:'approaching',gate:1,signed:0,lateral:0};this.lastCrossing=null;}
 step(before,after,dt,settings,totalTime=null){
  if(this.done)return false;this.modified||=modified(settings);this.total=totalTime===null?this.total+dt:Math.max(this.total,totalTime);
  const index=this.next,g=this.gates[index],width=g.halfWidth??this.width;
  const a=(before.x-g.x)*g.tx+(before.z-g.z)*g.tz,b=(after.x-g.x)*g.tx+(after.z-g.z)*g.tz;
  Object.assign(this.check,{code:b<0?'approaching':'beyond-plane',gate:index,signed:b,lateral:-(after.x-g.x)*g.tz+(after.z-g.z)*g.tx});
  // Include a start exactly on the plane, but never a stationary or reverse pass.
  if(a<=0&&b>0){
   const t=-a/(b-a),x=before.x+(after.x-before.x)*t,z=before.z+(after.z-before.z)*t;
   const lateral=-(x-g.x)*g.tz+(z-g.z)*g.tx;
   const code=Math.abs(lateral)>width?'outside-width':g.accept&&!g.accept(x,z)?'adjacent-channel':'accepted';
   this.lastCrossing={gate:index,code,time:this.total,lateral};this.check.code=code;
   if(code==='accepted'){
    if(index===0){this.laps.push(this.total-this.lapStart);this.lapStart=this.total;this.done=this.laps.length===this.lapCount;this.next=1;return true;}
    this.next=(index+1)%this.gates.length;
   }
  }else if(a>=0&&b<0){this.check.code='wrong-direction';this.lastCrossing={gate:index,code:'wrong-direction',time:this.total,lateral:this.check.lateral};}
  return false;
 }
}
export const scoreKey='jet-sprint-races-v1';
export function readScores(storage){try{const data=JSON.parse(storage.getItem(scoreKey));return data?.schema===1&&Array.isArray(data.records)?data.records.filter(r=>r&&typeof r.id==='string'&&typeof r.name==='string'&&Number.isFinite(r.total)&&r.total>0&&Array.isArray(r.laps)&&r.laps.length===(r.lapCount??5)&&[3,5].includes(r.laps.length)&&r.laps.every(t=>Number.isFinite(t)&&t>0)&&Math.abs(r.total-r.laps.reduce((a,b)=>a+b,0))<.01):[];}catch{return [];}}
export function saveScore(storage,result,name){
 const all=readScores(storage);if(all.some(r=>r.id===result.id))return all;
 const record={...result,name:name.trim().slice(0,16)||'Racer'};
 all.push(record);const other=all.filter(r=>r.course!==record.course||r.version!==record.version||r.modified!==record.modified);
 const group=all.filter(r=>!other.includes(r)).sort((a,b)=>a.total-b.total).slice(0,10);
 const records=[...other,...group];storage.setItem(scoreKey,JSON.stringify({schema:1,records}));return records;
}
export function createDoubleTap(action){let last=-Infinity,armed=false;return {press(now){if(armed&&now-last<=300){armed=false;action();}else{last=now;armed=true;}},reset(){last=-Infinity;armed=false;}};}
