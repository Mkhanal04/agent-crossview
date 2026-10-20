#!/bin/zsh
# Double-click to refresh every number from the logs on this Mac and open Crossview.
# It runs only on this computer and sends nothing anywhere. Close this window to stop it.
cd "$(dirname "$0")"
echo "Opening Crossview in your browser. It reads your newest records while you watch."
python3 tools/serve.py --open --refresh || { echo "Something went wrong; the message above says where."; read -k 1; exit 1; }
