'use client';

import { useEffect, useRef, useState } from 'react';
import { useAppPreferences } from '@/contexts/AppPreferencesContext';
import narration from '../../scripts/guide-narration.json';

type AudioLanguage = 'en' | 'hi' | 'gu';
type GuideRole = 'buyer' | 'seller';
const languages = { en: 'English', hi: 'हिंदी', gu: 'ગુજરાતી' };
const isAudioLanguage = (value: string | null): value is AudioLanguage =>
  value === 'en' || value === 'hi' || value === 'gu';

const copy = {
  en: {
    title: 'Watch. Listen. Get started.', buyer: 'Buyer video guide', seller: 'Seller video guide',
    language: 'Video audio language', note: 'A narrated quick start with illustrated steps, captions and a full transcript.',
    transcript: 'Read the transcript', original: 'Original screen recording', originalNote: 'Original audio; the language selection applies to the narrated guide above.',
    error: 'The video could not load. Check your connection and try again, or read the transcript below.', retry: 'Retry video', open: 'Open video',
  },
  hi: {
    title: 'देखें। सुनें। शुरुआत करें।', buyer: 'खरीदार वीडियो मार्गदर्शिका', seller: 'विक्रेता वीडियो मार्गदर्शिका',
    language: 'वीडियो की आवाज़ की भाषा', note: 'चित्रों, आवाज़, उपशीर्षकों और पूरी लिखित जानकारी के साथ शुरुआत करें।',
    transcript: 'पूरी लिखित जानकारी पढ़ें', original: 'मूल स्क्रीन रिकॉर्डिंग', originalNote: 'इस रिकॉर्डिंग की आवाज़ मूल भाषा में है। चुनी गई भाषा ऊपर की मार्गदर्शिका पर लागू होती है।',
    error: 'वीडियो लोड नहीं हुआ। अपना इंटरनेट जाँचकर फिर कोशिश करें, या नीचे लिखित जानकारी पढ़ें।', retry: 'फिर चलाएँ', open: 'वीडियो खोलें',
  },
  gu: {
    title: 'જુઓ. સાંભળો. શરૂઆત કરો.', buyer: 'ખરીદદાર વિડિયો માર્ગદર્શિકા', seller: 'વિક્રેતા વિડિયો માર્ગદર્શિકા',
    language: 'વિડિયોના અવાજની ભાષા', note: 'ચિત્રો, અવાજ, સબટાઇટલ અને સંપૂર્ણ લખાણ સાથે શરૂઆત કરો.',
    transcript: 'સંપૂર્ણ લખાણ વાંચો', original: 'મૂળ સ્ક્રીન રેકોર્ડિંગ', originalNote: 'આ રેકોર્ડિંગનો અવાજ મૂળ ભાષામાં છે. પસંદ કરેલી ભાષા ઉપરની માર્ગદર્શિકાને લાગુ પડે છે.',
    error: 'વિડિયો લોડ થયો નથી. તમારું ઇન્ટરનેટ તપાસીને ફરી પ્રયાસ કરો, અથવા નીચેનું લખાણ વાંચો.', retry: 'ફરી ચલાવો', open: 'વિડિયો ખોલો',
  },
};

export default function NarratedGuideVideo({ role }: { role: GuideRole }) {
  const { language } = useAppPreferences();
  const [audioLanguage, setAudioLanguage] = useState<AudioLanguage>('en');
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const audioChosen = useRef(false);

  useEffect(() => {
    if (!audioChosen.current) setAudioLanguage(isAudioLanguage(language) ? language : 'en');
  }, [language]);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('audio');
    if (isAudioLanguage(requested)) {
      audioChosen.current = true;
      setAudioLanguage(requested);
    }
  }, []);
  useEffect(() => { setFailed(false); }, [role, audioLanguage]);

  const c = copy[audioLanguage];
  const path = `/guides/${role}-${audioLanguage}`;
  const original = role === 'buyer' ? '1ZtiWdRkQfO5dWCiZgLUju3xiPlrSMcpA' : '18JJsCq3TyNHjZi-FMHiaGKLF8X4q9MAF';

  function chooseLanguage(value: string) {
    if (!isAudioLanguage(value)) return;
    audioChosen.current = true;
    setAudioLanguage(value);
    const url = new URL(window.location.href);
    url.searchParams.set('audio', value);
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }

  return (
    <section className="mb-8 overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]" aria-label={c[role]} lang={audioLanguage} data-narrated-guide>
      <div className="flex flex-wrap items-center justify-between gap-5 px-5 py-5 sm:px-7">
        <div className="max-w-xl">
          <p className="text-xs font-850 text-orange-800">{c[role]}</p>
          <h2 className="mt-1 text-2xl font-900 tracking-tight text-slate-950">{c.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{c.note}</p>
        </div>
        <label className="flex min-w-48 flex-col gap-2 text-xs font-850 text-slate-700">
          {c.language}
          <select aria-label={c.language} data-guide-audio-language value={audioLanguage} onChange={(event) => chooseLanguage(event.target.value)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 pr-9 text-base font-750 text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700">
            {Object.entries(languages).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <video key={`${path}-${retry}`} className="aspect-video w-full bg-slate-950" controls playsInline preload="metadata" poster={`${path}.webp`} src={`${path}.mp4`} aria-label={`${c[role]} — ${languages[audioLanguage]}`} onError={() => setFailed(true)}>
        <track kind="captions" src={`${path}.vtt`} srcLang={audioLanguage} label={languages[audioLanguage]} />
        <a href={`${path}.mp4`}>{c.open}</a>
      </video>
      {failed && <div role="alert" className="space-y-3 bg-orange-50 px-5 py-4 text-sm text-orange-950"><p>{c.error}</p><button type="button" onClick={() => { setFailed(false); setRetry((value) => value + 1); }} className="min-h-11 rounded-lg border border-orange-300 bg-white px-4 font-800">{c.retry}</button></div>}
      <div className="px-5 py-5 sm:px-7">
        <details className="group">
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-850 text-slate-800">{c.transcript}</summary>
          <ol className="mt-3 space-y-5 border-t border-slate-200 pt-5">
            {narration[role].map((chapter, index) => <li key={`${role}-${index}`}><h3 className="text-base font-850 text-slate-950">{index + 1}. {chapter[audioLanguage][0]}</h3><p className="mt-2 max-w-4xl text-sm leading-7 text-slate-600">{chapter[audioLanguage][1]}</p></li>)}
          </ol>
        </details>
        <div className="mt-3 border-t border-slate-100 pt-4 text-xs leading-6 text-slate-500">
          <a href={`https://drive.google.com/file/d/${original}/view`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center font-850 text-slate-700 underline underline-offset-4">{c.original}</a>
          <p>{c.originalNote}</p>
        </div>
      </div>
    </section>
  );
}
