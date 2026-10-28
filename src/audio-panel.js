import {audioControls,enginePresets} from './audio-settings.js';
export function mountSoundLab(store,engine,{onTestChange=()=>{}}={}){
 const node=(tag,text,parent)=>{const el=document.createElement(tag);if(text)el.textContent=text;parent?.append(el);return el;};
 const root=node('details',null,document.body);root.id='soundLab';
 node('summary','V8 SOUND LAB',root);
 const body=node('div',null,root);body.className='sound-lab-body';
 node('p','Tune the exhaust live. Audio saves separately from boat handling.',body);
 const status=node('p',null,body);status.id='audioStatus';status.setAttribute('role','status');
 const message=text=>status.textContent=text;
 const button=(text,id,action,parent=body)=>{const b=node('button',text,parent);b.id=id;b.type='button';b.onclick=async()=>{try{await action();}catch(e){message(e.message);}};return b;};
 const select=node('select',null,body);select.id='enginePreset';select.setAttribute('aria-label','Engine sound preset');
 for(const [id,p] of Object.entries(enginePresets)){const option=node('option',p.name,select);option.value=id;}
 const custom=node('option','Custom',select);custom.value='custom';
 select.onchange=()=>{store.select(select.value);message('Sound preset applied.');};
 let testing=false,throttle=0;
 const test=node('section',null,body);test.className='engine-test';
 const toggle=button('Start stationary engine test','engineTest',()=>{api.setTesting(!testing);},test);toggle.setAttribute('aria-pressed','false');
 const rpm=node('output','900 RPM',test);rpm.id='testRPM';rpm.setAttribute('aria-label','Live engine RPM');
 const label=node('label','Test throttle ',test),value=node('output','0%',label),slider=node('input',null,label);slider.id='testThrottle';slider.type='range';slider.min=0;slider.max=100;slider.value=0;slider.disabled=true;slider.setAttribute('aria-label','Stationary test throttle');
 slider.oninput=()=>{throttle=Number(slider.value)/100;value.textContent=`${slider.value}%`;};
 node('p','Stationary test freezes the boat and race clock. Start audio with a tap; use headphones or speakers with bass.',test);
 const unlock=button('Enable / resume audio','unlockEngine',async()=>{await engine.start();message(engine.ctx?.state==='running'?'Audio enabled.':engine.ctx?'Tap again to resume audio.':'Web Audio is unavailable in this browser.');},test);
 const tip=node('p','Deep idle: 800–950 RPM, high camshaft lope, moderate instability and irregularity, strong bass, longer pulses, and low rasp.',body);tip.className='idle-tip';
 const sliders={};let group;
 for(const [id,s] of Object.entries(audioControls)){
  if(group?.dataset.group!==s.group){group=node('details',null,body);group.dataset.group=s.group;node('summary',s.group,group);group.open=s.group==='Engine behavior';}
  const label=node('label',s.label+' ',group),output=node('output',null,label),input=node('input',null,label);input.type='range';input.id='audio-'+id;input.min=s.min;input.max=s.max;input.step=s.step;input.setAttribute('aria-label',s.label);
  input.oninput=()=>{store.set(id,Number(input.value));if(store.warning)message(store.warning);};sliders[id]={input,output};
 }
 button('Reset sound to Marine V8','resetEngine',()=>{store.reset();message('Marine Jet Sprint V8 restored.');});
 const saved=node('details',null,body);node('summary','Save, load & JSON',saved);
 const name=node('input',null,saved);name.type='text';name.maxLength=40;name.placeholder='Audio preset name';name.id='audioPresetName';name.setAttribute('aria-label','Audio preset name');
 const list=node('select',null,saved);list.id='savedAudioPresets';list.setAttribute('aria-label','Saved audio presets');
 const refreshList=chosen=>{list.replaceChildren();const empty=node('option','Choose a saved audio preset',list);empty.value='';for(const r of store.records){const opt=node('option',r.name,list);opt.value=r.name;}list.value=chosen||'';};refreshList();
 list.onchange=()=>{if(list.value)name.value=list.value;};
 button('Save Preset','saveAudioPreset',()=>{store.save(name.value);refreshList(name.value.trim().slice(0,40));message('Audio preset saved on this device.');},saved);
 button('Load Preset','loadAudioPreset',()=>{store.load(list.value);message('Saved audio preset loaded.');},saved);
 const json=node('textarea',null,saved);json.id='audioJSON';json.rows=5;json.spellcheck=false;json.setAttribute('aria-label','V8 settings JSON');
 button('Export Settings as JSON','exportAudio',()=>{json.value=store.exportText();const url=URL.createObjectURL(new Blob([json.value],{type:'application/json'})),a=node('a',null,document.body);a.href=url;a.download='jet-sprint-v8.json';a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Audio JSON exported and shown below.');},saved);
 button('Import Settings from JSON','importAudio',()=>{store.importText(json.value);message('Audio settings imported.');},saved);
 const file=node('input',null,saved);file.type='file';file.id='importAudioFile';file.accept='.json,application/json';file.setAttribute('aria-label','Import V8 settings JSON file');
 file.onchange=async()=>{try{const f=file.files[0];if(!f)return;if(f.size>100000)throw Error('Audio file exceeds 100 KB.');const text=await f.text();store.importText(text);json.value=text;message('Audio file imported.');}catch(e){message(e.message);}finally{file.value='';}};
 const refresh=()=>{select.value=store.preset;for(const [id,{input,output}] of Object.entries(sliders)){input.value=store.values[id];output.textContent=store.values[id]+audioControls[id].unit;}engine.setSettings(store.values);};
 store.subscribe(()=>{refresh();if(store.warning)message(store.warning);});refresh();message(store.warning||'Marine V8 ready. Tap stationary test or start racing to hear it.');
 root.addEventListener('toggle',()=>{if(root.open){const settings=document.getElementById('debug');if(settings)settings.open=false;}});
 const api={root,get testing(){return testing;},get throttle(){return throttle;},setTesting(on){
  testing=!!on;throttle=0;slider.value=0;value.textContent='0%';slider.disabled=!testing;toggle.textContent=testing?'End stationary engine test':'Start stationary engine test';toggle.setAttribute('aria-pressed',String(testing));document.body.classList.toggle('sound-testing',testing);onTestChange(testing);
  if(testing){engine.start();message('Stationary test · race clock paused.');}else message('Stationary test ended.');
 },update(){const text=`${Math.round(engine.rpm)} RPM`;if(rpm.textContent!==text)rpm.textContent=text;unlock.hidden=engine.ctx?.state==='running';},message};
 return api;
}
