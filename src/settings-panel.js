import {registry,NamedPresets} from './settings.js';
export function mountSettings(store,apply){
 const root=document.getElementById('debug'),status=document.createElement('p');status.id='settingsStatus';status.setAttribute('role','status');
 const message=text=>status.textContent=text;
 const section=name=>{const d=document.createElement('details'),s=document.createElement('summary');s.textContent=name;d.append(s);d.className='settings-section';root.append(d);return d;};
 const groups=Object.fromEntries(['Boat Handling','Water Physics','Spray Effects','Graphics','Audio','Race Start','Saved Presets'].map(name=>[name,section(name)]));
 groups['Boat Handling'].open=true;
 for(const [id,s] of Object.entries(registry)){
  let el=document.getElementById(id),label=el?.closest('label');
  if(!el){label=document.createElement('label');label.append(document.createTextNode(s.label));el=document.createElement(s.type==='enum'?'select':'input');el.id=id;if(s.type==='enum')for(const name of s.options){const option=document.createElement('option');option.value=name;option.textContent=name;el.append(option);}else if(s.type==='boolean')el.type='checkbox';else{el.type='range';el.min=s.min;el.max=s.max;el.step=s.step;const out=document.createElement('output');out.id=id+'Out';label.append(out);}label.append(el);}
  groups[s.category].append(label);
  const change=()=>{try{store.set(id,s.type==='boolean'?el.checked:s.type==='number'?Number(el.value):el.value);message('Settings updated.');}catch(error){message(error.message);}};
  el.addEventListener(s.type==='number'?'input':'change',change);
 }
 for(const id of ['waterStatus','testWave','resetWater'])groups['Water Physics'].append(document.getElementById(id));
 root.append(status);
 const refresh=()=>{for(const [id,s] of Object.entries(registry)){const el=document.getElementById(id);if(s.type==='boolean')el.checked=store.values[id];else el.value=store.values[id];const out=document.getElementById(id+'Out');if(out)out.textContent=store.values[id]+(s.unit||'');}};
 store.subscribe((ids,notes)=>{apply(ids);refresh();if(notes.length)message(notes.join(' '));});
 apply(Object.keys(registry));refresh();if(store.warnings.length)message(store.warnings.join(' '));
 const named=new NamedPresets(store.storage),panel=groups['Saved Presets'];
 const name=document.createElement('input');name.type='text';name.maxLength=40;name.placeholder='Preset name';name.setAttribute('aria-label','Preset name');name.id='presetName';
 const list=document.createElement('select');list.id='presetList';list.setAttribute('aria-label','Saved presets');panel.append(name,list);
 const refreshList=selected=>{list.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent='Choose a preset';list.append(empty);for(const r of named.records){const o=document.createElement('option');o.value=r.id;o.textContent=r.name;list.append(o);}list.value=selected||'';};refreshList();list.onchange=()=>{if(list.value)name.value=named.get(list.value).name;};
 const button=(title,id,action,parent=panel)=>{const b=document.createElement('button');b.type='button';b.textContent=title;b.id=id;b.onclick=async()=>{try{await action();}catch(error){message(error.message);}};parent.append(b);return b;};
 button('Save Current Preset','savePreset',()=>{const existing=named.records.find(r=>r.name.toLowerCase()===name.value.trim().toLowerCase());if(existing&&!confirm(`Overwrite preset “${existing.name}”?`))return;const id=named.save(name.value,store.exportText(),!!existing);refreshList(id);message('Preset saved on this device.');});
 button('Load Preset','loadPreset',()=>{const r=named.get(list.value);const notes=store.importText(r.json);message(`Loaded ${r.name}. ${notes.join(' ')}`);});
 button('Rename','renamePreset',()=>{named.rename(list.value,name.value);refreshList(list.value);message('Preset renamed.');});
 button('Delete','deletePreset',()=>{const r=named.get(list.value);if(!confirm(`Delete preset “${r.name}”?`))return;named.delete(r.id);refreshList();message('Preset deleted.');});
 button('Reset to Defaults','resetDefaults',()=>{if(!confirm('Reset active settings? Saved presets and race results are kept.'))return;store.reset();message('Defaults restored.');});
 const portable=document.createElement('details'),title=document.createElement('summary');title.textContent='Portable JSON preset';portable.append(title);panel.append(portable);
 const text=document.createElement('textarea');text.id='presetJSON';text.rows=7;text.setAttribute('aria-label','Preset JSON for export or import');text.spellcheck=false;portable.append(text);
 const exportText=()=>{text.value=store.exportText();portable.open=true;return text.value;};
 const download=()=>{const blob=new Blob([exportText()],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='jet-sprint-settings.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);};
 button('Export / Copy Settings','exportSettings',async()=>{const json=exportText();try{await navigator.clipboard.writeText(json);message('Settings copied.');}catch{message('JSON is ready below. Select and copy it, or use Download / Share.');}},portable);
 button('Download JSON','downloadSettings',()=>{download();message('Preset download prepared.');},portable);
 button('Share JSON','shareSettings',async()=>{const file=new File([exportText()],'jet-sprint-settings.json',{type:'application/json'});if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'JET SPRINT settings'});message('Share opened.');}else{download();message('Sharing unavailable; preset download prepared.');}},portable);
 button('Paste Settings','pasteSettings',async()=>{try{text.value=await navigator.clipboard.readText();message('Pasted. Review JSON, then choose Import.');}catch{portable.open=true;text.focus();message('Paste into the JSON box using your browser, then choose Import.');}},portable);
 button('Import JSON','importSettings',()=>{const notes=store.importText(text.value);message(`Preset imported. ${notes.join(' ')}`);},portable);
 const file=document.createElement('input');file.type='file';file.accept='.json,application/json';file.id='importSettingsFile';file.setAttribute('aria-label','Open a JSON preset file');file.onchange=async()=>{try{const f=file.files[0];if(!f)return;if(f.size>200000)throw Error('Preset file exceeds 200 KB.');text.value=await f.text();const notes=store.importText(text.value);message(`File imported. ${notes.join(' ')}`);}catch(e){message(e.message);}finally{file.value='';}};portable.append(file);
 if(named.warning)message(`Saved preset warning: ${named.warning}`);
 return {message};
}
