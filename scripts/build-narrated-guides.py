"""Create the reviewed EN/HI/GU narrated quick-start videos. No customer data.
Requires ffmpeg, Pillow with raqm, espeakng-loader 0.2.4 and Noto Sans Latin/Devanagari/Gujarati.
Run with --fonts /path/to/fonts --work /path/to/work. Existing audio is reused.
"""
import argparse, ctypes, hashlib, json, math, subprocess, wave
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
import espeakng_loader

parser = argparse.ArgumentParser()
parser.add_argument('--fonts', required=True)
parser.add_argument('--work', required=True)
parser.add_argument('--audio-only', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
work = Path(args.work); work.mkdir(parents=True, exist_ok=True)
output = root / 'public' / 'guides'; output.mkdir(parents=True, exist_ok=True)
source = json.loads((root / 'scripts/guide-narration.json').read_text())
font_files = {'en': 'Latin.ttf', 'hi': 'Devanagari.ttf', 'gu': 'Gujarati.ttf'}
labels = {'en': {'buyer': 'BUYER GUIDE', 'seller': 'SELLER GUIDE', 'step': 'STEP', 'where': 'WHERE TO GO', 'narrated': 'Narrated quick start'}, 'hi': {'buyer': 'खरीदार मार्गदर्शिका', 'seller': 'विक्रेता मार्गदर्शिका', 'step': 'चरण', 'where': 'यहाँ जाएँ', 'narrated': 'आवाज़ के साथ मार्गदर्शन'}, 'gu': {'buyer': 'ખરીદદાર માર્ગદર્શિકા', 'seller': 'વિક્રેતા માર્ગદર્શિકા', 'step': 'પગલું', 'where': 'અહીં જાઓ', 'narrated': 'અવાજ સાથે માર્ગદર્શન'}}
paths = {'account': ['Create account', 'Buyer / Seller'], 'login': ['Sign in', 'Language'], 'discover': ['Marketplace', 'Product details'], 'drape': ['Product details', 'Virtual Drape'], 'payment': ['Cart', 'Order', 'Razorpay'], 'tracking': ['Buyer dashboard', 'Orders / Tracking'], 'catalogue': ['Seller dashboard', 'Upload / Inventory'], 'bank': ['Seller dashboard', 'Earnings', 'Payout account'], 'split': ['Buyer payment', 'Seller 90%', 'FabricTrad 10%'], 'whatsapp': ['Seller number', 'Catalogue assistant', 'Review draft'], 'shipping': ['Paid order', 'Choose carrier', 'AWB + tracking link'], 'earnings': ['Orders / Invoices', 'Earnings', 'Transfer status'], 'help': ['Dashboard', 'Support / Disputes']}

def run(command):
    subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

def duration(path):
    return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(path)]))

engine = ctypes.CDLL(espeakng_loader.get_library_path())
engine.espeak_Initialize.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_char_p, ctypes.c_int]
sample_rate = engine.espeak_Initialize(2, 0, espeakng_loader.get_data_path().encode(), 0)
if sample_rate <= 0: raise RuntimeError('Offline speech engine could not initialize')
audio_parts = []
callback_type = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(ctypes.c_short), ctypes.c_int, ctypes.c_void_p)
@callback_type
def collect_audio(samples, count, _events):
    if samples and count: audio_parts.append(ctypes.string_at(samples, count * 2))
    return 0
engine.espeak_SetSynthCallback(collect_audio)
engine.espeak_SetVoiceByName.argtypes = [ctypes.c_char_p]
engine.espeak_Synth.argtypes = [ctypes.c_char_p, ctypes.c_size_t, ctypes.c_uint, ctypes.c_int, ctypes.c_uint, ctypes.c_uint, ctypes.c_void_p, ctypes.c_void_p]

def voice(job):
    role, lang, i, chapter = job
    dest = work / f'{role}-{lang}-{i:02}.wav'
    if dest.exists() and dest.stat().st_size > 1000:
        return role, lang, i, 'reused'
    speech = chapter[lang][0] + '. ' + chapter[lang][1]
    if engine.espeak_SetVoiceByName(lang.encode()) != 0: raise ValueError(f'Voice unavailable: {lang}')
    engine.espeak_SetParameter(1, 145 if lang == 'en' else 140, 0)
    engine.espeak_SetParameter(2, 85, 0)
    audio_parts.clear()
    encoded = speech.encode() + b'\0'
    if engine.espeak_Synth(encoded, len(encoded), 0, 1, 0, 1, None, None) != 0: raise RuntimeError('Offline synthesis failed')
    engine.espeak_Synchronize()
    pcm = b''.join(audio_parts)
    if len(pcm) < 1000: raise RuntimeError('Offline synthesis returned empty audio')
    with wave.open(str(dest), 'wb') as wav:
        wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(sample_rate); wav.writeframes(pcm)
    return role, lang, i, 'generated'

jobs = [(role, lang, i, chapter) for role, chapters in source.items() for lang in font_files for i, chapter in enumerate(chapters)]
for job in jobs: print(*voice(job), flush=True)
if args.audio_only: raise SystemExit(0)

def font(lang, size):
    return ImageFont.truetype(str(Path(args.fonts) / font_files[lang]), size)

def wrap(draw, text, face, width):
    lines = []; line = ''
    for word in text.split():
        candidate = (line + ' ' + word).strip()
        if draw.textlength(candidate, font=face) > width and line:
            lines.append(line); line = word
        else: line = candidate
    if line: lines.append(line)
    return lines

def frame(role, lang, i, chapter, count):
    im = Image.new('RGB', (1280,720), '#f7f8fb'); d = ImageDraw.Draw(im)
    # Original FabricTrad textile artwork; guide cards are illustrative, not live account data.
    art = ImageOps.fit(Image.open(root/'public/images/textile-showroom.webp').convert('RGB'), (410,510))
    mask = Image.new('L',art.size,0); ImageDraw.Draw(mask).rounded_rectangle((0,0,409,509),24,fill=255)
    im.paste(art,(36,140),mask)
    logo = Image.open(root/'public/images/fabrictrad-logo-horizontal.png').convert('RGBA'); logo.thumbnail((200,76))
    im.paste(logo,(36,34),logo)
    d.text((263,40),labels[lang][role],font=font(lang,25),fill='#233f69')
    d.text((263,80),labels[lang]['narrated'],font=font(lang,18),fill='#526078')
    d.rounded_rectangle((1080,40,1244,88),18,fill='#e9edf4')
    d.text((1100,50),f'{i+1:02} / {count:02}',font=font('en',24),fill='#233f69')
    nav = paths[chapter['screen']]
    d.rounded_rectangle((58,354,424,628),18,fill='#ffffff')
    d.text((80,377),labels[lang]['where'],font=font(lang,20),fill='#9b4b1f')
    for j,label in enumerate(nav):
        y=423+j*58
        d.rounded_rectangle((80,y,402,y+44),10,fill='#eef2f8')
        d.text((95,y+7),label,font=font('en',19),fill='#233f69')
    x=488; width=747
    title_font=font(lang,36)
    title_lines=wrap(d,chapter[lang][0],title_font,width)
    d.text((x,145),f"{labels[lang]['step']} {i+1:02}",font=font(lang,19),fill='#9b4b1f')
    y=182
    for line in title_lines:
        d.text((x,y),line,font=title_font,fill='#172741'); y+=51
    y+=22
    body_size=26
    while True:
        face=font(lang,body_size); lines=wrap(d,chapter[lang][1],face,width); spacing=math.ceil(body_size*1.65)
        if y+len(lines)*spacing<=634:break
        body_size-=1
        if body_size<19:raise ValueError(f'Guide text does not fit: {role}/{lang}/{i}')
    for line in lines:
        d.text((x,y),line,font=face,fill='#3d4c64'); y+=spacing
    d.rounded_rectangle((36,677,1244,683),3,fill='#dce2eb')
    d.rounded_rectangle((36,677,36+int(1208*(i+1)/count),683),3,fill='#b65a24')
    d.text((1037,692),'fabrictrad.com',font=font('en',15),fill='#526078')
    path=work/f'{role}-{lang}-{i:02}.png';im.save(path)
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
        (output/f'{role}-{lang}.vtt').write_text('\n'.join(captions))
        Image.open(work/f'{role}-{lang}-00.png').save(output/f'{role}-{lang}.webp',quality=82)
        manifest['videos'][role][lang]={'src':f'/guides/{role}-{lang}.mp4','captions':f'/guides/{role}-{lang}.vtt','poster':f'/guides/{role}-{lang}.webp','duration':round(duration(dest),2),'bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}
        print('VIDEO',role,lang,manifest['videos'][role][lang],flush=True)
(output/'manifest.json').write_text(json.dumps(manifest,indent=2))
