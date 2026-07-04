@echo off
cd /d "%~dp0"
start "leadflow-api" cmd /k "npm run dev:api"
start "leadflow-web" cmd /k "npm run dev:web"
