"""Create the reviewed EN/HI/GU narrated quick-start videos. No customer data.
Requires ffmpeg, Pillow with raqm, torch, transformers and Noto Sans Latin/Devanagari/Gujarati.
Narration uses Meta's open-source MMS-TTS neural voice models (facebook/mms-tts-eng,
-hin, -guj), downloaded once from Hugging Face and run fully offline/locally afterwards
-- no API key, no billing, no per-run cost.
Run `node scripts/render-frames.mjs <work>` FIRST -- this script consumes the slide
PNGs that renders and aborts without them; it does not draw them itself.
Then run with --fonts /path/to/fonts --work /path/to/work. Existing audio is reused
via a per-chapter fingerprint, so re-running after a narration edit only re-synthesises
the chapters whose text actually changed -- but an empty work dir means a full rebuild
of all 45 clips.
"""
import argparse, hashlib, json, subprocess, wave
from pathlib import Path
from PIL import Image
import numpy as np
import torch
from transformers import VitsModel, AutoTokenizer

parser = argparse.ArgumentParser()
parser.add_argument('--fonts', required=True)
parser.add_argument('--work', required=True)
parser.add_argument('--audio-only', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
work = Path(args.work).resolve(); work.mkdir(parents=True, exist_ok=True)
output = root / 'public' / 'guides'; output.mkdir(parents=True, exist_ok=True)
source = json.loads((root / 'scripts/guide-narration.json').read_text(encoding='utf-8'))
font_files = {'en': 'Latin.ttf', 'hi': 'Devanagari.ttf', 'gu': 'Gujarati.ttf'}
labels = {'en': {'buyer': 'BUYER GUIDE', 'seller': 'SELLER GUIDE', 'step': 'STEP', 'where': 'WHERE TO GO', 'narrated': 'Narrated quick start'}, 'hi': {'buyer': 'खरीदार मार्गदर्शिका', 'seller': 'विक्रेता मार्गदर्शिका', 'step': 'चरण', 'where': 'यहाँ जाएँ', 'narrated': 'आवाज़ के साथ मार्गदर्शन'}, 'gu': {'buyer': 'ખરીદદાર માર્ગદર્શિકા', 'seller': 'વિક્રેતા માર્ગદર્શિકા', 'step': 'પગલું', 'where': 'અહીં જાઓ', 'narrated': 'અવાજ સાથે માર્ગદર્શન'}}
# The 'WHERE TO GO' breadcrumb lives in scripts/render-frames.mjs (navPaths); this file
# only stitches the PNGs that script renders. An identical dict used to sit here and was
# never read, so editing it looked like it fixed the on-screen labels and changed nothing.

def run(command):
    result = subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    if result.returncode:
        raise RuntimeError(result.stderr.decode(errors='replace')[-4000:])

def duration(path):
    return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(path)]))

MMS_MODELS = {'en': 'facebook/mms-tts-eng', 'hi': 'facebook/mms-tts-hin', 'gu': 'facebook/mms-tts-guj'}
_loaded = {}
def tts_engine(lang):
    if lang not in _loaded:
        tokenizer = AutoTokenizer.from_pretrained(MMS_MODELS[lang])
        model = VitsModel.from_pretrained(MMS_MODELS[lang])
        model.eval()
        _loaded[lang] = (tokenizer, model)
    return _loaded[lang]

def voice(job):
    role, lang, i, chapter = job
    dest = work / f'{role}-{lang}-{i:02}.wav'
    speech = chapter[lang][0] + '. ' + chapter[lang][1]
    fingerprint = hashlib.sha256((lang + ':mms-tts:' + MMS_MODELS[lang] + ':' + speech).encode()).hexdigest()
    cache_key = dest.with_suffix('.sha256')
    if dest.exists() and dest.stat().st_size > 1000 and cache_key.exists() and cache_key.read_text() == fingerprint:
        return role, lang, i, 'reused'
    tokenizer, model = tts_engine(lang)
    inputs = tokenizer(speech, return_tensors='pt')
    with torch.no_grad():
        waveform = model(**inputs).waveform
    rate = model.config.sampling_rate
    samples = waveform.squeeze().numpy()
    if samples.size < 1000: raise RuntimeError('Offline synthesis returned empty audio')
    pcm16 = np.clip(samples, -1.0, 1.0)
    pcm16 = (pcm16 * 32767.0).astype(np.int16)
    with wave.open(str(dest), 'wb') as wav:
        wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(rate); wav.writeframes(pcm16.tobytes())
    cache_key.write_text(fingerprint)
    return role, lang, i, 'generated'

jobs = [(role, lang, i, chapter) for role, chapters in source.items() for lang in font_files for i, chapter in enumerate(chapters)]
for job in jobs: print(*voice(job), flush=True)
if args.audio_only: raise SystemExit(0)

def frame(role, lang, i, chapter, count):
    # Frames are pre-rendered by scripts/render-frames.mjs via headless Chromium.
    # Pillow's Windows build lacks libraqm and cannot correctly shape Devanagari or
    # Gujarati text (conjuncts and vowel-sign reordering render wrong); Chromium's
    # HarfBuzz-based text engine shapes both scripts correctly.
    path = work / f'{role}-{lang}-{i:02}.png'
    if not path.exists():
        raise FileNotFoundError(f'Missing pre-rendered frame: {path}. Run render-frames.mjs first.')
    return path

def timestamp(seconds):
    milliseconds=round(seconds*1000); hours,milliseconds=divmod(milliseconds,3600000); minutes,milliseconds=divmod(milliseconds,60000); sec,ms=divmod(milliseconds,1000)
    return f'{hours:02}:{minutes:02}:{sec:02}.{ms:03}'

manifest = {'version':'2026-09-06','kind':'narrated_quick_start','syntheticNarration':True,'videos':{}}
for role, chapters in source.items():
    manifest['videos'][role]={}
    for lang in font_files:
        segments=[]; captions=['WEBVTT','']; elapsed=0
        for i,chapter in enumerate(chapters):
            still=frame(role,lang,i,chapter,len(chapters)); speech=work/f'{role}-{lang}-{i:02}.wav'; length=duration(speech)+1.0
            segment=work/f'{role}-{lang}-{i:02}.mp4'
            run(['ffmpeg','-y','-hide_banner','-loglevel','error','-loop','1','-framerate','24','-i',str(still),'-i',str(speech),'-t',str(length),'-vf','format=yuv420p','-af','apad','-c:v','libx264','-preset','veryfast','-crf','23','-tune','stillimage','-c:a','aac','-b:a','96k','-ar','24000','-ac','1','-movflags','+faststart',str(segment)])
            segments.append(segment)
            # Short caption chunks, timed within each spoken chapter; full transcript is on the page.
            words=(chapter[lang][0]+'. '+chapter[lang][1]).split(); chunks=[' '.join(words[k:k+12]) for k in range(0,len(words),12)]
            cue=(length-1)/len(chunks)
            for k,line in enumerate(chunks):captions.extend([f'{timestamp(elapsed+k*cue)} --> {timestamp(elapsed+(k+1)*cue)}',line,''])
            elapsed+=length
        listing=work/f'{role}-{lang}-segments.txt';listing.write_text(''.join(f"file '{p}'\n" for p in segments))
        dest=output/f'{role}-{lang}.mp4'
        run(['ffmpeg','-y','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',str(listing),'-c','copy','-metadata:s:a:0',f'language={dict(en="eng",hi="hin",gu="guj")[lang]}','-movflags','+faststart',str(dest)])
        (output/f'{role}-{lang}.vtt').write_text('\n'.join(captions), encoding='utf-8')
        Image.open(work/f'{role}-{lang}-00.png').save(output/f'{role}-{lang}.webp',quality=82)
        manifest['videos'][role][lang]={'src':f'/guides/{role}-{lang}.mp4','captions':f'/guides/{role}-{lang}.vtt','poster':f'/guides/{role}-{lang}.webp','duration':round(duration(dest),2),'bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}
        print('VIDEO',role,lang,manifest['videos'][role][lang],flush=True)
(output/'manifest.json').write_text(json.dumps(manifest,indent=2), encoding='utf-8')
