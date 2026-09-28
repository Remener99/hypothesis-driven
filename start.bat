@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js не найден. Установите его с https://nodejs.org ^(версия LTS^) и запустите файл снова. & pause & exit /b 1)
if not exist node_modules\express (
  echo Устанавливаю зависимости, это займёт 1-3 минуты...
  call npm install --no-audit --no-fund || (pause & exit /b 1)
)
if not exist webapp\index.html (
  echo Собираю интерфейс...
  call npx vite build || (pause & exit /b 1)
)
echo.
echo Откройте в браузере: http://localhost:3001
echo Логин: demo@hypolab.ru   Пароль: demo1234
echo Чтобы остановить сервер, закройте это окно.
echo.
start "" http://localhost:3001
node server\index.js
pause
