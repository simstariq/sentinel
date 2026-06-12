/* Scene 3 — "Prisma" creative-studio landing page (Hero / About / Features), per spec. */
const { useState: useStatePr, useEffect: useEffectPr, useRef: useRefPr } = React;

const PRISMA_HERO_VIDEO = "https://res.cloudinary.com/dcytepiva/video/upload/v1780992288/Guy_typing_on_computer_202606082141_yszxca.mp4?_s=public-apps";
const FEATURE_VIDEO = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260406_133058_0504132a-0cf3-4450-a370-8ea3b05c95d4.mp4";
const ICON1 = "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260405_171918_4a5edc79-d78f-4637-ac8b-53c43c220606.png&w=1280&q=85";
const ICON2 = "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260405_171741_ed9845ab-f5b2-4018-8ce7-07cc01823522.png&w=1280&q=85";
const ICON3 = "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260405_171809_f56666dc-c099-4778-ad82-9ad4f209567b.png&w=1280&q=85";

const PRIMARY = '#E1E0CC';

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
      <path d="M20 6L9 17l-5-5" />
    </svg>);

}
function ArrowRight({ rotate = 0, size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: `rotate(${rotate}deg)` }}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>);

}

function PrismaNav() {
  const items = ['Our story', 'Collective', 'Workshops', 'Programs', 'Inquiries'];
  const [hover, setHover] = useStatePr(-1);
  return (
    <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2">
      <nav className="flex items-center gap-3 rounded-b-2xl bg-black px-4 py-2 sm:gap-6 md:gap-12 md:rounded-b-3xl md:px-8 lg:gap-14">
        {items.map((it, i) =>
        <a
          key={it} href="#"
          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(-1)}
          className="whitespace-nowrap text-[10px] transition-colors sm:text-xs md:text-sm"
          style={{ color: hover === i ? PRIMARY : 'rgba(225,224,204,0.8)' }}>
          {it}</a>
        )}
      </nav>
    </div>);

}

function PrismaHero() {
  return (
    <section className="p-4 md:p-6">
      <div className="relative h-[100svh] max-h-[1100px] min-h-[560px] overflow-hidden rounded-2xl md:rounded-[2rem]">
        <video className="absolute inset-0 h-full w-full object-cover" src={PRISMA_HERO_VIDEO} autoPlay loop muted playsInline />
        <div className="noise-overlay pointer-events-none absolute inset-0 opacity-[0.7] mix-blend-overlay" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />

        <PrismaNav />

        {/* bottom content */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-6 md:px-8 md:pb-8">
          <div className="grid grid-cols-12 items-end gap-4">
            <div className="col-span-12 lg:col-span-8">
              <div className="font-medium leading-[0.85] tracking-[-0.07em] text-[26vw] sm:text-[24vw] md:text-[22vw] lg:text-[20vw] xl:text-[19vw]" style={{ color: PRIMARY }}>
                <WordsPullUp text="Attack Surface Monitor" stagger={0.08} />
              </div>
            </div>
            <div className="col-span-12 lg:col-span-4 lg:pb-6">
              <FadeIn delay={500} duration={900}>
                <p className="text-xs leading-[1.2] text-primary/70 sm:text-sm md:text-base">
                  Prisma is a worldwide network of visual artists, filmmakers and storytellers bound not by place, status or labels but by passion and hunger to unlock potential through our unique perspectives.
                </p>
              </FadeIn>
              <FadeIn delay={700} duration={900}>
                <button className="group mt-5 inline-flex items-center gap-2 rounded-full py-1.5 pl-5 pr-1.5 text-sm font-medium text-black transition-all hover:gap-3 sm:text-base" style={{ background: PRIMARY }}>
                  Join the lab
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black transition-transform group-hover:scale-110 sm:h-10 sm:w-10">
                    <ArrowRight color={PRIMARY} />
                  </span>
                </button>
              </FadeIn>
            </div>
          </div>
        </div>
      </div>
    </section>);

}

function PrismaAbout() {
  return (
    <section className="bg-black px-4 py-20 md:px-6 md:py-28">
      <div className="mx-auto max-w-6xl rounded-2xl bg-[#101010] px-6 py-16 text-center md:px-12 md:py-24 md:rounded-[2rem]">
        <div className="mb-6 text-[10px] uppercase tracking-[0.3em] text-primary sm:text-xs">ASM</div>
        <div className="mx-auto max-w-3xl text-3xl leading-[0.95] sm:text-4xl sm:leading-[0.9] md:text-5xl lg:text-6xl xl:text-7xl" style={{ color: PRIMARY }}>
          <WordsPullUpMultiStyle
            segments={[
            { text: 'A truly sophisicated tool,', className: 'font-normal' },
            { text: 'a self-taught director.', className: 'italic font-serif' },
            { text: 'I have skills in color grading, visual effects, and narrative design.', className: 'font-normal' }]
            }
            stagger={0.06} />
          
        </div>
        <div className="mx-auto mt-10 max-w-2xl">
          <ScrollRevealText
            text="Over the last seven years, I have worked with Parallax, a Berlin-based production house that crafts cinema, series, and Noir Studio in Paris. Together, we have created work that has earned international acclaim at several major festivals."
            className="text-xs leading-relaxed sm:text-sm md:text-base"
            style={{ color: '#DEDBC8' }} />
          
        </div>
      </div>
    </section>);

}

function FeatureCard({ idx, children, className = '', style = {} }) {
  const [ref, inView, snap] = useInView('-80px');
  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...style,
        transition: snap ? 'none' : 'transform .7s cubic-bezier(.22,1,.36,1), opacity .7s ease',
        transitionDelay: snap ? '0s' : `${idx * 0.15}s`,
        transform: inView ? 'scale(1)' : 'scale(0.95)',
        opacity: inView ? 1 : 0
      }}>
      
      {children}
    </div>);

}

function ChecklistCard({ idx, num, title, icon, items }) {
  return (
    <FeatureCard idx={idx} className="flex flex-col rounded-2xl bg-[#212121] p-5 md:p-6">
      <div className="flex items-start justify-between">
        <div className="h-10 w-10 overflow-hidden rounded-lg bg-black/40 sm:h-12 sm:w-12">
          <img src={icon} alt="" className="h-full w-full object-cover" loading="lazy" />
        </div>
        <span className="text-xs tracking-widest text-gray-500">{num}</span>
      </div>
      <h3 className="mt-5 text-xl font-normal md:text-2xl" style={{ color: PRIMARY }}>{title}</h3>
      <ul className="mt-4 flex-1 space-y-2.5">
        {items.map((it, i) =>
        <li key={i} className="flex gap-2.5">
            <CheckIcon />
            <span className="text-[13px] leading-snug text-gray-400">{it}</span>
          </li>
        )}
      </ul>
      <a href="#" className="group mt-6 inline-flex items-center gap-1.5 text-sm" style={{ color: PRIMARY }}>
        Learn more
        <span className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"><ArrowRight rotate={-45} size={15} /></span>
      </a>
    </FeatureCard>);

}

function PrismaFeatures() {
  return (
    <section className="relative min-h-screen bg-black px-4 py-20 md:px-6 md:py-28">
      <div className="bg-noise pointer-events-none absolute inset-0 opacity-[0.15]" />
      <div className="relative mx-auto max-w-7xl">
        <div className="mb-12 max-w-3xl text-xl font-normal sm:text-2xl md:text-3xl lg:text-4xl">
          <WordsPullUpMultiStyle
            justify="justify-start"
            segments={[
            { text: 'Studio-grade workflows for visionary creators.', className: 'text-primary' },
            { text: 'Built for pure vision. Powered by art.', className: 'text-gray-500' }]
            }
            stagger={0.05} />
          
        </div>

        <div className="grid grid-cols-1 gap-3 sm:gap-2 md:grid-cols-2 md:gap-2 lg:h-[480px] lg:grid-cols-4 lg:gap-2.5">
          {/* Card 1 — video */}
          <FeatureCard idx={0} className="relative overflow-hidden rounded-2xl bg-[#212121]" style={{ minHeight: 300 }}>
            <video className="absolute inset-0 h-full w-full object-cover" src={FEATURE_VIDEO} autoPlay loop muted playsInline />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 p-5 md:p-6">
              <span className="text-lg font-normal md:text-xl" style={{ color: PRIMARY }}>Your creative canvas.</span>
            </div>
          </FeatureCard>

          <ChecklistCard idx={1} num="01" title="Project Storyboard." icon={ICON1}
          items={['Auto-sequenced shot lists', 'Frame-accurate timing', 'Reusable scene templates', 'Shareable review links']} />
          <ChecklistCard idx={2} num="02" title="Smart Critiques." icon={ICON2}
          items={['AI shot-by-shot analysis', 'Director-grade creative notes', 'Plugs into your existing tools']} />
          <ChecklistCard idx={3} num="03" title="Immersion Capsule." icon={ICON3}
          items={['Notification silencing', 'Ambient soundscapes', 'Calendar schedule syncing']} />
        </div>
      </div>
    </section>);

}

function Prisma({ onBack }) {
  return (
    <div data-scroll-root className="scene overflow-y-auto overflow-x-hidden bg-black font-almarai" style={{ fontFamily: 'Almarai, sans-serif' }}>
      <button
        onClick={onBack}
        className="liquid-glass fixed left-5 top-5 z-50 flex items-center gap-2 rounded-full px-4 py-2 text-xs text-white/85 transition-colors hover:text-white">
        
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        City
      </button>
      <PrismaHero />
      <PrismaAbout />
      <PrismaFeatures />
      <footer className="bg-black px-6 py-12 text-center text-xs text-gray-600">
        Prisma — rebuilt by Claude after the scan. © 2026
      </footer>
    </div>);

}

window.Prisma = Prisma;