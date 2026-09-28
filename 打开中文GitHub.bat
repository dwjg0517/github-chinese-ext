@echo off
chcp 65001 >nul
title GitHub 中文浏览器

REM ============================================================
REM  双击这个就能打开一个「GitHub 自动中文」的浏览器窗口
REM
REM  原理：
REM    这个窗口用的是独立配置目录（D:\github-cn-profile）。
REM    「GitHub 中文化插件」已经在第一次启动时被登记进该配置，
REM    此后正常启动就会自动加载 —— 所以这里**不需要**再带
REM    --load-extension 参数。
REM
REM  与你的日常 Edge 完全隔离：互不影响，不会干扰 DSH 会话。
REM ============================================================

set "PROFILE=D:\github-cn-profile"
set "EDGE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=C:\Program Files\Microsoft\Edge\Application\msedge.exe"

if not exist "%EDGE%" (
  echo [错误] 找不到 Edge
  pause
  exit /b 1
)

if not exist "%PROFILE%\Default" (
  echo [错误] 专用配置不存在：%PROFILE%
  echo        请先运行 D:\BossHelper\启动浏览器（海投+GitHub中文）.bat 一次
  pause
  exit /b 1
)

echo 正在打开 GitHub（中文）...
start "" "%EDGE%" --user-data-dir="%PROFILE%" --new-window "https://github.com"

timeout /t 3 >nul
exit /b 0
