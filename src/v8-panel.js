import {audioRegistry,factoryPresets} from './v8-settings.js';
export function mountSoundLab(store,engine,onTest){
 const root=document.createElement('details');root.id='soundLab';
 const heading=document.createElement('summary');heading.textContent='V8 SOUND LAB';root.append(heading);
 const content=document.createElement('div');content.className='sound-lab-content';root.append(content);
 const intro=document.createElement('p');intro.textContent='Tune live. Audio saves automatically on this device. Master mute and volume remain in Game Settings.';content.append(intro);
 const preset=document.createElement('select');preset.id='v8FactoryPreset';preset.setAttribute('aria-label','Engine sound preset');
 for(const name of [...Object.keys(factoryPresets),'Custom']){const option=document.createElement('option');option.textContent=option.value=name;preset.append(option);}content.append(preset);
 const status=document.createElement('p');status.id='v8Status';status.setAttribute('role','status');
 const message=text=>{status.textContent=text;};
 const button=(text,id,fn,parent=content)=>{const b=document.createElement('button');b.type='button';b.id=id;b.textContent=text;b.onclick=async()=>{try{await fn();}catch(e){message(e.message);}};parent.append(b);return b;};
 const testSection=document.createElement('fieldset');testSection.className='v8-test';const legend=document.createElement('legend');legend.textContent='Stationary engine test';testSection.append(legend);content.append(testSection);
 let testing=false,testThrottle=0;
 const testButton=button('Start engine test','v8Test',async()=>{
  testing=!testing;testThrottle=0;throttle.value='0';throttleOut.textContent='0%';throttle.disabled=!testing;
  testButton.textContent=testing?'Stop test / resume race':'Start engine test';testButton.setAttribute('aria-pressed',String(testing));
  onTest(testing);if(testing){await engine.start();message(engine.status);}else message('Stationary test stopped.');
 },testSection);testButton.setAttribute('aria-pressed','false');
 const throttleLabel=document.createElement('label');throttleLabel.textContent='Test throttle ';const throttleOut=document.createElement('output');throttleOut.textContent='0%';const throttle=document.createElement('input');throttle.id='v8TestThrottle';throttle.type='range';throttle.min=0;throttle.max=100;throttle.value=0;throttle.disabled=true;throttleLabel.htmlFor=throttle.id;throttleLabel.append(throttleOut,throttle);testSection.append(throttleLabel);
 throttle.oninput=()=>{if(testing)engine.start();testThrottle=Number(throttle.value)/100;throttleOut.textContent=throttle.value+'%';};
 const rpm=document.createElement('p');rpm.id='v8RPM';rpm.textContent='Engine ready · '+store.values.idleRPM+' RPM idle';testSection.append(rpm);
 const hint=document.createElement('p');hint.textContent='The boat, race clock and countdown hold during testing. Close this panel to keep driving after stopping the test.';testSection.append(hint);
 const elements=new Map(),groups=new Map();
 for(const [id,s] of Object.entries(audioRegistry)){
  if(!groups.has(s.group)){const details=document.createElement('details'),summary=document.createElement('summary');details.className='settings-section';summary.textContent=s.group;details.append(summary);details.open=s.group==='Engine behavior';groups.set(s.group,details);content.append(details);}
  const label=document.createElement('label'),input=document.createElement('input'),out=document.createElement('output');label.textContent=s.label+' ';input.id='v8-'+id;label.htmlFor=input.id;input.type='range';input.min=s.min;input.max=s.max;input.step=s.step;input.title=s.label;out.setAttribute('for',input.id);label.append(out,input);groups.get(s.group).append(label);elements.set(id,{input,out});
  input.oninput=()=>{store.change(id,Number(input.value));message('Custom audio settings · saved automatically');};
 }
 const refresh=()=>{preset.value=store.preset;for(const [id,{input,out}] of elements){input.value=store.values[id];out.textContent=store.values[id]+audioRegistry[id].unit;}engine.configure(store.values);if(!testing)rpm.textContent='Engine ready · '+store.values.idleRPM+' RPM idle';if(store.warning)message(store.warning);};
 store.subscribe(refresh);refresh();preset.onchange=()=>{store.select(preset.value);message('Loaded '+store.preset);};
 button('Reset sound','v8Reset',()=>{store.select('Marine Jet Sprint V8');message('Marine Jet Sprint V8 defaults restored.');});
 const saved=document.createElement('details');saved.className='settings-section';const savedTitle=document.createElement('summary');savedTitle.textContent='Saved audio presets & JSON';saved.append(savedTitle);content.append(saved);
 const name=document.createElement('input');name.type='text';name.id='v8PresetName';name.maxLength=40;name.placeholder='Audio preset name';name.setAttribute('aria-label','Audio preset name');saved.append(name);
 const list=document.createElement('select');list.id='v8SavedPresets';list.setAttribute('aria-label','Saved audio presets');saved.append(list);
 const refreshList=selected=>{list.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent='Choose a saved audio preset';list.append(empty);for(const record of store.saved){const o=document.createElement('option');o.value=o.textContent=record.name;list.append(o);}list.value=selected||'';};refreshList();
 button('Save Preset','v8SavePreset',()=>{refreshList(store.save(name.value));message('Audio preset saved.');},saved);
 button('Load Preset','v8LoadPreset',()=>{store.load(list.value);name.value=list.value;message('Loaded '+list.value);},saved);
 const text=document.createElement('textarea');text.id='v8JSON';text.rows=6;text.spellcheck=false;text.placeholder='Export or paste V8 audio JSON here';text.setAttribute('aria-label','V8 audio JSON');saved.append(text);
 button('Export Settings as JSON','v8Export',()=>{text.value=store.exportText();const url=URL.createObjectURL(new Blob([text.value],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='jet-sprint-v8-settings.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);message('Audio JSON exported and shown in the box.');},saved);
 button('Import Settings from JSON','v8Import',()=>{store.importText(text.value);message('Audio settings imported.');},saved);
 const file=document.createElement('input');file.id='v8ImportFile';file.type='file';file.accept='.json,application/json';file.setAttribute('aria-label','Import V8 audio JSON file');saved.append(file);
 file.onchange=async()=>{try{const f=file.files[0];if(!f)return;if(f.size>100000)throw Error('Audio file exceeds 100 KB.');const json=await f.text();store.importText(json);text.value=json;message('Audio file imported.');}catch(e){message(e.message);}finally{file.value='';}};
 content.append(status);message(store.warning||engine.status);document.body.append(root);
 root.addEventListener('toggle',()=>{if(root.open)document.getElementById('debug').open=false;});
 const stop=()=>{if(testing)testButton.click();};
 return {get testing(){return testing;},get throttle(){return testThrottle;},stop,update(){if(testing)rpm.textContent=Math.round(engine.rpm)+' RPM · '+Math.round(testThrottle*100)+'% throttle';},suspend(){testThrottle=0;throttle.value='0';throttleOut.textContent='0%';}};
}
