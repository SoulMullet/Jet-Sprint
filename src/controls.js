// A separate set per control permits multiple fingers and keyboard input together.
export function bindControls(elements,onPress=()=>{}) {
 const input={left:false,right:false,throttle:false};
 const held=Object.fromEntries(Object.keys(input).map(name=>[name,new Set()]));
 function setInput(name,key,on){
  on?held[name].add(key):held[name].delete(key);
  input[name]=held[name].size>0;
  elements[name].classList.toggle('active',input[name]);
 }
 function release(){for(const name of Object.keys(input)){held[name].clear();input[name]=false;elements[name].classList.remove('active');}}
 for(const [name,el] of Object.entries(elements)){
  el.addEventListener('pointerdown',e=>{
   if(e.pointerType==='mouse'&&e.button!==0)return;
   e.preventDefault();
   const wasHeld=input[name];
   setInput(name,e.pointerId,true);
   el.setPointerCapture(e.pointerId);
   if(!wasHeld)onPress(name);
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(event,e=>{
   e.preventDefault();setInput(name,e.pointerId,false);
  });
 }
 return {input,setInput,release};
}
