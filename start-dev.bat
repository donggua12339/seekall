@echo off
REM 觅源 SeekAll - 一键启动开发环境（Windows 后台模式）
REM 用法：双击运行 或 cmd /c start-dev.bat
setlocal

set "ROOT=%~dp0"
echo ====== 觅源 SeekAll 开发环境启动 ======
echo.

REM 1. 杀掉旧进程
echo [1/3] 清理旧进程...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq SeekAll*" >nul 2>&1
REM 用端口精准定位本项目的 node 进程，避免误杀其他项目
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":7301 " ^| findstr LISTENING') do (
    taskkill /F /PID %%P >nul 2>&1
)
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":7300 " ^| findstr LISTENING') do (
    taskkill /F /PID %%P >nul 2>&1
)

REM 2. 启动后端（PowerShell Start-Process 可靠处理含空格路径）
echo [2/3] 启动后端 (7301)...
if not exist "%ROOT%apps\api\dist\main.js" (
    echo   构建 dist...
    pushd "%ROOT%apps\api"
    call npx nest build
    popd
)
powershell -NoProfile -Command "Start-Process -FilePath 'node' -ArgumentList '\"%ROOT%apps\api\dist\main.js\"' -WorkingDirectory '%ROOT%apps\api' -WindowStyle Hidden -RedirectStandardOutput '%ROOT%apps\api\api.out.log' -RedirectStandardError '%ROOT%apps\api\api.err.log'

REM 3. 启动前端
echo [3/3] 启动前端 (7300)...
powershell -NoProfile -Command "Start-Process -FilePath 'cmd' -ArgumentList '/c','npx nuxt dev --port 7300' -WorkingDirectory '%ROOT%apps\web' -WindowStyle Hidden -RedirectStandardOutput '%ROOT%nuxt.out.log' -RedirectStandardError '%ROOT%nuxt.err.log'"

echo.
echo ====== 启动完成 ======
echo 等待编译（约 20-30 秒）...
echo.
echo 后端日志: apps\api\api.out.log / api.err.log
echo 前端日志: nuxt.out.log / nuxt.err.log
echo.
echo 访问: http://localhost:7300/
echo 健康: http://localhost:7301/api/v1/health
echo.
echo 停止服务: stop-dev.bat
echo.

REM 等待 10 秒后检查端口
timeout /t 10 /nobreak >nul
echo [检查端口]
netstat -ano | findstr ":7300 " | findstr LISTENING >nul && echo   7300 前端: OK || echo   7300 前端: 等待编译...
netstat -ano | findstr ":7301 " | findstr LISTENING >nul && echo   7301 后端: OK || echo   7301 后端: 启动中...

endlocal
