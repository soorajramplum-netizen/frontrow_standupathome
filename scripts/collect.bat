@echo off
title Crowdwork transcripts
cd /d "%~dp0.."
set PYTHONIOENCODING=utf-8
"D:\YT Transcripts\yt-transcripts\.venv\Scripts\python.exe" -u scripts\collect.py
pause
