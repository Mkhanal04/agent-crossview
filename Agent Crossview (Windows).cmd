@echo off
rem Double-click to refresh every number from the logs on this computer and open Crossview.
rem It runs only on this computer and sends nothing anywhere. Close this window to stop it.
rem Windows doesn't come with Python, so this looks for it the three ways it's usually installed,
rem and checks each is real Python 3.9 or later (Windows has a stand-in "python" that only opens the Store).
cd /d "%~dp0"
set "PY="
py -3 -c "import sys; sys.exit(sys.version_info < (3, 9))" >nul 2>&1 && set "PY=py -3"
if not defined PY python -c "import sys; sys.exit(sys.version_info < (3, 9))" >nul 2>&1 && set "PY=python"
if not defined PY python3 -c "import sys; sys.exit(sys.version_info < (3, 9))" >nul 2>&1 && set "PY=python3"
if not defined PY goto nopython
echo Refreshing Crossview from your logs, which takes about a minute the first time...
%PY% -X utf8 tools\refresh.py
if errorlevel 1 goto failed
%PY% -X utf8 tools\serve.py --open
exit /b 0

:nopython
echo Crossview needs Python 3.9 or later, and Windows doesn't come with it.
echo Get it free from python.org/downloads or from the Microsoft Store, then double-click this file again.
pause
exit /b 1

:failed
echo Something went wrong. The message above says where.
pause
exit /b 1
