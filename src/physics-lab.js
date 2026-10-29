import {NamedPresets} from './settings.js';
import {physicsControls,physicsGroups,presetName} from './handling.js';
export const physicsPresetsKey='jet-sprint-physics-presets-v1';

export function mountPhysicsLab(store,getState,onOpen=()=>{}){
 const toggle=document.createElement('button');toggle.id='physicsLabToggle';toggle.type='button';toggle.textContent='BOAT PHYSICS';toggle.setAttribute('aria-controls','physicsLab');toggle.setAttribute('aria-expanded','false');document.body.append(toggle);
 const root=document.createElement('section');root.id='physicsLab';root.hidden=true;root.setAttribute('aria-label','Boat Physics Lab');document.body.append(root);
 const header=document.createElement('div');header.className='physics-heading';root.append(header);
 const heading=document.createElement('h2');heading.textContent='Boat Physics Lab';header.append(heading);
 const close=document.createElement('button');close.type='button';close.id='physicsLabClose';close.textContent='Close';header.append(close);
 function open(value){root.hidden=!value;toggle.setAttribute('aria-expanded',String(value));if(value)onOpen();}
 toggle.onclick=()=>open(root.hidden);close.onclick=()=>open(false);root.addEventListener('keydown',e=>{if(e.key==='Escape'){open(false);toggle.focus();}});
 const status=document.createElement('p');status.id='physicsLabStatus';status.role='status';root.append(status);
 const message=text=>status.textContent=text;
 const button=(text,id,action,parent=root)=>{const b=document.createElement('button');b.type='button';b.id=id;b.textContent=text;b.onclick=async()=>{try{await action();}catch(e){message(e.message);}};parent.append(b);return b;};
 // Reparent the existing registry's bound inputs, keeping one handler per field.
 const move=(id,parent)=>{const input=document.getElementById(id),label=input.closest('label');parent.append(label);return {input,label};};
 const select=move('physicsPreset',root).input;for(const option of select.options){option.textContent=presetName[option.value];if(option.value==='custom')option.disabled=true;}
 move('physicsTelemetry',root);
 for(const [index,group] of physicsGroups.entries()){
  const details=document.createElement('details');details.className='physics-group';details.dataset.group=group;details.open=index===0;const summary=document.createElement('summary');summary.textContent=group;details.append(summary);root.append(details);
  for(const [id,s] of Object.entries(physicsControls))if(s.group===group){const {input,label}=move(id,details);input.setAttribute('aria-label',s.label);const note=document.createElement('small');note.textContent=s.description;label.append(note);}
  if(group==='Banking & Roll')move('invertBank',details);
  button('Reset this category','physicsReset'+index,()=>{store.resetPhysics(group);message(group+' defaults restored.');},details);
 }
 button('Restore factory physics','physicsResetAll',()=>{store.resetPhysics();message('Balanced physics restored. Other settings and saved presets are kept.');});
 const saved=document.createElement('details'),savedTitle=document.createElement('summary');saved.className='physics-group';savedTitle.textContent='Custom presets & JSON';saved.append(savedTitle);root.append(saved);
 const named=new NamedPresets(store.storage,physicsPresetsKey),name=document.createElement('input'),list=document.createElement('select');name.id='physicsPresetName';name.type='text';name.maxLength=40;name.placeholder='Custom preset name';name.setAttribute('aria-label','Custom physics preset name');list.id='physicsPresetList';list.setAttribute('aria-label','Saved physics presets');saved.append(name,list);
 const refreshList=selected=>{list.replaceChildren();const blank=document.createElement('option');blank.value='';blank.textContent='Choose a saved physics preset';list.append(blank);for(const r of named.records){const option=document.createElement('option');option.value=r.id;option.textContent=r.name;list.append(option);}list.value=selected||'';};refreshList();list.onchange=()=>{if(list.value)name.value=named.get(list.value).name;};
 button('Save custom','physicsSave',()=>{refreshList(named.save(name.value,store.exportPhysicsText()));message('Physics preset saved on this device.');},saved);
 button('Update selected','physicsUpdate',()=>{const record=named.get(list.value);refreshList(named.save(record.name,store.exportPhysicsText(),true));message('Selected physics preset updated.');},saved);
 button('Load','physicsLoad',()=>{const r=named.get(list.value);store.importPhysicsText(r.json);message('Loaded '+r.name+'.');},saved);
 button('Rename','physicsRename',()=>{named.rename(list.value,name.value);refreshList(list.value);message('Physics preset renamed.');},saved);
 button('Delete','physicsDelete',()=>{named.delete(list.value);refreshList();message('Selected physics preset deleted.');},saved);
 const json=document.createElement('textarea');json.id='physicsJSON';json.rows=7;json.spellcheck=false;json.setAttribute('aria-label','Boat physics JSON');saved.append(json);
 button('Export / copy configuration','physicsCopy',async()=>{json.value=store.exportPhysicsText();try{await navigator.clipboard.writeText(json.value);message('Physics JSON copied.');}catch{json.focus();json.select();message('JSON is ready below; select and copy it.');}},saved);
 button('Paste JSON','physicsPaste',async()=>{try{json.value=await navigator.clipboard.readText();message('Pasted. Review, then Import.');}catch{json.focus();message('Paste into the JSON box, then Import.');}},saved);
 button('Import JSON','physicsImport',()=>{const notes=store.importPhysicsText(json.value);message('Physics imported. '+notes.join(' '));},saved);
 const file=document.createElement('input');file.id='physicsFile';file.type='file';file.accept='.json,application/json';file.setAttribute('aria-label','Import physics JSON file');file.onchange=async()=>{try{const f=file.files[0];if(!f)return;if(f.size>200000)throw Error('Physics file exceeds 200 KB.');json.value=await f.text();store.importPhysicsText(json.value);message('Physics file imported.');}catch(e){message(e.message);}finally{file.value='';}};saved.append(file);
 const refresh=()=>{select.value=store.values.physicsPreset;message(presetName[store.values.physicsPreset]+' · changes apply live');};store.subscribe(refresh);refresh();if(named.warning)message(named.warning);
 const legacy=document.getElementById('cameraResponse')?.closest('details');if(legacy)button('Open Boat Physics Lab','physicsLabShortcut',()=>open(true),legacy);
 const telemetry=document.createElement('pre');telemetry.id='physicsTelemetryOverlay';telemetry.hidden=true;telemetry.setAttribute('aria-label','Live boat physics telemetry');document.body.append(telemetry);let clock=1;
 return {root,update(dt){
  const show=store.values.physicsTelemetry&&root.hidden&&!document.getElementById('debug').open;telemetry.hidden=!show;if(!show)return;clock+=dt;if(clock<.1)return;clock=0;
  const {boat:b,motion:m}=getState(),degrees=180/Math.PI,sign=n=>(n>=0?'+':'')+n.toFixed(1);
  telemetry.textContent=`PHYSICS · ${presetName[store.values.physicsPreset]}\nSpeed ${(Math.hypot(b.vx,b.vz)*3.6).toFixed(1)} km/h\nThrottle ${Math.round((b.throttle||0)*100)}% · steer ${b.steering||0}\nYaw ${sign((b.yawRate||0)*degrees)}°/s\nBank ${sign(m.roll*degrees)}° → ${sign(m.targetRoll*degrees)}°\nSlip ${sign(b.lateralSpeed||0)} m/s\nJet ${((b.thrust||0)/1000).toFixed(2)} kN\nPlaning ${Math.round(m.planing*100)}%`;
 }};
}
