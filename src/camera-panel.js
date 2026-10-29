import {cameraModes,cameraNames,controlFor} from './camera-settings.js';
export function mountCameraPanel(store,parent,onSwitch=()=>{}){
 const section=document.createElement('details');section.className='settings-section camera-settings';section.id='cameraSettings';
 const title=document.createElement('summary');title.textContent='Racing Cameras';section.append(title);parent.prepend(section);
 const label=document.createElement('label');label.textContent='Camera mode ';const select=document.createElement('select');select.id='cameraMode';
 for(const mode of cameraModes){const option=document.createElement('option');option.value=mode;option.textContent=cameraNames[mode];select.append(option);}label.append(select);section.append(label);
 const sliders=document.createElement('div');section.append(sliders);
 const note=document.createElement('p');note.className='camera-note';section.append(note);
 const reset=document.createElement('button');reset.id='resetCameras';reset.type='button';reset.textContent='Reset Cameras to Defaults';section.append(reset);
 const status=document.createElement('p');status.role='status';section.append(status);
 const button=document.createElement('button');button.id='cameraSwitch';button.type='button';button.title='Cycle racing camera';document.body.append(button);
 const toast=document.createElement('div');toast.id='cameraToast';toast.role='status';toast.setAttribute('aria-live','polite');toast.hidden=true;document.body.append(toast);
 let timeout,mode='';
 function announce(){clearTimeout(timeout);toast.textContent=cameraNames[store.mode];toast.hidden=false;timeout=setTimeout(()=>{toast.hidden=true;},1800);onSwitch();}
 function refresh(){
  const changed=mode!==store.mode;mode=store.mode;select.value=mode;
  button.textContent='▣ '+cameraNames[mode];button.setAttribute('aria-label',`Camera: ${cameraNames[mode]}. Switch camera`);
  if(changed){
   sliders.replaceChildren();
   for(const key of Object.keys(store.modes[mode])){const r=controlFor(mode,key),label=document.createElement('label'),out=document.createElement('output'),input=document.createElement('input');label.textContent=r.label+' ';out.id=`camera-${key}-value`;input.type='range';input.id=`camera-${key}`;input.min=r.min;input.max=r.max;input.step=r.step;input.setAttribute('aria-label',`${cameraNames[mode]} ${r.label}`);label.append(out,input);sliders.append(label);input.oninput=()=>store.set(mode,key,Number(input.value));}
  }
  for(const [key,value] of Object.entries(store.modes[mode])){document.getElementById(`camera-${key}`).value=value;document.getElementById(`camera-${key}-value`).textContent=Number(value.toFixed(3))+controlFor(mode,key).unit;}
  note.textContent=mode==='cockpit'?'Eye height uses the real driver seat. Lag smooths heading; the eye stays anchored.':mode==='overhead'?'Orthographic, north up. Distance tilts the near-vertical view.':mode==='classic'?'Original elevated framing. Legacy Camera response also sets this mode’s lag.':'Higher lag means a softer follow. Look-ahead is limited to keep the boat in view.';
  status.textContent=store.warning;
  if(changed)announce();
 }
 button.onclick=()=>store.cycle();select.onchange=()=>store.select(select.value);reset.onclick=()=>{store.reset();onSwitch();};
 store.subscribe(refresh);refresh();
 return {section,button};
}
