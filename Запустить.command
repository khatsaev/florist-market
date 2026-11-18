#!/bin/zsh
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo 'Установите Node.js 22.13 или новее, затем повторите запуск.'
  read -r '?Нажмите Enter, чтобы закрыть окно.'
  exit 1
fi
if [ ! -d node_modules ]; then
  npm ci
fi
npm run build
echo 'Откройте http://127.0.0.1:4173 в браузере. Для остановки нажмите Ctrl+C.'
npm start
