// One monotonic logical clock; green timestamp is fixed when a start is armed.
export class RaceStart {
 constructor(){this.reset();}
 reset(){this.state='READY';this.active=false;this.startAt=null;this.last=-Infinity;}
 begin(now,duration=5){this.reset();this.active=true;this.readyAt=now;this.countdownAt=now+.65;this.duration=duration;this.lowerAt=this.countdownAt+duration*.6;this.startAt=this.countdownAt+duration;this.last=now;}
 update(now){if(!this.active||this.state==='FINISHED')return [];const events=[];for(const [time,kind] of [[this.countdownAt,'upper'],[this.lowerAt,'lower'],[this.startAt,'go']])if(this.last<time&&now>=time)events.push({kind,time});this.last=Math.max(this.last,now);this.state=now>=this.startAt?'RACING':now>=this.countdownAt?'COUNTDOWN':'READY';return events;}
 finish(){this.state='FINISHED';this.active=false;}
 lamps(now){return {upper:this.active&&this.state==='COUNTDOWN',lower:this.active&&this.state==='COUNTDOWN'&&now>=this.lowerAt,green:this.startAt!==null&&now>=this.startAt&&now<this.startAt+3};}
}
