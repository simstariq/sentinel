/* Scene — Construction Site (Repo Scanner) page with live secret scan history panel. */
const { useState: useStateConst, useEffect: useEffectConst } = React;
const CONSTRUCTION_VIDEO = "https://res.cloudinary.com/dcytepiva/video/upload/q_auto/f_auto/v1781165290/Construction_worker_typing_on_la__202606102204_cbcnpi.mp4";
const SECRETS_BACKEND = 'https://sentinel-production-70b1.up.railway.app';

const SEV_SECRETS = {
  critical: { c: '#ff4d6a', label: 'Critical' },
  high:     { c: '#ff8a6b', label: 'High' },
  med:      { c: '#ffd27a', label: 'Medium' },
  low:      { c: '#9fe3ff', label: 'Low' },
};

function secretScanToCard(scan) {
  const c = scan.counts || {};
  const total = (c.critical||0) + (c.high||0) + (c.medium||0) + (c.low||0);
  let sev = 'low';
  if      ((c.critical||0) > 0) sev = 'critical';
  else if ((c.high||0)     > 0) sev = 'high';
  else if ((c.medium||0)   > 0) sev = 'med';

  const parts = [];
  if (c.critical) parts.push(`${c.critical} critical`);
  if (c.high)     parts.push(`${c.high} high`);
  if (c.medium)   parts.push(`${c.medium} medium`);
  if (c.low)      parts.push(`${c.low} low`);

  const text = total === 0
    ? 'No secrets detected. Repository appears clean.'
    : parts.join(', ') + ` secret${total > 1 ? 's' : ''} exposed.`;

  const date = scan.timestamp
    ? new Date(scan.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  // Shorten repo URL for display
  const tag = (scan.target || '').replace(/^https?:\/\/(github\.com\/)?/, '').replace(/^github\.com\//, '');

  return { sev, tag, text, date, total };
}

function ConstructionScene({ building, onBack }) {
  const [mounted, setMounted]     = useStateConst(false);
  const [analyzing, setAnalyzing] = useStateConst(true);
  const [scans, setScans]         = useStateConst(null);
  const [shownCount, setShownCount] = useStateConst(0);

  useEffectConst(() => {
    const timers = [];
    timers.push(setTimeout(() => setMounted(true), 60));
    timers.push(setTimeout(() => setAnalyzing(false), 1400));

    fetch(`${SECRETS_BACKEND}/recent-secret-scans?limit=8`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        const cards = (data.scans || []).map(secretScanToCard);
        setScans(cards);
        cards.forEach((_, i) => {
          timers.push(setTimeout(() => setShownCount(c => Math.max(c, i + 1)), 1600 + i * 420));
        });
      })
      .catch(() => setScans([]));

    return () => timers.forEach(clearTimeout);
  }, []);

  const cards = scans || [];

  return (
    <div className="fixed inset-0 overflow-hidden no-tap-highlight" style={{ background: '#0a0b0e' }}>
      <video className="absolute inset-0 h-full w-full object-cover" src={CONSTRUCTION_VIDEO} autoPlay loop muted playsInline />
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(110% 80% at 30% 40%, transparent 30%, rgba(0,0,0,0.55) 100%)' }} />
      <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.5) 100%)' }} />

      {/* Back */}
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
        <div className="mt-1 text-3xl font-semibold tracking-tight text-white md:text-4xl" style={{ textShadow: '0 2px 20px rgba(0,0,0,.6)' }}>
          {building ? building.name : 'Construction Site'}
          <div><span style={{ color: '#fefda1' }}>Repo Scanner</span></div>
        </div>
        <div className="mt-1 text-sm text-white/60">
          Scan GitHub repositories or upload files to detect<br />
          exposed API keys, tokens, and credentials
        </div>
      </div>

      {/* Right panel — recent secret scans */}
      <div
        className="absolute bottom-0 right-0 top-0 z-10 flex w-80 flex-col overflow-hidden transition-all duration-700 md:w-96"
        style={{ opacity: mounted ? 1 : 0, transform: `translateX(${mounted ? 0 : 24}px)` }}>
        <div className="flex h-full flex-col" style={{ background: 'rgba(8,6,4,0.72)', backdropFilter: 'blur(28px)', borderLeft: '1px solid rgba(255,253,161,0.12)' }}>

          {/* Panel header */}
          <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/40">Sentinel</div>
              <div className="mt-0.5 text-[15px] font-medium tracking-tight text-white">Recent Repo Scans</div>
            </div>
            <div className="flex items-center gap-2">
              {analyzing
                ? <span className="text-[10px] text-white/40">Connecting…</span>
                : <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#fefda1', boxShadow: '0 0 6px 2px rgba(254,253,161,0.7)' }}></span>
              }
            </div>
          </div>

          {/* Scan cards */}
          <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: 'none' }}>

            {/* Empty state */}
            {cards.length === 0 && !analyzing && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-6 text-center">
                <div className="mb-2 text-2xl opacity-30">🔑</div>
                <p className="text-[12px] leading-relaxed text-white/45">
                  Your recent repo scans will appear here. Run a scan from the dashboard to see results — expand for details or click to rescan.
                </p>
              </div>
            )}

            {/* Loading shimmer */}
            {analyzing && (
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="h-16 rounded-xl border border-white/5 bg-white/[0.02]" style={{ opacity: 1 - i * 0.2 }} />
                ))}
              </div>
            )}

            {/* Real scan cards */}
            <div className="space-y-3">
              {cards.map((f, i) => {
                const sev = SEV_SECRETS[f.sev] || SEV_SECRETS['low'];
                return (
                  <div
                    key={i}
                    className="rounded-xl border px-4 py-3.5 transition-all duration-500"
                    style={{
                      borderColor: 'rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.03)',
                      opacity: i < shownCount ? 1 : 0,
                      transform: `translateY(${i < shownCount ? 0 : 8}px)`,
                    }}>
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: sev.c, boxShadow: `0 0 8px 1px ${sev.c}` }}></span>
                      <span className="text-[12px] font-medium tracking-tight text-white truncate max-w-[160px]">{f.tag}</span>
                      <span className="ml-auto text-[10px] uppercase tracking-[0.16em]" style={{ color: sev.c }}>{sev.label}</span>
                    </div>
                    <p className="text-[12.5px] leading-relaxed text-white/65">{f.text}</p>
                    {f.date && <p className="mt-1 text-[10px] text-white/30">{f.date}</p>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer CTA */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} className="px-6 py-5">
            <p className="mb-3 text-[12px] leading-relaxed text-white/55">
              Run a new repo scan from the dashboard to see results here.
            </p>
            <a
              href="https://sentinel.tariqsims.com/secrets.html"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-medium text-black transition-all"
              style={{ background: '#fefda1', boxShadow: '0 0 0 1px rgba(254,253,161,.5), 0 8px 30px -8px rgba(254,253,161,.6)' }}>
              Start Scan
              <svg className="transition-transform group-hover:translate-x-1" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

window.ConstructionScene = ConstructionScene;
