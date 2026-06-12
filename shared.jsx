/* Shared animation primitives — exported to window for cross-file use. */
const { useState, useEffect, useRef } = React;

/* Fade element in after `delay` ms over `duration` ms. */
function FadeIn({ delay = 0, duration = 1000, children, className = '', style = {}, as = 'div' }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  const Tag = as;
  return (
    <Tag
      className={`transition-opacity ${className}`}
      style={{ ...style, opacity: shown ? 1 : 0, transitionDuration: `${duration}ms` }}>
      
      {children}
    </Tag>);

}

/* Character-by-character entrance. Splits by \n into lines, each into chars.
   delay(char) = startDelay + lineIndex*lineLength*charDelay + charIndex*charDelay */
function AnimatedHeading({ text, className = '', style = {}, startDelay = 200, charDelay = 30, duration = 500 }) {
  const [go, setGo] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGo(true), 10);
    return () => clearTimeout(t);
  }, []);
  const lines = text.split('\n');
  return (
    <h1 className={className} style={style}>
      {lines.map((line, li) =>
      <span key={li} className="block">
          {line.split('').map((ch, ci) => {
          const d = startDelay + li * line.length * charDelay + ci * charDelay;
          return (
            <span
              key={ci}
              style={{
                display: 'inline-block',
                opacity: go ? 1 : 0,
                transform: go ? 'translateX(0)' : 'translateX(-18px)',
                transition: `opacity ${duration}ms ease, transform ${duration}ms ease`,
                transitionDelay: `${d}ms`,
                whiteSpace: 'pre'
              }}>
              
                {ch === ' ' ? '\u00A0' : ch}
              </span>);

        })}
        </span>
      )}
    </h1>);

}

/* IntersectionObserver hook: returns [ref, inView, snap].
   `snap` is true when revealed by the safety-net timer (observer never fired) —
   components then apply the visible state with transition:none so it can't freeze
   mid-transition in throttled/background rendering. */
function useInView(margin = '0px') {
  const ref = useRef(null);
  const [state, setState] = useState({ inView: false, snap: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let done = false;
    const obs = new IntersectionObserver(
      ([e]) => {if (e.isIntersecting) {if (!done) {done = true;setState({ inView: true, snap: false });}obs.disconnect();}},
      { rootMargin: margin, threshold: 0.01, root: el.closest('[data-scroll-root]') || null }
    );
    obs.observe(el);
    const t = setTimeout(() => {if (!done) {done = true;setState({ inView: true, snap: true });}}, 1500);
    return () => {obs.disconnect();clearTimeout(t);};
  }, [margin]);
  return [ref, state.inView, state.snap];
}

/* Words slide up (y:20 -> 0) staggered. showAsterisk adds superscript * after final 'a'. */
function WordsPullUp({ text, className = '', wordClass = '', showAsterisk = false, stagger = 0.08, base = 0 }) {
  const [ref, inView, snap] = useInView('-40px');
  const words = text.split(' ');
  return (
    <span ref={ref} className={`inline-flex flex-wrap ${className}`} style={{ overflow: 'visible' }}>
      {words.map((w, i) => {
        const isLast = i === words.length - 1;
        return (
          <span key={i} className="inline-block overflow-hidden" style={{ paddingBottom: '0.06em' }}>
            <span
              className={`inline-block ${wordClass}`}
              style={{
                transform: inView ? 'translateY(0)' : 'translateY(28px)',
                opacity: inView ? 1 : 0,
                transition: snap ? 'none' : 'transform 0.7s cubic-bezier(0.16,1,0.3,1), opacity 0.7s ease',
                transitionDelay: snap ? '0s' : `${base + i * stagger}s`,
                position: 'relative', fontSize: "174px"
              }}>
              
              {w}
              {showAsterisk && isLast &&
              <span style={{ position: 'absolute', top: '0.05em', right: '-0.42em', fontSize: '0.31em' }}>*</span>
              }
              {i < words.length - 1 ? '\u00A0' : ''}
            </span>
          </span>);

      })}
    </span>);

}

/* Multi-style words: segments = [{text, className}] split into words preserving className. */
function WordsPullUpMultiStyle({ segments, className = '', stagger = 0.08, justify = 'justify-center' }) {
  const [ref, inView, snap] = useInView('-40px');
  let idx = 0;
  const flat = [];
  segments.forEach((seg) => {
    seg.text.split(' ').forEach((w) => flat.push({ w, cls: seg.className }));
  });
  return (
    <span ref={ref} className={`inline-flex flex-wrap ${justify} ${className}`}>
      {flat.map((item, i) =>
      <span key={i} className="inline-block overflow-hidden" style={{ paddingBottom: '0.08em' }}>
          <span
          className={`inline-block ${item.cls}`}
          style={{
            transform: inView ? 'translateY(0)' : 'translateY(28px)',
            opacity: inView ? 1 : 0,
            transition: snap ? 'none' : 'transform 0.7s cubic-bezier(0.16,1,0.3,1), opacity 0.7s ease',
            transitionDelay: snap ? '0s' : `${i * stagger}s`
          }}>
          
            {item.w}{'\u00A0'}
          </span>
        </span>
      )}
    </span>);

}

/* Scroll-linked progressive text reveal (chars fade 0.2 -> 1 as the block scrolls through view). */
function ScrollRevealText({ text, className = '', style = {} }) {
  const ref = useRef(null);
  const [prog, setProg] = useState(0);
  useEffect(() => {
    const root = ref.current ? ref.current.closest('[data-scroll-root]') : null;
    const target = root || window;
    const onScroll = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = root ? root.clientHeight : window.innerHeight;
      // start when top hits 0.8 of viewport, end when bottom hits 0.2
      const start = vh * 0.8,end = vh * 0.2;
      const p = (start - rect.top) / (start - end + rect.height);
      setProg(Math.max(0, Math.min(1, p)));
    };
    onScroll();
    target.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {target.removeEventListener('scroll', onScroll);window.removeEventListener('resize', onScroll);};
  }, []);
  const chars = text.split('');
  const total = chars.length;
  return (
    <p ref={ref} className={className} style={style}>
      {chars.map((c, i) => {
        const cp = i / total;
        const local = (prog - (cp - 0.1)) / 0.15;
        const op = 0.2 + 0.8 * Math.max(0, Math.min(1, local));
        return <span key={i} style={{ opacity: op, transition: 'opacity 0.1s linear' }}>{c}</span>;
      })}
    </p>);

}

Object.assign(window, {
  FadeIn, AnimatedHeading, useInView, WordsPullUp, WordsPullUpMultiStyle, ScrollRevealText
});