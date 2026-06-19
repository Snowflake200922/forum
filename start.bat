@echo off
cd /d "%~dp0"
echo 论坛已启动：http://localhost:3000
echo 按 Ctrl+C 关闭
echo.
"C:\Users\28491\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" server.js
