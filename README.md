# SENTINEL — AI Security Platform

An all-in-one AI-powered security reconnaissance platform built to scan, analyze, and explain attack surfaces in real time.

![SENTINEL](https://img.shields.io/badge/AI-Powered-blue) ![Python](https://img.shields.io/badge/Python-3.9+-green) ![Claude](https://img.shields.io/badge/Claude-Haiku%20%7C%20Sonnet-purple)

---

## Modules

| Module | Description |
|--------|-------------|
| **Attack Surface Monitor** | Real-time recon — domains, ports, SSL, HTTP headers, subdomains |
| **Secret Scanner** | Detect exposed API keys & credentials in GitHub repos or uploaded files |
| **CVE Stack Checker** | Cross-reference your tech stack against the OSV vulnerability database |
| **NOVA AI Assistant** | Context-aware AI chat that knows your scan results and gives fix commands |

---

## Features

- Animated particle sphere intro with disintegrate transition
- Live scanning with real-time phase updates
- AI inline insights per scan result (Claude Haiku)
- AI-generated pentest & exposure reports (Claude Sonnet)
- Attack Probability analysis — identifies the most likely attack vector
- NOVA floating AI assistant on every page
- Full demo mode — works without a backend

---

## Quick Start

**1. Clone the repo**
```bash
git clone https://github.com/YOUR_USERNAME/sentinel.git
cd sentinel
```

**2. Start the backend**
```bash
ANTHROPIC_API_KEY=your-key-here ./start.sh
```

**3. Open the frontend**

Double-click `index.html` or open it in your browser. The frontend auto-detects whether the backend is running.

---

## Stack

- **Frontend** — Vanilla HTML/CSS/JS, Three.js
- **Backend** — Python, FastAPI, Uvicorn
- **AI** — Anthropic Claude API (Haiku + Sonnet)
- **CVE Data** — OSV.dev (free, no key needed)
- **DNS/SSL** — dnspython, Python ssl module
- **WHOIS** — python-whois

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | For AI features | Your Anthropic API key |
| `GITHUB_TOKEN` | Optional | Higher rate limits for GitHub scanning |

---

## Project Structure

```
sentinel/
├── index.html          # Intro / module selection
├── asm.html            # Attack Surface Monitor
├── secrets.html        # Secret Scanner
├── cve.html            # CVE Stack Checker
├── ai-assistant.js     # NOVA floating AI orb (shared)
├── start.sh            # One-command backend launcher
└── backend/
    ├── server.py       # FastAPI backend
    └── requirements.txt
```

---

Built by Tariq Sims
