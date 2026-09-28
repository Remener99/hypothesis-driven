#!/usr/bin/env bash
# Запуск HypoLab: при необходимости ставит зависимости и собирает фронтенд.
set -e
cd "$(dirname "$0")"
if [ ! -d node_modules/express ] || [ ! -d node_modules/vite ]; then
  echo "→ Устанавливаю зависимости..."; npm install --no-audit --no-fund
fi
if [ ! -f webapp/index.html ] || [ -n "$(find src shared index.html -newer webapp/index.html -print -quit)" ]; then
  echo "→ Собираю фронтенд..."; npx vite build
fi
echo "→ Запускаю сервер на порту ${PORT:-3001}"
exec node server/index.js
