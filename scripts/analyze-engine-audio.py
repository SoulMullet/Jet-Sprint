"""Optional offline audit; requires ffmpeg/ffprobe, numpy, scipy, matplotlib.
Does not modify recordings. No analysis dependencies are used by the game/build.
"""
import hashlib
import json
import os
import subprocess
from pathlib import Path
os.environ.setdefault('MPLCONFIGDIR', '/tmp/jet-sprint-matplotlib')
import numpy as np
from scipy import signal
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
root=Path(__file__).resolve().parents[1]
folder=root/'public/audio/Engine'
out=root/'docs/multi-v8'
out.mkdir(parents=True,exist_ok=True)
names=['EngineIdle.m4a','EngineRev.m4a','EngineRevDown.m4a','EngineCruise.m4a','EngineCruiseLayerOne.m4a','EngineJump.m4a','EngineCruise.wav','EngineRev.wav']
fig,axes=plt.subplots(len(names),2,figsize=(14,2.5*len(names)))
records=[]
waveforms={}
for row,name in enumerate(names):
 path=folder/name
 meta=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration:stream=codec_name,sample_rate,channels','-of','json',str(path)]))
 pcm=subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-ar','32000','-ac','2','-f','f32le','-'])
 data=np.frombuffer(pcm,dtype='<f4').reshape(-1,2);mono=data.mean(axis=1);rate=32000
 waveforms[name]=mono
 f,t,z=signal.stft(mono,rate,nperseg=2048,noverlap=1536)
 axes[row,0].plot(np.arange(len(mono))/rate,mono,lw=.25);axes[row,0].set_title(name+' / waveform');axes[row,0].set_xlabel('seconds')
 axes[row,1].pcolormesh(t,f,20*np.log10(abs(z)+1e-7),vmin=-65,vmax=-12,shading='auto');axes[row,1].set_ylim(0,2500);axes[row,1].set_ylabel('Hz');axes[row,1].set_xlabel('seconds')
 rms=float(np.sqrt(np.mean(data*data)));peak=float(abs(data).max())
 windows=[]
 for start in np.arange(0,len(mono)/rate-.25,.25):
  chunk=mono[int(start*rate):int((start+.25)*rate)];fr,power=signal.welch(chunk,rate,nperseg=2048);peaks,_=signal.find_peaks(power)
  peaks=sorted([i for i in peaks if 40<fr[i]<800],key=lambda i:power[i],reverse=True)[:3]
  windows.append({'start':float(start),'rms':float(np.sqrt(np.mean(chunk*chunk))),'centroidHz':float(np.dot(fr,power)/sum(power)),'strongPeaksHz':[float(fr[i]) for i in peaks]})
 chunks=[np.sqrt(np.mean(data[i:i+320]**2)) for i in range(0,len(data),320)]
 active=[i for i,v in enumerate(chunks) if v>.002]
 records.append({'file':'public/audio/Engine/'+name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size,'containerSeconds':float(meta['format']['duration']),**meta['streams'][0],'measuredAtHz':rate,'decodedSeconds':len(data)/rate,'stereoRMS':rms,'rmsDbFS':20*np.log10(rms),'stereoPeak':peak,'peakDbFS':20*np.log10(peak),'overFullScaleChannelSamples':int(np.sum(abs(data)>1)),'firstActive10msWindow':active[0]*.01 if active else None,'lastActive10msWindow':active[-1]*.01 if active else None,'windows':windows})
comparisons={}
for name in ['EngineCruise','EngineRev']:
 a=waveforms[name+'.m4a'];b=waveforms[name+'.wav'];n=min(len(a),len(b));a=a[:n];b=b[:n];gain=float(np.dot(a,b)/np.dot(a,a))
 comparisons[name]={'correlation':float(np.corrcoef(a,b)[0,1]),'wavGainAgainstM4a':gain,'residualRMS':float(np.sqrt(np.mean((b-gain*a)**2)))}
a=waveforms['EngineCruise.m4a'];b=waveforms['EngineCruiseLayerOne.m4a'];a=a-a.mean();b=b-b.mean();prefix=np.cumsum(np.r_[0,a*a]);energy=prefix[len(b):]-prefix[:-len(b)]
comparisons['secondCruiseAgainstMain']={'maxFullClipAlignedCorrelation':float(np.max(abs(signal.correlate(a,b,mode='valid',method='fft')/np.sqrt(energy*np.dot(b,b)))))}
(out/'source-analysis.json').write_text(json.dumps({'method':'Stereo float PCM resampled to 32 kHz; peaks are not calibrated RPM. Contamination cannot be excluded without listening.','recordings':records,'comparisons':comparisons},indent=2)+'\n')
fig.tight_layout();fig.savefig(out/'source-analysis.png');print('Audited original eight assets; originals unchanged.')
