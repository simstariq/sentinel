/* Scene 2 — building interior. Room video + ASM Recent Scans panel (live from backend). */
const { useState: useStateInt, useEffect: useEffectInt } = React;

const ROOM_VIDEO = "https://res.cloudinary.com/dcytepiva/video/upload/v1780992288/Guy_typing_on_computer_202606082141_yszxca.mp4?_s=public-apps";
const ASM_BACKEND = 'https://sentinel-production-70b1.up.railway.app';

/* Map a scan record from /recent-scans into the panel card format */
function scanToCard(scan) {
  const f = scan.findings || {};
  const total = (f.critical || 0) + (f.high || 0) + (f.medium || 0) + (f.low || 0);
  let sev = 'low';
  if (scan.score >= 75) sev = 'critical';else
  if (scan.score >= 50) sev = 'high';else
  if (scan.score >= 25) sev = 'med';else
  sev = 'low';
  const parts = [];
  if (f.critical) parts.push(`${f.critical} critical`);
  if (f.high) parts.push(`${f.high} high`);
  if (f.medium) parts.push(`${f.medium} medium`);
  if (f.low) parts.push(`${f.low} low`);
  const text = total === 0 ?
  'No findings detected. Surface looks clean.' :
  parts.join(', ') + ` finding${total > 1 ? 's' : ''} detected. Risk score: ${scan.score}/100.`;
  const date = scan.timestamp ? new Date(scan.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  return { sev, tag: scan.target, text, date };
}


const SEV = {
  critical: { c: '#ff4d6a', label: 'Critical' },
  high: { c: '#ff8a6b', label: 'High' },
  med: { c: '#ffd27a', label: 'Medium' },
  low: { c: '#9fe3ff', label: 'Low' }
};

function ClaudeMark() {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-md" style={{ background: '#D97757' }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
        <path d="M5 14c3 0 4-2 4-5M19 14c-3 0-4-2-4-5M9 16c1.2 1.2 4.8 1.2 6 0" />
      </svg>
    </span>);

}

function Interior({ building, onReveal, onBack }) {
  const [mounted, setMounted] = useStateInt(false);
  const [shownCount, setShownCount] = useStateInt(0);
  const [analyzing, setAnalyzing] = useStateInt(true);
  const [scans, setScans] = useStateInt(null); // null = loading, [] = empty, [...] = results
  const name = building ? building.name : 'Cinder Studio';

  useEffectInt(() => {
    const t0 = setTimeout(() => setMounted(true), 60);
    const t1 = setTimeout(() => setAnalyzing(false), 1400);
    const timers = [t0, t1];

    // Fetch real scan history from backend
    fetch(`${ASM_BACKEND}/recent-scans?limit=8`).
    then((r) => r.ok ? r.json() : Promise.reject()).
    then((data) => {
      const cards = (data.scans || []).map(scanToCard);
      setScans(cards);
      cards.forEach((_, i) => {
        timers.push(setTimeout(() => setShownCount((c) => Math.max(c, i + 1)), 1600 + i * 420));
      });
    }).
    catch(() => {
      setScans([]); // show empty state on error
    });

    return () => timers.forEach(clearTimeout);
  }, []);

  const cards = scans || [];

  return (
    <div className="scene fallback-room overflow-hidden no-tap-highlight">
      {/* Room video */}
      <video className="absolute inset-0 h-full w-full object-cover" src={ROOM_VIDEO} autoPlay loop muted playsInline />
      {/* cinematic grade */}
      <div className="noise-overlay pointer-events-none absolute inset-0 opacity-[0.5] mix-blend-overlay" />
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(110% 80% at 30% 40%, transparent 30%, rgba(0,0,0,0.55) 100%)' }} />
      <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.5) 100%)' }} />

      {/* Back control */}
      <button
        onClick={onBack}
        className="liquid-glass absolute left-6 top-6 z-20 flex items-center gap-2 rounded-full px-4 py-2 text-sm text-white/90 transition-colors hover:text-white">
        
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        Back to city
      </button>

      {/* Location label */}
      <div
        className="absolute left-6 top-20 z-10 transition-all duration-700"
        style={{ opacity: mounted ? 1 : 0, transform: `translateY(${mounted ? 0 : 10}px)` }}>
        
        <div className="text-[11px] uppercase tracking-[0.32em] text-[#9fe3ff]">Entering</div>
        <div className="mt-1 text-3xl font-semibold tracking-tight text-white md:text-4xl" style={{ textShadow: '0 2px 20px rgba(0,0,0,.6)' }}>{name} 27F<div><span style={{ color: 'rgb(252, 230, 200)' }}>Attack Surface Monitor</span></div></div>
        <div className="mt-1 text-sm text-white/60">Scan for vulnerabilities in websites.<br />Real-time recon of domains, open ports,<br />subdomains, SSL certs, and exposed services.</div>
        <button
          onClick={onReveal}
          className="group mt-4 flex items-center gap-2 text-sm font-medium text-white/75 transition-colors hover:text-white">
          Learn more
          <svg className="transition-transform group-hover:translate-y-0.5" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
        </button>
      </div>

      {/* Claude critique panel */}
      <div className="absolute inset-y-0 right-0 z-20 flex w-full justify-end sm:w-auto">
        <div className="liquid-glass m-0 flex h-full w-full flex-col sm:m-4 sm:h-[calc(100%-2rem)] sm:w-[420px] sm:rounded-2xl" style={{
          transition: 'transform .9s cubic-bezier(.16,1,.3,1), opacity .9s ease',
          transform: mounted ? 'translateX(0)' : 'translateX(40px)',
          opacity: mounted ? 1 : 0,
          background: 'rgba(8,10,12,0.62)'
        }}>
          
          {/* header */}
          <div className="flex items-center gap-3 border-b border-white/10 px-6 py-5">
            <ClaudeMark />
            <div className="leading-tight">
              <div className="text-sm font-medium text-white">ASM Recent Scans</div>
              <div className="text-[11px] tracking-wide text-white/50">Scan results · {name}</div>
            </div>
            <span className="ml-auto flex items-center gap-1.5 text-[11px] text-white/60">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: analyzing ? '#ffd27a' : '#7ee0a6', boxShadow: '0 0 8px 1px currentColor' }}></span>
              {analyzing ? 'Analyzing' : 'Complete'}
            </span>
          </div>

          {/* body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <p className="mb-5 text-[13px] leading-relaxed text-white/70">
              {analyzing ?
              'Reading the layout, type and motion of the site rendered in this room…' :
              'I reviewed the site on the screen. Here\u2019s what needs to be fixed:'}
            </p>

            {cards.length === 0 && !analyzing &&
            <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-5 text-center">
                <div className="mb-2 text-2xl opacity-30">◎</div>
                <p className="text-[12px] leading-relaxed text-white/45">Your recent scans will appear here. You can expand them for more info or click to rescan, or start a new scan below.</p>
              </div>
            }
            <div className="space-y-3">
              {cards.map((f, i) => {
                const sev = SEV[f.sev] || SEV['low'];
                const visible = i < shownCount;
                return (
                  <div
                    key={i}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                    style={{
                      transition: 'transform .5s cubic-bezier(.16,1,.3,1), opacity .5s ease',
                      transform: visible ? 'translateY(0)' : 'translateY(12px)',
                      opacity: visible ? 1 : 0
                    }}>
                    
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: sev.c, boxShadow: `0 0 8px 1px ${sev.c}` }}></span>
                      <span className="text-[12px] font-medium tracking-tight text-white">{f.tag}</span>
                      <span className="ml-auto text-[10px] uppercase tracking-[0.16em]" style={{ color: sev.c }}>{sev.label}</span>
                    </div>
                    <p className="text-[12.5px] leading-relaxed text-white/65">{f.text}</p>
                    {f.date && <p className="mt-1 text-[10px] text-white/30">{f.date}</p>}
                  </div>);

              })}
            </div>
          </div>

          {/* footer CTA */}
          <div className="border-t border-white/10 px-6 py-5">
            <p className="mb-3 text-[12px] leading-relaxed text-white/55">
              Run a new scan from the dashboard to see results here.
            </p>
            <a
              href="https://sentinel.tariqsims.com/asm.html"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-medium text-black transition-all"
              style={{ background: '#DEDBC8' }}>
              Start Scan
              <svg className="transition-transform group-hover:translate-x-1" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </a>
          </div>
        </div>
      </div>
    </div>);

}

window.Interior = Interior;