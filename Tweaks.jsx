/* Sentinel Tweaks panel — sets CSS custom properties on :root so all scenes respond. */
const { useEffect: useEffectTweaks } = React;

const SENTINEL_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "threatLevel": "Clear",
  "atmosphere": "Hazy",
  "typeVoice": "Sans"
}/*EDITMODE-END*/;

const THREAT = {
  Clear:    {
    color: '#78dcff',
    glow:  'rgba(120,220,255,0.9)',
    mid:   'rgba(120,220,255,0.55)',
    soft:  'rgba(120,220,255,0.45)',
    btn:   'linear-gradient(180deg,#cdf3ff,#8fe0ff)',
    btnTxt:'#062430',
  },
  Elevated: {
    color: '#ffd27a',
    glow:  'rgba(255,210,122,0.9)',
    mid:   'rgba(255,210,122,0.55)',
    soft:  'rgba(255,210,122,0.45)',
    btn:   'linear-gradient(180deg,#fff4c0,#ffd060)',
    btnTxt:'#2a1a00',
  },
  Critical: {
    color: '#ff6b80',
    glow:  'rgba(255,107,128,0.9)',
    mid:   'rgba(255,107,128,0.55)',
    soft:  'rgba(255,107,128,0.45)',
    btn:   'linear-gradient(180deg,#ffc0ca,#ff6b80)',
    btnTxt:'#2a0008',
  },
};

const ATMOS = {
  Open: { haze: '0',    noir: '0'    },
  Hazy: { haze: '0.28', noir: '0'    },
  Noir: { haze: '0.08', noir: '0.58' },
};

const FONTS = {
  Sans:  "'Inter', sans-serif",
  Serif: "'Instrument Serif', serif",
  Mono:  "'ui-monospace', 'Courier New', monospace",
};

function TweaksWidget() {
  const [t, setTweak] = useTweaks(SENTINEL_TWEAK_DEFAULTS);

  /* Apply threat-level CSS vars */
  useEffectTweaks(() => {
    const r = document.documentElement;
    const p = THREAT[t.threatLevel] || THREAT.Clear;
    r.style.setProperty('--scan-color',   p.color);
    r.style.setProperty('--scan-glow',    p.glow);
    r.style.setProperty('--scan-mid',     p.mid);
    r.style.setProperty('--scan-soft',    p.soft);
    r.style.setProperty('--scan-btn',     p.btn);
    r.style.setProperty('--scan-btn-txt', p.btnTxt);
  }, [t.threatLevel]);

  /* Apply atmosphere CSS vars */
  useEffectTweaks(() => {
    const r = document.documentElement;
    const a = ATMOS[t.atmosphere] || ATMOS.Hazy;
    r.style.setProperty('--atm-haze', a.haze);
    r.style.setProperty('--atm-noir', a.noir);
  }, [t.atmosphere]);

  /* Apply display font */
  useEffectTweaks(() => {
    document.documentElement.style.setProperty('--display-font', FONTS[t.typeVoice] || FONTS.Sans);
  }, [t.typeVoice]);

  return (
    <TweaksPanel title="Sentinel">
      <TweakSection label="Threat Signal" />
      <TweakRadio
        label="Level"
        value={t.threatLevel}
        options={['Clear', 'Elevated', 'Critical']}
        onChange={(v) => setTweak('threatLevel', v)}
      />
      <TweakSection label="City Feel" />
      <TweakRadio
        label="Atmosphere"
        value={t.atmosphere}
        options={['Open', 'Hazy', 'Noir']}
        onChange={(v) => setTweak('atmosphere', v)}
      />
      <TweakSection label="Typography" />
      <TweakRadio
        label="Type voice"
        value={t.typeVoice}
        options={['Sans', 'Serif', 'Mono']}
        onChange={(v) => setTweak('typeVoice', v)}
      />
    </TweaksPanel>
  );
}

window.TweaksWidget = TweaksWidget;
