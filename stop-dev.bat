@echo off
REM 觅源 SeekAll - 停止所有开发服务
echo ====== 停止 SeekAll 服务 ======
REM 精准杀本项目的 node 进程（占用 7300 / 7301 端口的）
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":7301 " ^| findstr LISTENING') do (
    echo kill PID %%P (7301)
    taskkill /F /PID %%P >nul 2>&1
)
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":7300 " ^| findstr LISTENING') do (
    echo kill PID %%P (7300)
    taskkill /F /PID %%P >nul 2>&1
)
echo 服务已停止
pause
