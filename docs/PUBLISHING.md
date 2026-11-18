# GitHub и интернет-демо

- Репозиторий: https://github.com/khatsaev/florist-market
- Демо: https://khatsaev.github.io/florist-market/
- Ветка исходников: `main`.
- Ветка статической сборки: `gh-pages`, корень `/`, файл `.nojekyll`.

GitHub Pages обслуживает только HTML/CSS/JS/WebAssembly. Поэтому здесь опубликован браузерный режим с IndexedDB, а не Express/SQLite-сервер. У каждого посетителя отдельная тестовая база, созданная при первом открытии. Между устройствами изменения не синхронизируются. Реальных платежей, фискальных чеков и регламентированного бухучёта нет.

## Обновление

1. В актуальной копии `main` выполните `npm ci`, `npm run build`, `npm test`, `npm run test:wasm`.
2. Соберите демо командой `npm run build:demo` и проверьте через `npm run preview:demo -- --port 4180` по пути `/florist-market/`.
3. Сохраните исходники в `main`.
4. В отдельной рабочей копии ветки `gh-pages` замените файлы содержимым `dist/`, добавьте `.nojekyll` и лицензионные уведомления, сохраните коммит и отправьте ветку.
5. Дождитесь успешного задания `pages build and deployment` и проверьте опубликованный URL.

Для другого имени репозитория задайте `VITE_BASE_PATH=/имя-репозитория/` при сборке и обновите ссылки. Для корня домена — `VITE_BASE_PATH=/`.

Исходники не содержат токенов GitHub. Рабочие SQLite-файлы, резервные копии, `.env` и `node_modules` исключены из Git. Не загружайте их вручную. Публикация нового сервера с реальными данными требует отдельной настройки доступа и резервного копирования.

Первичные справочники: [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [sql.js](https://github.com/sql-js/sql.js).
