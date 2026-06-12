/* Scene 1 — VEX "city" hero (faithful to spec) + scan interaction + zoom-into-building. */
const { useState: useStateCity, useEffect: useEffectCity, useRef: useRefCity } = React;

const VEX_VIDEO = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260403_050628_c4e32401-fab4-4a27-b7a8-6e9291cd5959.mp4";

const BUILDINGS = [
{ id: 'helix', name: 'Helix Tower', sub: 'Email Security Checker', x: 30, y: 33 },
{ id: 'meridian', name: 'Meridian', sub: 'Operations', x: 49, y: 24 },
{ id: 'apex', name: 'Apex One', sub: 'CVE Stack Checker', x: 66, y: 29 },
{ id: 'cinder', name: 'Cinder Studio', sub: 'Attack Surface Monitor', x: 82, y: 41 },
{ id: 'construction', name: 'Construction Site', sub: 'Repo Scanner', x: 53, y: 57 },
{ id: 'middlepark', name: 'Middle Park', sub: 'Revision Tool', x: 91, y: 63 }];


function ScanIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" opacity="0.5" />
      <path d="M12 3a9 9 0 0 1 9 9" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    </svg>);

}

function Hotspot({ b, onPick, idx }) {
  const [hover, setHover] = useStateCity(false);
  return (
    <button
      onClick={() => onPick(b)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="absolute -translate-x-1/2 -translate-y-1/2 no-tap-highlight group"
      style={{
        left: `${b.x}%`, top: `${b.y}%`
      }}>
      
      <span className="relative flex items-center justify-center" style={{ width: 26, height: 26 }}>
        <span className="absolute rounded-full pulse-ring" style={{ width: 26, height: 26, border: '1.5px solid var(--scan-mid, rgba(120,220,255,0.8))' }}></span>
        <span className="absolute rounded-full" style={{ width: 26, height: 26, border: '1.5px solid var(--scan-mid, rgba(120,220,255,0.55))' }}></span>
        <span className="rounded-full" style={{ width: 9, height: 9, background: 'var(--scan-color, #bff0ff)', boxShadow: '0 0 12px 3px var(--scan-glow, rgba(120,220,255,0.9))' }}></span>
      </span>
      <span
        className="liquid-glass absolute left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-left transition-all duration-200"
        style={{ top: '100%', opacity: hover ? 1 : 0, transform: `translateX(-50%) translateY(${hover ? 0 : 6}px)`, pointerEvents: 'none' }}>
        
        <span className="block text-[12px] font-medium tracking-tight text-white">{b.name}</span>
        <span className="block text-[10px] uppercase tracking-[0.18em] text-[#9fe3ff]">{b.sub}</span>
      </span>
    </button>);

}

function CityHero({ onEnterBuilding }) {
  const [scanning, setScanning] = useStateCity(false);
  const [scanned, setScanned] = useStateCity(false); // hotspots revealed
  const [sweep, setSweep] = useStateCity(false);
  const [zoom, setZoom] = useStateCity(null); // building being entered
  const cityRef = useRefCity(null);

  const startScan = () => {
    if (scanning || scanned) return;
    setScanning(true);
    setSweep(true);
    setTimeout(() => {setScanned(true);}, 1500);
    setTimeout(() => {setSweep(false);setScanning(false);}, 2300);
  };

  const pick = (b) => {
    setZoom(b);
    if (cityRef.current) {
      cityRef.current.style.transformOrigin = `${b.x}% ${b.y}%`;
    }
    setTimeout(() => onEnterBuilding(b), 1150);
  };

  const navLinks = ['Story', 'Investing', 'Building', 'Go to Classic Mode'];

  return (
    <div className="scene fallback-city overflow-hidden no-tap-highlight">
      {/* zoomable city layer */}
      <div
        ref={cityRef}
        className="absolute inset-0"
        style={{
          transition: 'transform 1.15s cubic-bezier(0.7,0,0.84,0), opacity 1.15s ease, filter 1.15s ease',
          transform: zoom ? 'scale(7.5)' : 'scale(1)',
          opacity: zoom ? 0 : 1,
          filter: zoom ? 'blur(6px)' : 'blur(0)'
        }}>
        
        {/* Background video — raw, no overlay (per spec) */}
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={VEX_VIDEO}
          autoPlay loop muted playsInline />
        

        {/* dim during scanning to focus the skyline */}
        <div
          className="pointer-events-none absolute inset-0 bg-black transition-opacity duration-700"
          style={{ opacity: scanning || scanned ? 0.32 : 0 }} />
        
        {/* Atmosphere overlays — driven by tweaks CSS vars */}
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 130% 80% at 50% 0%, rgba(10,25,50,0.8) 0%, rgba(0,0,0,0.94) 100%)', opacity: 'var(--atm-haze, 0)', transition: 'opacity 0.7s' }} />
        <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.96) 100%)', opacity: 'var(--atm-noir, 0)', transition: 'opacity 0.7s' }} />

        {/* layout column */}
        <div className="relative flex h-full flex-col">
          {/* Navbar */}
          <div className="px-6 pt-6 md:px-12 lg:px-16">
            <nav className="liquid-glass flex items-center justify-between rounded-xl px-4 py-2">
              <span className="text-2xl font-semibold tracking-tight"><span style={{ color: 'rgb(239, 239, 239)' }}>S E N T I N E L</span></span>
              <div className="hidden items-center gap-8 md:flex">
                {navLinks.map((l) =>
                  l === 'Go to Classic Mode'
                    ? <a key={l} href="https://sentinel.tariqsims.com/index.html" target="_blank" rel="noopener noreferrer" className="text-sm text-white/90 transition-colors hover:text-gray-300">{l}</a>
                    : <a key={l} href="#" className="text-sm text-white/90 transition-colors hover:text-gray-300">{l}</a>
                )}
              </div>
              <button className="rounded-lg bg-white px-6 py-2 text-sm font-medium text-black transition-colors hover:bg-gray-100">Start a Scan
</button>
            </nav>
          </div>

          {/* Hero content pinned to bottom */}
          <div className="flex flex-1 flex-col justify-end px-6 pb-12 transition-opacity duration-500 md:px-12 lg:px-16 lg:pb-16"
          style={{ opacity: scanned ? 0.12 : 1, pointerEvents: scanned ? 'none' : 'auto' }}>
            
            <div className="lg:grid lg:grid-cols-2 lg:items-end">
              {/* Left */}
              <div>
                <AnimatedHeading
                  text={"Shaping tomorrow\nwith vision and action."}
                  className="mb-4 font-normal text-4xl md:text-5xl lg:text-6xl xl:text-7xl"
                  style={{ letterSpacing: '-0.04em', lineHeight: 1.02 }} />
                
                <FadeIn delay={800} duration={1000}>
                  <p className="mb-5 max-w-xl text-base text-gray-300 md:text-lg">
                    We back visionaries and craft ventures that define what comes next.
                  </p>
                </FadeIn>
                <FadeIn delay={1200} duration={1000}>
                  <div className="flex flex-wrap items-center gap-4">
                    <button
                      onClick={startScan}
                      className="group flex items-center gap-2 rounded-lg px-8 py-3 font-medium text-[#062430] transition-all"
                      style={{ background: 'var(--scan-btn, linear-gradient(180deg,#cdf3ff,#8fe0ff))', color: 'var(--scan-btn-txt, #062430)', boxShadow: '0 0 0 1px var(--scan-mid, rgba(120,220,255,.5)), 0 8px 30px -8px var(--scan-glow, rgba(120,220,255,.7))' }}>
                      
                      <ScanIcon />
                      {scanning ? 'Scanning…' : scanned ? 'Select a building' : 'Start Scan'}
                    </button>
                    <button className="rounded-lg bg-white px-8 py-3 font-medium text-black transition-colors hover:bg-gray-100">More info</button>
                    <button className="liquid-glass rounded-lg border border-white/20 px-8 py-3 font-medium text-white transition-colors hover:bg-white hover:text-black">Guided Tour</button>
                  </div>
                </FadeIn>
              </div>
              {/* Right tag */}
              <FadeIn delay={1400} duration={1000} className="flex items-end justify-start lg:justify-end">
                <div className="liquid-glass mt-8 rounded-xl border border-white/20 px-6 py-3 lg:mt-0">
                  <span className="text-lg font-light md:text-xl lg:text-2xl">Investing. Building. Advisory.</span>
                </div>
              </FadeIn>
            </div>
          </div>
        </div>

        {/* Hotspots over the skyline */}
        {scanned &&
        <div className="absolute inset-0">
            {BUILDINGS.map((b, i) =>
          <Hotspot key={b.id} b={b} idx={i} onPick={pick} />
          )}
          </div>
        }
      </div>

      {/* Scan sweep line (above everything, not zoomed) */}
      {sweep && <div className="scan-line" />}
      {sweep &&
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 30%, rgba(120,220,255,0.10), transparent 60%)' }} />
      }

      {/* Instruction toast after scan */}
      <div
        className="pointer-events-none absolute left-1/2 top-24 -translate-x-1/2 text-center transition-all duration-500"
        style={{ opacity: scanned && !zoom ? 1 : 0, transform: `translateX(-50%) translateY(${scanned ? 0 : -8}px)` }}>
        
        <div className="liquid-glass inline-flex items-center gap-2 rounded-full px-5 py-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#bff0ff]" style={{ boxShadow: '0 0 8px 2px rgba(120,220,255,.8)' }}></span>
          <span className="text-sm tracking-tight text-white/90">Scan complete · select a building to enter</span>
        </div>
      </div>

      <style>{`@keyframes fadeInUp{from{opacity:0;transform:translate(-50%,calc(-50% + 10px))}to{opacity:1;transform:translate(-50%,-50%)}}`}</style>
    </div>);

}

window.CityHero = CityHero;