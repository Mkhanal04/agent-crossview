#!/bin/zsh
# Double-click to refresh every number from the logs on this Mac and open Crossview.
# It runs only on this computer and sends nothing anywhere. Close this window to stop it.
cd "$(dirname "$0")"
echo "Refreshing Crossview from your logs (about half a minute)..."
python3 tools/refresh.py || { echo "Something went wrong; the message above says where."; read -k 1; exit 1; }
python3 tools/serve.py --open
