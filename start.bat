@echo off
rem Double-click to open MeowQuest at http://localhost:5173 (close this window to stop it)
cd /d "%~dp0"
set "NODE=node"
where node >nul 2>nul || set "NODE=C:\Program Files\nodejs\node.exe"
start "" http://localhost:5173
"%NODE%" serve.mjs
