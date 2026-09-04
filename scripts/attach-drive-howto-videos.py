from pathlib import Path

PAGE = Path('src/app/how-to-use/page.tsx')
text = PAGE.read_text(encoding='utf-8')

step_needle = "  const step = steps[stepIndex] ?? steps[0];\n"
step_insert = """  const step = steps[stepIndex] ?? steps[0];
  const guideVideo = role === 'buyer'
    ? {
        title: 'FabricTrad Buyer Website Walkthrough',
        embedUrl: 'https://drive.google.com/file/d/1ZtiWdRkQfO5dWCiZgLUju3xiPlrSMcpA/preview',
        viewUrl: 'https://drive.google.com/file/d/1ZtiWdRkQfO5dWCiZgLUju3xiPlrSMcpA/view',
      }
    : {
        title: 'FabricTrad Seller Website Walkthrough',
        embedUrl: 'https://drive.google.com/file/d/18JJsCq3TyNHjZi-FMHiaGKLF8X4q9MAF/preview',
        viewUrl: 'https://drive.google.com/file/d/18JJsCq3TyNHjZi-FMHiaGKLF8X4q9MAF/view',
      };
"""

if '1ZtiWdRkQfO5dWCiZgLUju3xiPlrSMcpA/preview' not in text:
    if step_needle not in text:
        raise SystemExit('Could not find role/step insertion point')
    text = text.replace(step_needle, step_insert, 1)

frame_needle = """            <div className=\"order-1 min-w-0 lg:order-2\">
              <DemoFrame role={role} step={step} copy={copy} />
"""
frame_insert = """            <div className=\"order-1 min-w-0 lg:order-2\">
              <section className=\"mb-6 overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]\" aria-label={`${role === 'buyer' ? copy.buyer : copy.seller} video walkthrough`}>
                <div className=\"flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6\">
                  <div>
                    <p className={`text-[11px] font-850 uppercase tracking-[0.16em] ${role === 'buyer' ? 'text-orange-700' : 'text-teal-700'}`}>Official FabricTrad video guide</p>
                    <h2 className=\"mt-1 text-lg font-900 tracking-tight text-slate-950\">{guideVideo.title}</h2>
                    <p className=\"mt-1 text-xs text-slate-500\">Hosted from the FabricTrad business Google Drive account.</p>
                  </div>
                  <a href={guideVideo.viewUrl} target=\"_blank\" rel=\"noreferrer\" className=\"inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-850 text-slate-700 hover:bg-slate-50\">
                    Open video <Icon name=\"ArrowTopRightOnSquareIcon\" size={14} />
                  </a>
                </div>
                <div className=\"aspect-video w-full bg-slate-950\">
                  <iframe
                    key={guideVideo.embedUrl}
                    src={guideVideo.embedUrl}
                    title={guideVideo.title}
                    className=\"h-full w-full border-0\"
                    allow=\"autoplay; encrypted-media; fullscreen; picture-in-picture\"
                    allowFullScreen
                    loading=\"eager\"
                  />
                </div>
              </section>

              <DemoFrame role={role} step={step} copy={copy} />
"""

if 'Official FabricTrad video guide' not in text:
    if frame_needle not in text:
        raise SystemExit('Could not find DemoFrame insertion point')
    text = text.replace(frame_needle, frame_insert, 1)

PAGE.write_text(text, encoding='utf-8')
print('Attached role-specific FabricTrad Drive walkthroughs to /how-to-use.')
