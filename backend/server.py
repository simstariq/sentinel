"""
SENTINEL — Attack Surface Monitor Backend
Run: python server.py (or see ../start.sh)
"""

import asyncio
import json
import os
import re
import socket
import ssl
import datetime
import ipaddress
from typing import AsyncGenerator, List
from collections import deque

# In-memory scan history (last 20 scans, resets on server restart)
scan_history: deque = deque(maxlen=20)

import requests
from fastapi import FastAPI, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, HTMLResponse

# ── Optional dependencies (graceful fallback if missing) ──────────────────────
try:
    import whois as whois_lib
    HAS_WHOIS = True
except ImportError:
    HAS_WHOIS = False

try:
    import dns.resolver
    HAS_DNS = True
except ImportError:
    HAS_DNS = False

try:
    import anthropic
    HAS_AI = True
except ImportError:
    HAS_AI = False

# ─────────────────────────────────────────────────────────────────────────────
# CONFIG — set your Anthropic API key here or via environment variable
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
GITHUB_TOKEN      = os.environ.get("GITHUB_TOKEN", "")

ai_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY) if HAS_AI and ANTHROPIC_API_KEY else None

# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(title="SENTINEL ASM Backend", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

COMMON_PORTS = {
    21:    "FTP",
    22:    "SSH",
    23:    "Telnet",
    25:    "SMTP",
    80:    "HTTP",
    443:   "HTTPS",
    3306:  "MySQL",
    5432:  "PostgreSQL",
    6379:  "Redis",
    8080:  "HTTP-Alt",
    8443:  "HTTPS-Alt",
    9200:  "Elasticsearch",
    27017: "MongoDB",
}

COMMON_SUBS = [
    "www", "mail", "api", "dev", "staging", "admin", "app", "blog",
    "shop", "portal", "dashboard", "cdn", "static", "assets", "media",
    "ftp", "smtp", "vpn", "remote", "test", "beta", "docs", "git",
    "auth", "login", "secure", "mx", "ns1", "ns2",
]

# Regex patterns for secret scanning
SECRET_PATTERNS = {
    "AWS Access Key":      r"AKIA[0-9A-Z]{16}",
    "AWS Secret Key":      r"(?i)aws.{0,20}secret.{0,20}['\"][0-9a-zA-Z/+]{40}['\"]",
    "GitHub Token":        r"ghp_[a-zA-Z0-9]{36}",
    "GitHub OAuth":        r"gho_[a-zA-Z0-9]{36}",
    "Stripe Live Key":     r"sk_live_[0-9a-zA-Z]{24,}",
    "Stripe Test Key":     r"sk_test_[0-9a-zA-Z]{24,}",
    "Slack Token":         r"xox[baprs]-[0-9a-zA-Z]{10,}",
    "Generic API Key":     r"(?i)api[_\-]?key[_\-]?\s*[=:]\s*['\"]([a-zA-Z0-9\-_]{20,})['\"]",
    "Password in Code":    r"(?i)password\s*[=:]\s*['\"]([^'\"]{8,})['\"]",
    "Private Key Header":  r"-----BEGIN (RSA |EC )?PRIVATE KEY-----",
    "Google API Key":      r"AIza[0-9A-Za-z\-_]{35}",
    "Heroku API Key":      r"[hH]eroku.{0,20}['\"][0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}['\"]",
}

# (GITHUB_TOKEN and ANTHROPIC_API_KEY are set above)


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def is_ip(target: str) -> bool:
    try:
        ipaddress.ip_address(target)
        return True
    except ValueError:
        return False

def is_github(target: str) -> bool:
    return "github.com" in target.lower()

def extract_domain(target: str) -> str:
    target = re.sub(r"^https?://", "", target)
    return target.split("/")[0].split(":")[0].strip()

def sse_event(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


# ═══════════════════════════════════════════════════════════════════════════════
# SCAN MODULES
# ═══════════════════════════════════════════════════════════════════════════════

async def scan_whois(domain: str) -> dict:
    if not HAS_WHOIS:
        return {"error": "python-whois not installed"}
    try:
        loop = asyncio.get_event_loop()
        w = await loop.run_in_executor(None, whois_lib.whois, domain)
        return {
            "registrar":    str(w.registrar or ""),
            "created":      str(w.creation_date[0] if isinstance(w.creation_date, list) else w.creation_date or ""),
            "expires":      str(w.expiration_date[0] if isinstance(w.expiration_date, list) else w.expiration_date or ""),
            "updated":      str(w.updated_date[0] if isinstance(w.updated_date, list) else w.updated_date or ""),
            "registrant":   str(w.name or w.org or "Privacy Redacted"),
            "nameservers":  [str(ns) for ns in (w.name_servers or [])[:4]],
        }
    except Exception as e:
        return {"error": str(e)}


async def scan_dns(domain: str) -> dict:
    result = {}
    record_types = ["A", "AAAA", "MX", "NS", "TXT", "CNAME"]

    if not HAS_DNS:
        # Fallback: use socket for A records only
        try:
            ips = socket.getaddrinfo(domain, None)
            result["A"] = list({r[4][0] for r in ips})
        except:
            pass
        return result

    loop = asyncio.get_event_loop()
    resolver = dns.resolver.Resolver()
    resolver.timeout = 3
    resolver.lifetime = 5

    for rtype in record_types:
        try:
            answers = await loop.run_in_executor(None, lambda t=rtype: resolver.resolve(domain, t))
            vals = []
            for r in answers:
                if rtype == "MX":
                    vals.append(f"{r.preference} {r.exchange}")
                else:
                    vals.append(str(r))
            result[rtype] = vals
        except:
            pass

    # DNSSEC check
    try:
        answers = await loop.run_in_executor(None, lambda: resolver.resolve(domain, "DNSKEY"))
        result["dnssec"] = True
    except:
        result["dnssec"] = False

    return result


async def scan_ssl(domain: str) -> dict:
    loop = asyncio.get_event_loop()
    try:
        def _check():
            ctx = ssl.create_default_context()
            with ctx.wrap_socket(socket.socket(), server_hostname=domain) as s:
                s.settimeout(5)
                s.connect((domain, 443))
                cert = s.getpeercert()
                cipher = s.cipher()
                proto = s.version()

            subject = dict(x[0] for x in cert.get("subject", []))
            issuer  = dict(x[0] for x in cert.get("issuer", []))
            expiry_str = cert.get("notAfter", "")
            expiry = datetime.datetime.strptime(expiry_str, "%b %d %H:%M:%S %Y %Z")
            days_left = (expiry - datetime.datetime.utcnow()).days

            return {
                "valid":     True,
                "subject":   subject.get("commonName", domain),
                "issuer":    issuer.get("organizationName", "Unknown"),
                "expires":   expiry.strftime("%Y-%m-%d"),
                "days_left": days_left,
                "protocol":  proto,
                "cipher":    cipher[0] if cipher else "Unknown",
            }

        return await loop.run_in_executor(None, _check)
    except ssl.SSLCertVerificationError:
        return {"valid": False, "subject": domain, "issuer": "Unknown", "days_left": 0, "protocol": "Unknown", "cipher": "Unknown"}
    except Exception as e:
        return {"error": str(e)}


async def scan_headers(domain: str) -> dict:
    loop = asyncio.get_event_loop()
    try:
        def _fetch():
            r = requests.get(f"https://{domain}", timeout=8, allow_redirects=True, verify=False)
            return r.headers
        headers = await loop.run_in_executor(None, _fetch)
    except:
        try:
            def _fetch_http():
                r = requests.get(f"http://{domain}", timeout=8, allow_redirects=True)
                return r.headers
            headers = await loop.run_in_executor(None, _fetch_http)
        except Exception as e:
            return {"error": str(e)}

    security_headers = [
        "Strict-Transport-Security",
        "Content-Security-Policy",
        "X-Frame-Options",
        "X-Content-Type-Options",
        "Referrer-Policy",
        "Permissions-Policy",
    ]

    present = [h for h in security_headers if h.lower() in {k.lower(): k for k in headers}]
    all_headers = {k: v[:120] for k, v in list(headers.items())[:15]}

    return {"present": present, "all": all_headers}


async def scan_subdomains(domain: str) -> dict:
    loop = asyncio.get_event_loop()
    found = []

    async def check_sub(sub):
        host = f"{sub}.{domain}"
        try:
            result = await loop.run_in_executor(None, socket.gethostbyname, host)
            found.append({"host": host, "ip": result})
        except:
            pass

    tasks = [check_sub(s) for s in COMMON_SUBS]
    await asyncio.gather(*tasks)
    return {"found": sorted(found, key=lambda x: x["host"])}


async def scan_ports(host: str) -> dict:
    loop = asyncio.get_event_loop()
    results = []

    async def check_port(port, service):
        def _connect():
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(1.2)
            result = s.connect_ex((host, port))
            s.close()
            return result == 0
        try:
            open_ = await loop.run_in_executor(None, _connect)
            results.append({"port": port, "service": service, "state": "open" if open_ else "closed"})
        except:
            results.append({"port": port, "service": service, "state": "closed"})

    tasks = [check_port(p, s) for p, s in COMMON_PORTS.items()]
    await asyncio.gather(*tasks)
    results.sort(key=lambda x: x["port"])
    return {"results": results}


async def scan_github(repo_url: str) -> dict:
    """Scan a GitHub repo for exposed secrets using the GitHub API."""
    match = re.match(r"(?:https?://)?github\.com/([^/]+)/([^/\s]+)", repo_url)
    if not match:
        return {"error": "Invalid GitHub URL"}

    owner, repo = match.group(1), match.group(2).rstrip(".git")
    api_base = "https://api.github.com"
    headers = {"Accept": "application/vnd.github.v3+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"token {GITHUB_TOKEN}"

    loop = asyncio.get_event_loop()
    secrets_found = []

    def _get_tree():
        r = requests.get(f"{api_base}/repos/{owner}/{repo}/git/trees/HEAD?recursive=1",
                         headers=headers, timeout=10)
        return r.json() if r.ok else None

    tree_data = await loop.run_in_executor(None, _get_tree)
    if not tree_data:
        return {"error": "Could not access repository. Check if it's public."}

    # Filter to text-like files worth scanning (skip binaries, limit to 40 files)
    skip_exts = {'.png','.jpg','.jpeg','.gif','.ico','.svg','.pdf','.zip','.tar',
                 '.gz','.mp4','.mp3','.woff','.ttf','.eot','.woff2','.lock'}
    files = [f for f in tree_data.get("tree", [])
             if f.get("type") == "blob"
             and not any(f.get("path","").endswith(e) for e in skip_exts)
             and f.get("size", 0) < 200_000][:40]

    async def scan_file(file_info):
        path = file_info["path"]
        def _fetch():
            r = requests.get(f"{api_base}/repos/{owner}/{repo}/contents/{path}",
                             headers=headers, timeout=8)
            if not r.ok:
                return None
            import base64
            data = r.json()
            if data.get("encoding") == "base64":
                try:
                    return base64.b64decode(data["content"]).decode("utf-8", errors="ignore")
                except:
                    return None
            return None

        content = await loop.run_in_executor(None, _fetch)
        if not content:
            return

        for name, pattern in SECRET_PATTERNS.items():
            matches = list(re.finditer(pattern, content))
            for m in matches[:2]:  # max 2 per pattern per file
                line_num = content[:m.start()].count("\n") + 1
                snippet = m.group(0)[:80] + ("..." if len(m.group(0)) > 80 else "")
                secrets_found.append({
                    "type":    name,
                    "file":    path,
                    "line":    line_num,
                    "snippet": snippet,
                })

    tasks = [scan_file(f) for f in files]
    await asyncio.gather(*tasks)

    return {"secrets": secrets_found, "files_scanned": len(files)}


# ═══════════════════════════════════════════════════════════════════════════════
# ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/ping")
async def ping():
    return {"status": "ok", "version": "1.0.0"}


def compute_findings_from_data(all_data: dict) -> dict:
    """Replicate the frontend severity-counting logic from asm.html."""
    findings = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    ssl_data = all_data.get("ssl", {})
    if ssl_data.get("valid") is False:
        findings["critical"] += 1
    elif ssl_data.get("days_left", 999) < 30:
        findings["medium"] += 1
    proto = ssl_data.get("protocol", "")
    if proto and proto not in ("TLSv1.3", "TLSv1.2"):
        findings["high"] += 1
    SEC_HEADERS = [
        ("strict-transport-security", "high"),
        ("content-security-policy",   "high"),
        ("x-frame-options",           "medium"),
        ("x-content-type-options",    "low"),
        ("referrer-policy",           "low"),
        ("permissions-policy",        "low"),
    ]
    present_lower = [h.lower() for h in all_data.get("headers", {}).get("present", [])]
    for header, sev in SEC_HEADERS:
        if header not in present_lower:
            findings[sev] += 1
    RISKY_PORTS = {21, 23, 3306, 5432, 6379, 27017, 9200, 8080}
    for p in all_data.get("ports", {}).get("results", []):
        if p.get("state") == "open" and p.get("port") in RISKY_PORTS:
            findings["high"] += 1
    if all_data.get("dns", {}).get("dnssec") is False:
        findings["low"] += 1
    findings["critical"] += len(all_data.get("github", {}).get("secrets", []))
    return findings


def compute_score_from_findings(findings: dict) -> int:
    score = (
        findings["critical"] * 25 +
        findings["high"]     * 15 +
        findings["medium"]   *  8 +
        findings["low"]      *  3
    )
    return min(100, score)


@app.get("/scan")
async def scan(target: str):
    """Main scan endpoint — streams SSE events as phases complete."""

    async def generate() -> AsyncGenerator[str, None]:
        target_clean = target.strip()
        github = is_github(target_clean)
        domain = extract_domain(target_clean)
        host   = domain  # for port scanning
        accumulated = {}  # collect phase results for history

        phases = []

        if not github:
            phases = [
                ("whois",   scan_whois(domain)),
                ("dns",     scan_dns(domain)),
                ("ssl",     scan_ssl(domain)),
                ("headers", scan_headers(domain)),
                ("subs",    scan_subdomains(domain)),
                ("ports",   scan_ports(host)),
            ]
        else:
            # GitHub URL — skip domain-specific scans
            phases = [
                ("github", scan_github(target_clean)),
            ]

        for phase_name, coro in phases:
            yield sse_event({"phase": phase_name, "status": "running"})
            await asyncio.sleep(0.1)
            try:
                data = await coro
                accumulated[phase_name] = data
                yield sse_event({"phase": phase_name, "status": "complete", "data": data})
            except Exception as e:
                yield sse_event({"phase": phase_name, "status": "error", "error": str(e)})
            await asyncio.sleep(0.05)

        # Save completed scan to history
        findings = compute_findings_from_data(accumulated)
        score    = compute_score_from_findings(findings)
        scan_history.append({
            "target":    target_clean,
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "findings":  findings,
            "score":     score,
        })

        yield sse_event({"status": "done"})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


# ═══════════════════════════════════════════════════════════════════════════════
# AI ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

PHASE_PROMPTS = {
    "whois": "You are a security analyst. Given this WHOIS data, write 2-3 sharp sentences: note the registrar, registration age, expiry risk, and any privacy concerns. Be direct and technical.",
    "dns":   "You are a security analyst. Given this DNS record data, write 2-3 sentences: comment on the record structure, any missing security records (DMARC, DNSSEC), and what the MX/TXT records reveal about their email stack.",
    "ssl":   "You are a security analyst. Given this SSL/TLS certificate data, write 2-3 sentences: assess cert validity, days until expiry, protocol version risk (TLS 1.0/1.1 is bad), and cipher strength.",
    "headers": "You are a security analyst. Given this HTTP security headers data, write 2-3 sentences: identify which missing headers pose the highest risk (missing HSTS enables downgrade attacks, missing CSP enables XSS), and the overall header security posture.",
    "subs":  "You are a security analyst. Given these discovered subdomains, write 2-3 sentences: identify which subdomains expand the attack surface most (dev/staging/admin are high-value targets), note any IPs that differ from the main domain.",
    "ports": "You are a security analyst. Given these port scan results, write 2-3 sentences: flag any dangerous open ports (MySQL/Redis/MongoDB exposed to internet is critical), explain why each risky port matters, and what an attacker could do with access.",
    "github": "You are a security analyst. Given these GitHub secret scan results, write 2-3 sentences: assess the severity of exposed credentials, what an attacker could do with each type of secret, and the urgency of remediation.",
}


@app.get("/recent-scans")
async def recent_scans(limit: int = 10):
    """Return the last N completed scans, newest first."""
    return {"scans": list(reversed(list(scan_history)))[:limit]}


@app.get("/ai-insight")
async def ai_insight(phase: str, target: str, data: str):
    """Stream a Claude Haiku analysis for a scan phase result."""

    if not ai_client:
        async def no_ai():
            yield "AI analysis unavailable — set ANTHROPIC_API_KEY in your environment."
        return StreamingResponse(no_ai(), media_type="text/plain")

    system_prompt = PHASE_PROMPTS.get(phase, "You are a security analyst. Briefly analyze this scan result in 2-3 sentences.")
    user_msg = f"Target: {target}\n\nScan data:\n{data}"

    async def stream_insight():
        try:
            with ai_client.messages.stream(
                model="claude-haiku-4-5-20251001",
                max_tokens=180,
                system=system_prompt,
                messages=[{"role": "user", "content": user_msg}],
            ) as stream:
                for text in stream.text_stream:
                    yield text
        except Exception as e:
            yield f"[AI error: {str(e)}]"

    return StreamingResponse(
        stream_insight(),
        media_type="text/plain",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/report")
async def generate_report(request: Request):
    """Generate a full professional pentest report from all scan data."""
    body = await request.json()
    target   = body.get("target", "Unknown")
    all_data = body.get("data", {})
    score    = body.get("score", 0)
    findings = body.get("findings", {})

    if not ai_client:
        return HTMLResponse("<h1>AI unavailable — set ANTHROPIC_API_KEY</h1>", status_code=503)

    scan_summary = json.dumps(all_data, indent=2)
    today = datetime.datetime.utcnow().strftime("%B %d, %Y")

    report_prompt = f"""You are a senior penetration tester writing a professional security assessment report.
Target: {target}
Scan Date: {today}
Risk Score: {score}/100
Findings: {findings.get('critical',0)} Critical, {findings.get('high',0)} High, {findings.get('medium',0)} Medium, {findings.get('low',0)} Low

Scan Results (JSON):
{scan_summary}

Write a comprehensive penetration test report with these exact sections, using markdown:

# Executive Summary
(2-3 paragraphs, non-technical language suitable for a CTO or board. State the overall risk, key concerns, and urgency.)

# Scope & Methodology
(Brief description of what was tested and how — passive recon, DNS enumeration, SSL analysis, header inspection, port scanning.)

# Risk Summary
(A markdown table with columns: Finding | Severity | Affected Component | CVSS-like Score)

# Detailed Findings
(For each real finding discovered in the scan data, write a subsection with: Description, Evidence from the scan, Risk/Impact, Recommended Remediation. Sort by severity: Critical → High → Medium → Low.)

# Remediation Roadmap
(Numbered priority list: what to fix immediately, what to fix within 30 days, what to fix within 90 days.)

# Conclusion
(1 paragraph summary and next steps.)

Be specific — reference actual values from the scan data (real IPs, real headers, real ports). Do not make up findings not present in the data."""

    try:
        message = ai_client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=3000,
            messages=[{"role": "user", "content": report_prompt}],
        )
        report_md = message.content[0].text
    except Exception as e:
        return HTMLResponse(f"<h1>Report generation failed: {e}</h1>", status_code=500)

    # Convert markdown to HTML and wrap in beautiful dark report template
    html = render_report_html(target, today, score, findings, report_md)
    return HTMLResponse(html)


def render_report_html(target: str, date: str, score: int, findings: dict, md_content: str) -> str:
    """Render the AI-generated markdown report as a beautiful HTML page."""
    import re as _re

    # Simple markdown → HTML conversion
    html_body = md_content
    # Headers
    html_body = _re.sub(r"^# (.+)$",    r"<h1>\1</h1>",    html_body, flags=_re.MULTILINE)
    html_body = _re.sub(r"^## (.+)$",   r"<h2>\1</h2>",   html_body, flags=_re.MULTILINE)
    html_body = _re.sub(r"^### (.+)$",  r"<h3>\1</h3>",  html_body, flags=_re.MULTILINE)
    # Bold
    html_body = _re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", html_body)
    # Markdown table → HTML table
    def convert_table(match):
        lines = [l.strip() for l in match.group(0).strip().split("\n") if l.strip() and not _re.match(r"^\|[-| :]+\|$", l.strip())]
        rows = []
        for i, line in enumerate(lines):
            cells = [c.strip() for c in line.strip("|").split("|")]
            tag = "th" if i == 0 else "td"
            row = "".join(f"<{tag}>{c}</{tag}>" for c in cells)
            rows.append(f"<tr>{row}</tr>")
        return f"<table><thead>{rows[0]}</thead><tbody>{''.join(rows[1:])}</tbody></table>"
    html_body = _re.sub(r"(\|.+\|\n)+", convert_table, html_body)
    # Numbered lists
    html_body = _re.sub(r"((?:^\d+\. .+\n?)+)", lambda m: "<ol>" + _re.sub(r"^\d+\. (.+)$", r"<li>\1</li>", m.group(0), flags=_re.MULTILINE) + "</ol>", html_body, flags=_re.MULTILINE)
    # Bullet lists
    html_body = _re.sub(r"((?:^[-*] .+\n?)+)", lambda m: "<ul>" + _re.sub(r"^[-*] (.+)$", r"<li>\1</li>", m.group(0), flags=_re.MULTILINE) + "</ul>", html_body, flags=_re.MULTILINE)
    # Inline code
    html_body = _re.sub(r"`(.+?)`", r"<code>\1</code>", html_body)
    # Paragraphs (lines not already wrapped in block tags)
    lines_out = []
    for line in html_body.split("\n"):
        stripped = line.strip()
        if stripped and not stripped.startswith("<"):
            lines_out.append(f"<p>{stripped}</p>")
        else:
            lines_out.append(line)
    html_body = "\n".join(lines_out)

    score_color = "#ff4d6a" if score >= 80 else "#ff8c42" if score >= 60 else "#ffd166" if score >= 35 else "#06d6a0"
    level = "CRITICAL" if score >= 80 else "HIGH" if score >= 60 else "MEDIUM" if score >= 35 else "LOW"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Security Assessment — {target}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500&family=JetBrains+Mono:wght@300;400&display=swap" rel="stylesheet">
<style>
  *{{margin:0;padding:0;box-sizing:border-box}}
  body{{background:#080a0e;color:rgba(255,255,255,0.85);font-family:'Inter',sans-serif;font-size:14px;line-height:1.8;}}
  a{{color:#4da6ff;}}
  .cover{{background:linear-gradient(160deg,#0b0e18 0%,#080a0e 60%);border-bottom:1px solid rgba(77,166,255,0.1);padding:80px 80px 60px;}}
  .cover-label{{font-size:9px;letter-spacing:8px;color:rgba(77,166,255,0.5);text-transform:uppercase;margin-bottom:24px;}}
  .cover h1{{font-size:32px;font-weight:200;letter-spacing:1px;margin-bottom:8px;}}
  .cover-target{{font-family:'JetBrains Mono',monospace;font-size:14px;color:#4da6ff;margin-bottom:40px;}}
  .cover-meta{{display:flex;gap:60px;}}
  .meta-item label{{font-size:8px;letter-spacing:4px;text-transform:uppercase;color:rgba(255,255,255,0.25);display:block;margin-bottom:6px;}}
  .meta-item .val{{font-family:'JetBrains Mono',monospace;font-size:13px;}}
  .risk-badge{{display:inline-block;padding:4px 14px;border:1px solid;font-size:9px;letter-spacing:4px;text-transform:uppercase;font-family:'JetBrains Mono',monospace;color:{score_color};border-color:{score_color};}}
  .content{{max-width:820px;margin:0 auto;padding:60px 80px;}}
  h1{{font-size:22px;font-weight:300;color:rgba(255,255,255,0.9);margin:48px 0 16px;padding-bottom:12px;border-bottom:1px solid rgba(77,166,255,0.15);letter-spacing:0.5px;}}
  h1:first-child{{margin-top:0;}}
  h2{{font-size:15px;font-weight:400;color:#4da6ff;margin:32px 0 12px;letter-spacing:1px;}}
  h3{{font-size:13px;font-weight:400;color:rgba(255,255,255,0.7);margin:24px 0 8px;text-transform:uppercase;letter-spacing:2px;font-size:11px;}}
  p{{color:rgba(255,255,255,0.65);margin-bottom:14px;font-weight:300;}}
  strong{{color:rgba(255,255,255,0.9);font-weight:500;}}
  code{{font-family:'JetBrains Mono',monospace;font-size:12px;background:rgba(77,166,255,0.08);border:1px solid rgba(77,166,255,0.15);padding:2px 7px;color:#4da6ff;}}
  table{{width:100%;border-collapse:collapse;margin:20px 0;font-size:12px;}}
  th{{background:rgba(77,166,255,0.08);color:rgba(255,255,255,0.6);font-weight:400;letter-spacing:2px;font-size:9px;text-transform:uppercase;padding:10px 14px;text-align:left;border-bottom:1px solid rgba(77,166,255,0.2);}}
  td{{padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05);color:rgba(255,255,255,0.65);vertical-align:top;}}
  tr:last-child td{{border-bottom:none;}}
  ul,ol{{padding-left:24px;margin:12px 0 18px;}}
  li{{color:rgba(255,255,255,0.65);margin-bottom:6px;font-weight:300;}}
  .print-btn{{position:fixed;bottom:32px;right:32px;background:rgba(77,166,255,0.1);border:1px solid rgba(77,166,255,0.3);color:#4da6ff;padding:12px 24px;font-family:'Inter',sans-serif;font-size:9px;letter-spacing:5px;text-transform:uppercase;cursor:pointer;transition:all 0.3s;}}
  .print-btn:hover{{background:rgba(77,166,255,0.2);}}
  @media print{{.print-btn{{display:none}}body{{background:#fff;color:#000}}}}
  body::after{{content:'';position:fixed;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.01) 2px,rgba(0,0,0,0.01) 4px);pointer-events:none;z-index:9999;}}
</style>
</head>
<body>
<div class="cover">
  <div class="cover-label">Sentinel AI — Security Assessment Report</div>
  <h1>Attack Surface Analysis</h1>
  <div class="cover-target">{target}</div>
  <div class="cover-meta">
    <div class="meta-item"><label>Date</label><span class="val">{date}</span></div>
    <div class="meta-item"><label>Risk Score</label><span class="val" style="color:{score_color}">{score} / 100</span></div>
    <div class="meta-item"><label>Risk Level</label><span class="risk-badge">{level}</span></div>
    <div class="meta-item"><label>Findings</label><span class="val">{findings.get('critical',0)}C · {findings.get('high',0)}H · {findings.get('medium',0)}M · {findings.get('low',0)}L</span></div>
  </div>
</div>
<div class="content">
{html_body}
</div>
<button class="print-btn" onclick="window.print()">⎙ Print / Save PDF</button>
</body>
</html>"""


# ═══════════════════════════════════════════════════════════════════════════════
# ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════════
# ═══════════════════════════════════════════════════════════════════════════════
# SECRET SCANNER ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

def scan_content_for_secrets(content: str, filename: str) -> list:
    """Scan a string of content for secret patterns. Returns list of findings."""
    findings = []
    for secret_type, pattern in SECRET_PATTERNS.items():
        for m in re.finditer(pattern, content, re.IGNORECASE if "(?i)" not in pattern else 0):
            line_num = content[:m.start()].count("\n") + 1
            raw = m.group(0)
            # Redact middle portion for display
            if len(raw) > 12:
                snippet = raw[:6] + "•" * min(len(raw) - 10, 20) + raw[-4:]
            else:
                snippet = raw[:4] + "••••"
            findings.append({
                "type":     secret_type,
                "file":     filename,
                "line":     line_num,
                "snippet":  snippet,
                "raw_len":  len(raw),
                "severity": _secret_severity(secret_type),
            })
    return findings


def _secret_severity(secret_type: str) -> str:
    critical = {"AWS Access Key", "AWS Secret Key", "Stripe Live Key", "Private Key Header", "GitHub Token", "GitHub OAuth"}
    high     = {"Google API Key", "Heroku API Key", "Slack Token"}
    if secret_type in critical: return "critical"
    if secret_type in high:     return "high"
    return "medium"


@app.post("/secrets/upload")
async def secrets_upload(files: List[UploadFile] = File(...)):
    """Scan uploaded files for secrets."""
    all_findings = []
    files_scanned = []
    for f in files:
        raw = await f.read()
        text = raw.decode("utf-8", errors="ignore")
        findings = scan_content_for_secrets(text, f.filename or "unknown")
        all_findings.extend(findings)
        files_scanned.append(f.filename)
    # Sort by severity
    sev_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    all_findings.sort(key=lambda x: sev_order.get(x["severity"], 4))
    return {"secrets": all_findings, "files_scanned": files_scanned}


@app.get("/secrets/github")
async def secrets_github(repo_url: str):
    """Scan a GitHub repo for secrets (reuses scan_github logic with richer output)."""
    data = await scan_github(repo_url)
    # Enrich with severity if not already present
    for s in data.get("secrets", []):
        if "severity" not in s:
            s["severity"] = _secret_severity(s.get("type", ""))
    sev_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    data["secrets"] = sorted(data.get("secrets", []), key=lambda x: sev_order.get(x.get("severity","medium"), 2))
    return data


@app.get("/secrets/insight")
async def secrets_insight(secret_type: str, filename: str, snippet: str):
    """Stream a Claude Haiku explanation for a specific secret finding."""
    if not ai_client:
        async def no_ai():
            yield "AI unavailable — set ANTHROPIC_API_KEY."
        return StreamingResponse(no_ai(), media_type="text/plain")

    prompt = f"""You are a security analyst. A secret was found in a codebase.

Secret type: {secret_type}
Found in file: {filename}
Redacted value: {snippet}

Write exactly 3 sentences:
1. What this credential is and what system/service it grants access to.
2. What an attacker could do if they obtained this secret right now.
3. How urgently it must be rotated and where to do it (be specific, e.g. "AWS IAM console → Security credentials").

Be direct and technical. No markdown, no bullet points."""

    async def stream():
        try:
            with ai_client.messages.stream(
                model="claude-haiku-4-5-20251001",
                max_tokens=160,
                messages=[{"role": "user", "content": prompt}],
            ) as s:
                for text in s.text_stream:
                    yield text
        except Exception as e:
            yield f"[AI error: {e}]"

    return StreamingResponse(stream(), media_type="text/plain",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.post("/secrets/report")
async def secrets_report(request: Request):
    """Generate a full secret exposure report with Claude Sonnet."""
    body    = await request.json()
    target  = body.get("target", "Unknown")
    secrets = body.get("secrets", [])
    source  = body.get("source", "unknown")
    today   = datetime.datetime.utcnow().strftime("%B %d, %Y")

    if not ai_client:
        return HTMLResponse("<h1>AI unavailable — set ANTHROPIC_API_KEY</h1>", status_code=503)

    counts = {"critical": 0, "high": 0, "medium": 0}
    for s in secrets:
        sev = s.get("severity", "medium")
        counts[sev] = counts.get(sev, 0) + 1

    secrets_json = json.dumps(secrets, indent=2)
    prompt = f"""You are a senior security engineer writing a Secret Exposure Incident Report.

Source scanned: {target} ({source})
Date: {today}
Secrets found: {len(secrets)} total — {counts.get('critical',0)} Critical, {counts.get('high',0)} High, {counts.get('medium',0)} Medium

Exposed secrets (JSON):
{secrets_json}

Write a professional incident report in markdown with these exact sections:

# Incident Summary
(2 paragraphs: what was found, overall severity, and business risk in plain language for a CTO.)

# Exposure Inventory
(Markdown table: Secret Type | File | Line | Severity | Immediate Action Required)

# Impact Analysis
(For each unique secret type found, one paragraph: what access it grants, realistic attack scenarios, potential data/financial exposure.)

# Remediation Steps
(Numbered, prioritized list. For each secret: exact steps to rotate it with the specific console/service URL. Start with Critical findings.)

# Prevention Recommendations
(5 bullet points: concrete steps to prevent future secret exposure — pre-commit hooks, secret scanning CI, vault adoption, etc.)

# Conclusion
(Brief paragraph: timeline recommendation for remediation.)

Reference actual filenames and line numbers from the data. Be specific and actionable."""

    try:
        msg = ai_client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=3000,
            messages=[{"role": "user", "content": prompt}],
        )
        report_md = msg.content[0].text
    except Exception as e:
        return HTMLResponse(f"<h1>Report failed: {e}</h1>", status_code=500)

    html = _render_secrets_report(target, today, counts, len(secrets), report_md)
    return HTMLResponse(html)


def _render_secrets_report(target, date, counts, total, md_content):
    import re as _re

    html_body = md_content
    html_body = _re.sub(r"^# (.+)$",   r"<h1>\1</h1>",  html_body, flags=_re.MULTILINE)
    html_body = _re.sub(r"^## (.+)$",  r"<h2>\1</h2>",  html_body, flags=_re.MULTILINE)
    html_body = _re.sub(r"^### (.+)$", r"<h3>\1</h3>",  html_body, flags=_re.MULTILINE)
    html_body = _re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", html_body)
    html_body = _re.sub(r"`(.+?)`", r"<code>\1</code>", html_body)

    def convert_table(match):
        lines = [l.strip() for l in match.group(0).strip().split("\n")
                 if l.strip() and not _re.match(r"^\|[-| :]+\|$", l.strip())]
        rows = []
        for i, line in enumerate(lines):
            cells = [c.strip() for c in line.strip("|").split("|")]
            tag = "th" if i == 0 else "td"
            rows.append("<tr>" + "".join(f"<{tag}>{c}</{tag}>" for c in cells) + "</tr>")
        return f"<table><thead>{rows[0]}</thead><tbody>{''.join(rows[1:])}</tbody></table>"
    html_body = _re.sub(r"(\|.+\|\n)+", convert_table, html_body)

    html_body = _re.sub(r"((?:^\d+\. .+\n?)+)",
        lambda m: "<ol>" + _re.sub(r"^\d+\. (.+)$", r"<li>\1</li>", m.group(0), flags=_re.MULTILINE) + "</ol>",
        html_body, flags=_re.MULTILINE)
    html_body = _re.sub(r"((?:^[-*] .+\n?)+)",
        lambda m: "<ul>" + _re.sub(r"^[-*] (.+)$", r"<li>\1</li>", m.group(0), flags=_re.MULTILINE) + "</ul>",
        html_body, flags=_re.MULTILINE)

    lines_out = []
    for line in html_body.split("\n"):
        s = line.strip()
        if s and not s.startswith("<"):
            lines_out.append(f"<p>{s}</p>")
        else:
            lines_out.append(line)
    html_body = "\n".join(lines_out)

    sev_color = "#ff4d6a" if counts.get("critical",0) > 0 else "#ff8c42" if counts.get("high",0) > 0 else "#ffd166"
    level = "CRITICAL" if counts.get("critical",0) > 0 else "HIGH" if counts.get("high",0) > 0 else "MEDIUM"

    return f"""<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Secret Exposure Report — {target}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500&family=JetBrains+Mono:wght@300;400&display=swap" rel="stylesheet">
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{background:#080a0e;color:rgba(255,255,255,0.82);font-family:'Inter',sans-serif;font-size:14px;line-height:1.8}}
.cover{{background:linear-gradient(160deg,#0e080e 0%,#080a0e 60%);border-bottom:1px solid rgba(255,77,106,0.15);padding:80px 80px 60px}}
.cover-label{{font-size:9px;letter-spacing:8px;color:rgba(255,77,106,0.5);text-transform:uppercase;margin-bottom:24px}}
.cover h1{{font-size:32px;font-weight:200;letter-spacing:1px;margin-bottom:8px}}
.cover-target{{font-family:'JetBrains Mono',monospace;font-size:14px;color:#ff4d6a;margin-bottom:40px}}
.cover-meta{{display:flex;gap:60px}}
.meta-item label{{font-size:8px;letter-spacing:4px;text-transform:uppercase;color:rgba(255,255,255,0.25);display:block;margin-bottom:6px}}
.meta-item .val{{font-family:'JetBrains Mono',monospace;font-size:13px}}
.risk-badge{{display:inline-block;padding:4px 14px;border:1px solid;font-size:9px;letter-spacing:4px;text-transform:uppercase;font-family:'JetBrains Mono',monospace;color:{sev_color};border-color:{sev_color}}}
.content{{max-width:820px;margin:0 auto;padding:60px 80px}}
h1{{font-size:22px;font-weight:300;color:rgba(255,255,255,0.9);margin:48px 0 16px;padding-bottom:12px;border-bottom:1px solid rgba(255,77,106,0.15);letter-spacing:.5px}}
h1:first-child{{margin-top:0}}
h2{{font-size:15px;font-weight:400;color:#ff4d6a;margin:32px 0 12px;letter-spacing:1px}}
h3{{font-size:11px;font-weight:400;color:rgba(255,255,255,0.5);margin:20px 0 8px;text-transform:uppercase;letter-spacing:2px}}
p{{color:rgba(255,255,255,0.62);margin-bottom:14px;font-weight:300}}
strong{{color:rgba(255,255,255,0.9);font-weight:500}}
code{{font-family:'JetBrains Mono',monospace;font-size:12px;background:rgba(255,77,106,0.08);border:1px solid rgba(255,77,106,0.2);padding:2px 7px;color:#ff4d6a}}
table{{width:100%;border-collapse:collapse;margin:20px 0;font-size:12px}}
th{{background:rgba(255,77,106,0.08);color:rgba(255,255,255,0.5);font-weight:400;letter-spacing:2px;font-size:9px;text-transform:uppercase;padding:10px 14px;text-align:left;border-bottom:1px solid rgba(255,77,106,0.2)}}
td{{padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05);color:rgba(255,255,255,0.62);vertical-align:top}}
tr:last-child td{{border-bottom:none}}
ul,ol{{padding-left:24px;margin:12px 0 18px}}
li{{color:rgba(255,255,255,0.62);margin-bottom:6px;font-weight:300}}
.print-btn{{position:fixed;bottom:32px;right:32px;background:rgba(255,77,106,0.1);border:1px solid rgba(255,77,106,0.3);color:#ff4d6a;padding:12px 24px;font-family:'Inter',sans-serif;font-size:9px;letter-spacing:5px;text-transform:uppercase;cursor:pointer;transition:all .3s}}
.print-btn:hover{{background:rgba(255,77,106,0.2)}}
body::after{{content:'';position:fixed;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.012) 2px,rgba(0,0,0,.012) 4px);pointer-events:none;z-index:9999}}
@media print{{.print-btn{{display:none}}}}
</style></head><body>
<div class="cover">
  <div class="cover-label">Sentinel AI — Secret Exposure Report</div>
  <h1>Credential Exposure Analysis</h1>
  <div class="cover-target">{target}</div>
  <div class="cover-meta">
    <div class="meta-item"><label>Date</label><span class="val">{date}</span></div>
    <div class="meta-item"><label>Secrets Found</label><span class="val" style="color:{sev_color}">{total}</span></div>
    <div class="meta-item"><label>Severity</label><span class="risk-badge">{level}</span></div>
    <div class="meta-item"><label>Breakdown</label><span class="val">{counts.get('critical',0)}C · {counts.get('high',0)}H · {counts.get('medium',0)}M</span></div>
  </div>
</div>
<div class="content">{html_body}</div>
<button class="print-btn" onclick="window.print()">⎙ Print / Save PDF</button>
</body></html>"""


# ═══════════════════════════════════════════════════════════════════════════════
# ATTACK PROBABILITY ENDPOINT
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/asm/attack-probability")
async def attack_probability(request: Request):
    """Use Claude to determine the most likely attack vector from scan findings."""
    body      = await request.json()
    target    = body.get("target", "unknown")
    findings  = body.get("findings", {})
    scan_data = body.get("scan_data", {})

    if not ai_client:
        return {"error": "AI unavailable"}

    scan_summary = json.dumps({
        "findings_count": findings,
        "ssl":     scan_data.get("ssl", {}),
        "headers": scan_data.get("headers", {}),
        "ports":   scan_data.get("ports", {}),
        "subs":    scan_data.get("subs", {}),
        "dns":     scan_data.get("dns", {}),
    }, indent=2)[:1200]

    prompt = f"""You are a threat intelligence analyst. Based on this attack surface scan of {target}, determine the single most likely attack a real-world attacker would execute.

Scan findings:
{scan_summary}

Respond with ONLY valid JSON, no markdown, no extra text:
{{
  "attack_name": "the specific attack name (e.g. Man-in-the-Middle Attack, Cross-Site Scripting, SQL Injection, Credential Brute Force, Subdomain Takeover, SSL Stripping, Clickjacking, DNS Hijacking, Port-Based Intrusion, Social Engineering)",
  "attack_key": "one of: mitm, xss, sqli, bruteforce, subdomain, sslstrip, clickjacking, dns, portintrusion, social",
  "probability": <integer 55-95>,
  "short_reason": "one sentence — the specific finding that makes this the most likely attack",
  "explanation": "2-3 sentences explaining what this attack is, exactly how an attacker would execute it against this specific target based on the findings, and what data or access they would gain."
}}

Pick the attack that is most directly enabled by the findings. Be specific to the actual vulnerabilities found."""

    try:
        msg = ai_client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = msg.content[0].text.strip()
        # Strip any accidental markdown fences
        raw = re.sub(r"^```json?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        return json.loads(raw)
    except Exception as e:
        return {"error": str(e)}


# ═══════════════════════════════════════════════════════════════════════════════
# AI CHAT ENDPOINT
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/ai/chat")
async def ai_chat(request: Request):
    """Stream a Claude response for the floating AI assistant."""
    body    = await request.json()
    message = body.get("message", "")
    history = body.get("history", [])
    system  = body.get("system", "You are SENTINEL, an expert AI security analyst. Give direct, technical, actionable security advice with code examples.")

    if not ai_client:
        async def no_ai():
            yield "AI unavailable — set ANTHROPIC_API_KEY and restart the backend."
        return StreamingResponse(no_ai(), media_type="text/plain")

    # Build messages list
    msgs = [{"role": m["role"], "content": m["content"]}
            for m in history if m.get("role") in ("user","assistant") and m.get("content")]
    msgs.append({"role": "user", "content": message})

    async def stream():
        try:
            with ai_client.messages.stream(
                model="claude-sonnet-4-6",
                max_tokens=600,
                system=system,
                messages=msgs,
            ) as s:
                for text in s.text_stream:
                    yield text
        except Exception as e:
            yield f"\n[Error: {e}]"

    return StreamingResponse(stream(), media_type="text/plain",
                             headers={"Cache-Control":"no-cache","X-Accel-Buffering":"no"})


# ═══════════════════════════════════════════════════════════════════════════════
# CVE STACK CHECKER ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

ECOSYSTEM_HINTS = {
    # npm
    "express":"npm","react":"npm","vue":"npm","angular":"npm","lodash":"npm",
    "axios":"npm","webpack":"npm","next":"npm","typescript":"npm","moment":"npm",
    "jquery":"npm","socket.io":"npm","nodemailer":"npm","bcrypt":"npm",
    "jsonwebtoken":"npm","passport":"npm","helmet":"npm","multer":"npm",
    "node-fetch":"npm","minimist":"npm","tar":"npm","semver":"npm",
    "ejs":"npm","handlebars":"npm","pug":"npm","marked":"npm",
    # PyPI
    "django":"PyPI","flask":"PyPI","requests":"PyPI","numpy":"PyPI",
    "pandas":"PyPI","pillow":"PyPI","sqlalchemy":"PyPI","fastapi":"PyPI",
    "celery":"PyPI","boto3":"PyPI","paramiko":"PyPI","cryptography":"PyPI",
    "jinja2":"PyPI","pyyaml":"PyPI","urllib3":"PyPI","werkzeug":"PyPI",
    "aiohttp":"PyPI","httpx":"PyPI","starlette":"PyPI","uvicorn":"PyPI",
    # RubyGems
    "rails":"RubyGems","devise":"RubyGems","nokogiri":"RubyGems","sinatra":"RubyGems",
    # Maven (common artifact IDs)
    "log4j-core":"Maven","log4j":"Maven","commons-text":"Maven",
    "jackson-databind":"Maven","spring-core":"Maven","struts2-core":"Maven",
    # Go
    "gin-gonic/gin":"Go","labstack/echo":"Go","gofiber/fiber":"Go",
    # crates.io
    "tokio":"crates.io","serde":"crates.io","actix-web":"crates.io","hyper":"crates.io",
}

INFRA_PACKAGES = {"nginx","apache","openssl","openssh","php","mysql","postgresql",
                  "redis","mongodb","elasticsearch","tomcat","iis","lighttpd"}


def parse_dep_file(filename: str, content: str) -> list:
    """Parse a dependency file → [{name, version, ecosystem}]"""
    packages = []
    fname = filename.lower()

    if fname.endswith("package.json"):
        try:
            data = json.loads(content)
            for key in ["dependencies","devDependencies","peerDependencies"]:
                for name, ver in data.get(key, {}).items():
                    v = re.sub(r"^[^0-9]*", "", str(ver)).split(" ")[0].split("-")[0]
                    if v and re.match(r"\d", v):
                        packages.append({"name": name, "version": v, "ecosystem": "npm"})
        except: pass

    elif "requirements" in fname or (fname.endswith(".txt") and "req" in fname):
        for line in content.splitlines():
            line = line.strip()
            if not line or line.startswith(("#","-","git+")): continue
            m = re.match(r"^([A-Za-z0-9_\-\.]+)\s*[>=<!~^]+\s*([0-9][0-9a-zA-Z._\-]*)", line)
            if m: packages.append({"name": m.group(1), "version": m.group(2), "ecosystem": "PyPI"})

    elif "gemfile.lock" in fname:
        for line in content.splitlines():
            m = re.match(r"^    ([a-z][a-z0-9_\-]+) \(([0-9][^)]*)\)", line)
            if m: packages.append({"name": m.group(1), "version": m.group(2), "ecosystem": "RubyGems"})

    elif fname.endswith("go.mod") or fname == "go.mod":
        for line in content.splitlines():
            m = re.match(r"^\s+([^\s]+)\s+v([0-9][^\s]*)", line)
            if m: packages.append({"name": m.group(1), "version": m.group(2), "ecosystem": "Go"})

    elif fname.endswith("cargo.toml"):
        for line in content.splitlines():
            m = re.match(r'^([a-z][a-z0-9_\-]+)\s*=\s*["\']([0-9][^"\']*)["\']', line)
            if m: packages.append({"name": m.group(1), "version": m.group(2), "ecosystem": "crates.io"})

    elif fname.endswith("composer.json"):
        try:
            data = json.loads(content)
            for name, ver in data.get("require", {}).items():
                if name.startswith("php"): continue
                v = re.sub(r"^[^0-9]*", "", str(ver)).split(" ")[0]
                if v and re.match(r"\d", v):
                    packages.append({"name": name, "version": v, "ecosystem": "Packagist"})
        except: pass

    elif fname.endswith("pom.xml"):
        versions = re.findall(
            r"<artifactId>([^<]+)</artifactId>\s*(?:<[^/].*?>\s*)*?<version>([0-9][^<]*)</version>",
            content, re.DOTALL
        )
        for name, ver in versions[:30]:
            packages.append({"name": name.strip(), "version": ver.strip(), "ecosystem": "Maven"})

    return packages[:60]


def _score_from_osv(vuln: dict) -> float:
    """Extract a numeric CVSS score from an OSV vulnerability entry."""
    # Try database_specific first
    db = vuln.get("database_specific", {})
    if isinstance(db, dict):
        for k in ("cvss_score","cvss","score","base_score"):
            if k in db:
                try: return float(db[k])
                except: pass
        sev = str(db.get("severity","")).upper()
        if sev == "CRITICAL": return 9.5
        if sev == "HIGH":     return 7.5
        if sev == "MEDIUM":   return 5.0
        if sev == "LOW":      return 2.0

    # Try severity CVSS vector (extract numerical score if embedded)
    for s in vuln.get("severity", []):
        score_str = s.get("score","")
        # Sometimes score is just a number
        try: return float(score_str)
        except: pass
        # Sometimes CVSS vector has /Score: embedded (non-standard)
        m = re.search(r"(\d+\.\d+)$", score_str)
        if m:
            try: return float(m.group(1))
            except: pass

    # Fallback: count impact keywords
    summary = (vuln.get("summary","") + vuln.get("details","")).lower()
    if any(w in summary for w in ["remote code","rce","arbitrary code","critical"]): return 9.0
    if any(w in summary for w in ["sql injection","xss","privilege","authentication bypass"]): return 7.5
    if any(w in summary for w in ["denial of service","dos","redirect","open redirect"]): return 5.0
    return 4.0


def _format_osv_vulns(vulns: list, pkg_name: str, pkg_version: str) -> list:
    out = []
    for v in vulns:
        score = _score_from_osv(v)
        sev = ("critical" if score >= 9.0 else
               "high"     if score >= 7.0 else
               "medium"   if score >= 4.0 else "low")

        cve_ids = [a for a in v.get("aliases", []) if a.startswith("CVE-")]
        cve_id  = cve_ids[0] if cve_ids else v.get("id","")

        fixed = None
        for affected in v.get("affected", []):
            for r in affected.get("ranges", []):
                for event in r.get("events", []):
                    if "fixed" in event:
                        fixed = event["fixed"]; break
                if fixed: break
            if fixed: break

        out.append({
            "id":        cve_id or v.get("id",""),
            "osv_id":    v.get("id",""),
            "summary":   (v.get("summary","") or v.get("details","No description.")[:200])[:200],
            "score":     round(score, 1),
            "severity":  sev,
            "fixed_in":  fixed,
            "published": v.get("published","")[:10],
            "nvd_url":   f"https://nvd.nist.gov/vuln/detail/{cve_id}" if cve_id.startswith("CVE-") else None,
            "package":   pkg_name,
            "version":   pkg_version,
        })
    out.sort(key=lambda x: x["score"], reverse=True)
    return out[:8]  # top 8 per package


async def osv_batch_query(packages: list) -> dict:
    """Query OSV batch endpoint. Returns {pkg_key: {package, vulns}}"""
    if not packages: return {}

    queries = []
    for p in packages:
        eco = p.get("ecosystem") or ECOSYSTEM_HINTS.get(p["name"].lower())
        if not eco:
            eco = "npm"  # best-guess default
        queries.append({"package": {"name": p["name"], "ecosystem": eco}, "version": p["version"]})

    loop = asyncio.get_event_loop()
    def _call():
        try:
            r = requests.post("https://api.osv.dev/v1/querybatch",
                              json={"queries": queries}, timeout=20)
            return r.json().get("results",[]) if r.ok else []
        except: return []

    results = await loop.run_in_executor(None, _call)

    output = {}
    for i, result in enumerate(results):
        vulns = result.get("vulns",[])
        if vulns:
            p   = packages[i]
            eco = queries[i]["package"]["ecosystem"]
            key = f"{p['name']}@{p['version']}"
            output[key] = {
                "package":   {"name": p["name"], "version": p["version"], "ecosystem": eco},
                "vulns":     _format_osv_vulns(vulns, p["name"], p["version"]),
            }
    return output


def _parse_manual_entry(text: str) -> list:
    """Parse manual text like 'django 3.2, express 4.18.0' into package list."""
    packages = []
    for item in re.split(r"[,\n]+", text):
        item = item.strip()
        if not item: continue
        # Match "name version" or "name==version" or "name@version"
        m = re.match(r"^([A-Za-z0-9_\-\./]+)[\s@=:]+([0-9][0-9a-zA-Z._\-]*)$", item)
        if m:
            name, ver = m.group(1).strip(), m.group(2).strip()
            eco = ECOSYSTEM_HINTS.get(name.lower())
            if name.lower() in INFRA_PACKAGES:
                eco = None  # will use NVD/keyword search
            packages.append({"name": name, "version": ver, "ecosystem": eco})
    return packages


@app.post("/cve/scan")
async def cve_scan(request: Request):
    """Scan a list of packages for CVEs via OSV."""
    body     = await request.json()
    packages = body.get("packages", [])
    if not packages:
        return {"results": {}, "total_cves": 0, "packages_scanned": 0}

    results  = await osv_batch_query(packages)
    total    = sum(len(v["vulns"]) for v in results.values())
    return {"results": results, "total_cves": total, "packages_scanned": len(packages)}


@app.post("/cve/parse-file")
async def cve_parse_file(files: List[UploadFile] = File(...)):
    """Parse an uploaded dependency file and return detected packages."""
    all_packages = []
    for f in files:
        raw  = await f.read()
        text = raw.decode("utf-8", errors="ignore")
        pkgs = parse_dep_file(f.filename or "", text)
        all_packages.extend(pkgs)
    return {"packages": all_packages, "count": len(all_packages)}


@app.get("/cve/insight")
async def cve_insight(cve_id: str, package: str, version: str, summary: str, score: float):
    """Stream a Claude Haiku explanation for a specific CVE."""
    if not ai_client:
        async def no_ai(): yield "AI unavailable — set ANTHROPIC_API_KEY."
        return StreamingResponse(no_ai(), media_type="text/plain")

    prompt = f"""You are a senior security engineer. A CVE was found in a developer's dependency.

CVE: {cve_id}
Affected package: {package} version {version}
CVSS Score: {score}
Description: {summary}

Write exactly 3 sentences — no markdown, no bullet points:
1. What this vulnerability is and the specific attack scenario (how an attacker would exploit it).
2. What impact successful exploitation has — what data or systems are at risk.
3. The exact remediation: the specific version to upgrade to, or the mitigation to apply if no patch exists."""

    async def stream():
        try:
            with ai_client.messages.stream(
                model="claude-haiku-4-5-20251001",
                max_tokens=170,
                messages=[{"role":"user","content":prompt}],
            ) as s:
                for text in s.text_stream: yield text
        except Exception as e: yield f"[AI error: {e}]"

    return StreamingResponse(stream(), media_type="text/plain",
                             headers={"Cache-Control":"no-cache","X-Accel-Buffering":"no"})


@app.post("/cve/report")
async def cve_report(request: Request):
    """Generate a full CVE triage report with Claude Sonnet."""
    body    = await request.json()
    stack   = body.get("stack_label","Unknown Stack")
    results = body.get("results", {})
    today   = datetime.datetime.utcnow().strftime("%B %d, %Y")

    if not ai_client:
        return HTMLResponse("<h1>AI unavailable — set ANTHROPIC_API_KEY</h1>", status_code=503)

    all_cves = []
    for pkg_data in results.values():
        for v in pkg_data.get("vulns",[]):
            all_cves.append(v)
    all_cves.sort(key=lambda x: x["score"], reverse=True)

    counts = {"critical":0,"high":0,"medium":0,"low":0}
    for c in all_cves: counts[c["severity"]] = counts.get(c["severity"],0) + 1

    prompt = f"""You are a senior security engineer writing a CVE Triage Report for a development team.

Stack: {stack}
Date: {today}
Total CVEs: {len(all_cves)} — {counts['critical']} Critical, {counts['high']} High, {counts['medium']} Medium, {counts['low']} Low

All CVEs found (JSON):
{json.dumps(all_cves, indent=2)[:3000]}

Write a professional triage report in markdown:

# Executive Summary
(2 paragraphs: overall vulnerability posture, highest risks, business impact of not patching.)

# Critical & High Priority Fixes
(For each critical/high CVE: package, CVE ID, what it does, exact upgrade command — e.g. `npm install express@4.19.0` or `pip install django==4.2.1`. Be specific.)

# Medium & Low Priority
(Brief table: CVE ID | Package | Current | Fix Version | Notes)

# Upgrade Commands
(Ready-to-run terminal commands to fix all vulnerabilities grouped by package manager — npm, pip, gem, cargo, etc.)

# Prevention Recommendations
(5 specific recommendations: automated CVE scanning in CI, dependency pinning, Dependabot/Renovate setup, etc.)

Be specific, use actual CVE IDs and version numbers from the data."""

    try:
        msg = ai_client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=3000,
            messages=[{"role":"user","content":prompt}],
        )
        md = msg.content[0].text
    except Exception as e:
        return HTMLResponse(f"<h1>Report failed: {e}</h1>", status_code=500)

    html = _render_cve_report(stack, today, counts, len(all_cves), md)
    return HTMLResponse(html)


def _render_cve_report(stack, date, counts, total, md_content):
    import re as _re
    body = md_content
    body = _re.sub(r"^# (.+)$",   r"<h1>\1</h1>",  body, flags=_re.MULTILINE)
    body = _re.sub(r"^## (.+)$",  r"<h2>\1</h2>",  body, flags=_re.MULTILINE)
    body = _re.sub(r"^### (.+)$", r"<h3>\1</h3>",  body, flags=_re.MULTILINE)
    body = _re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", body)
    body = _re.sub(r"`(.+?)`", r"<code>\1</code>", body)
    def tbl(m):
        lines = [l.strip() for l in m.group(0).strip().split("\n") if l.strip() and not _re.match(r"^\|[-| :]+\|$",l.strip())]
        rows=[]
        for i,line in enumerate(lines):
            cells=[c.strip() for c in line.strip("|").split("|")]
            tag="th" if i==0 else "td"
            rows.append("<tr>"+"".join(f"<{tag}>{c}</{tag}>" for c in cells)+"</tr>")
        return f"<table><thead>{rows[0]}</thead><tbody>{''.join(rows[1:])}</tbody></table>"
    body = _re.sub(r"(\|.+\|\n)+", tbl, body)
    body = _re.sub(r"((?:^\d+\. .+\n?)+)",lambda m:"<ol>"+_re.sub(r"^\d+\. (.+)$",r"<li>\1</li>",m.group(0),flags=_re.MULTILINE)+"</ol>",body,flags=_re.MULTILINE)
    body = _re.sub(r"((?:^[-*] .+\n?)+)",lambda m:"<ul>"+_re.sub(r"^[-*] (.+)$",r"<li>\1</li>",m.group(0),flags=_re.MULTILINE)+"</ul>",body,flags=_re.MULTILINE)
    lines_out=[]
    for line in body.split("\n"):
        s=line.strip()
        lines_out.append(f"<p>{s}</p>" if s and not s.startswith("<") else line)
    body="\n".join(lines_out)
    sev_color="#ff4d6a" if counts.get("critical",0)>0 else "#ff8c42" if counts.get("high",0)>0 else "#ffd166"
    level="CRITICAL" if counts.get("critical",0)>0 else "HIGH" if counts.get("high",0)>0 else "MEDIUM"
    return f"""<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><title>CVE Triage — {stack}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500&family=JetBrains+Mono:wght@300;400&display=swap" rel="stylesheet">
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{background:#080a0e;color:rgba(255,255,255,0.82);font-family:'Inter',sans-serif;font-size:14px;line-height:1.8}}
.cover{{background:linear-gradient(160deg,#0c0e08 0%,#080a0e 60%);border-bottom:1px solid rgba(240,165,0,0.12);padding:80px 80px 60px}}
.cover-label{{font-size:9px;letter-spacing:8px;color:rgba(240,165,0,0.5);text-transform:uppercase;margin-bottom:24px}}
.cover h1{{font-size:32px;font-weight:200;letter-spacing:1px;margin-bottom:8px}}
.cover-target{{font-family:'JetBrains Mono',monospace;font-size:14px;color:#f0a500;margin-bottom:40px}}
.cover-meta{{display:flex;gap:60px}}
.meta-item label{{font-size:8px;letter-spacing:4px;text-transform:uppercase;color:rgba(255,255,255,0.22);display:block;margin-bottom:6px}}
.meta-item .val{{font-family:'JetBrains Mono',monospace;font-size:13px}}
.risk-badge{{display:inline-block;padding:4px 14px;border:1px solid;font-size:9px;letter-spacing:4px;text-transform:uppercase;font-family:'JetBrains Mono',monospace;color:{sev_color};border-color:{sev_color}}}
.content{{max-width:820px;margin:0 auto;padding:60px 80px}}
h1{{font-size:22px;font-weight:300;color:rgba(255,255,255,.9);margin:48px 0 16px;padding-bottom:12px;border-bottom:1px solid rgba(240,165,0,0.12)}}
h1:first-child{{margin-top:0}}
h2{{font-size:15px;font-weight:400;color:#f0a500;margin:32px 0 12px;letter-spacing:1px}}
h3{{font-size:11px;font-weight:400;color:rgba(255,255,255,.5);margin:20px 0 8px;text-transform:uppercase;letter-spacing:2px}}
p{{color:rgba(255,255,255,.62);margin-bottom:14px;font-weight:300}}
strong{{color:rgba(255,255,255,.9);font-weight:500}}
code{{font-family:'JetBrains Mono',monospace;font-size:12px;background:rgba(240,165,0,0.08);border:1px solid rgba(240,165,0,0.2);padding:2px 7px;color:#f0a500}}
table{{width:100%;border-collapse:collapse;margin:20px 0;font-size:12px}}
th{{background:rgba(240,165,0,0.07);color:rgba(255,255,255,.5);font-weight:400;letter-spacing:2px;font-size:9px;text-transform:uppercase;padding:10px 14px;text-align:left;border-bottom:1px solid rgba(240,165,0,0.18)}}
td{{padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.05);color:rgba(255,255,255,.62);vertical-align:top}}
tr:last-child td{{border-bottom:none}}
ul,ol{{padding-left:24px;margin:12px 0 18px}}
li{{color:rgba(255,255,255,.62);margin-bottom:6px;font-weight:300}}
.print-btn{{position:fixed;bottom:32px;right:32px;background:rgba(240,165,0,0.08);border:1px solid rgba(240,165,0,0.3);color:#f0a500;padding:12px 24px;font-family:'Inter',sans-serif;font-size:9px;letter-spacing:5px;text-transform:uppercase;cursor:pointer;transition:all .3s}}
.print-btn:hover{{background:rgba(240,165,0,0.15)}}
body::after{{content:'';position:fixed;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.012) 2px,rgba(0,0,0,.012) 4px);pointer-events:none;z-index:9999}}
@media print{{.print-btn{{display:none}}}}
</style></head><body>
<div class="cover">
  <div class="cover-label">Sentinel AI — CVE Triage Report</div>
  <h1>Dependency Vulnerability Analysis</h1>
  <div class="cover-target">{stack}</div>
  <div class="cover-meta">
    <div class="meta-item"><label>Date</label><span class="val">{date}</span></div>
    <div class="meta-item"><label>Total CVEs</label><span class="val" style="color:{sev_color}">{total}</span></div>
    <div class="meta-item"><label>Severity</label><span class="risk-badge">{level}</span></div>
    <div class="meta-item"><label>Breakdown</label><span class="val">{counts.get('critical',0)}C · {counts.get('high',0)}H · {counts.get('medium',0)}M · {counts.get('low',0)}L</span></div>
  </div>
</div>
<div class="content">{body}</div>
<button class="print-btn" onclick="window.print()">⎙ Print / Save PDF</button>
</body></html>"""


# ═══════════════════════════════════════════════════════════════════════════════
# ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    dev  = os.environ.get("RAILWAY_ENVIRONMENT") is None
    print("\n  SENTINEL Backend — Attack Surface Monitor")
    print(f"  Running on http://0.0.0.0:{port}\n")
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=dev)
