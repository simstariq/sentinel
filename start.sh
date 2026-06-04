#!/usr/bin/env bash
# SENTINEL — Start the backend server
# Usage: ./start.sh

set -e

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║   SENTINEL — AI Security Platform   ║"
echo "  ║   Attack Surface Monitor Backend    ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

cd "$(dirname "$0")/backend"

# Check Python
if ! command -v python3 &>/dev/null; then
  echo "  ✗ Python 3 not found. Please install Python 3.9+"
  exit 1
fi

# Install deps if needed
if ! python3 -c "import fastapi" &>/dev/null; then
  echo "  ► Installing dependencies..."
  pip3 install -r requirements.txt --quiet
  echo "  ✓ Dependencies installed"
fi

echo "  ✓ Starting backend on http://localhost:8000"
echo "  ✓ Open index.html in your browser to use the UI"
echo "  ✓ Press Ctrl+C to stop"
echo ""

python3 server.py
