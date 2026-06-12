/* Scene — Helix Tower page. */
const { useState: useStateHelix, useEffect: useEffectHelix } = React;
const HELIX_VIDEO = "https://res.cloudinary.com/dcytepiva/video/upload/v1780992288/Guy_typing_on_computer_202606082141_yszxca.mp4?_s=public-apps";

function HelixScene({ building, onBack }) {
  const [mounted, setMounted] = useStateHelix(false);

  useEffectHelix(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden no-tap-highlight" style={{ background: '#0a0b0e' }}>
      <video className="absolute inset-0 h-full w-full object-cover" src={HELIX_VIDEO} autoPlay loop muted playsInline />
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
          {building ? building.name : 'Helix Tower'}
          <div><span style={{ color: '#8ec4f8' }}>Email Security Checker</span></div>
        </div>
        <div className="mt-1 text-sm text-white/60"><div><span>Validate SPF, DKIM, and DMARC records.<br />Flag misconfigured email infrastructure.</span></div></div>
      </div>
    </div>
  );
}

window.HelixScene = HelixScene;
