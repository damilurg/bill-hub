# Развёртывание и обслуживание

## Конфигурация

Сначала выполните `scripts/setup.mjs` как в README. Он создаёт `.env` с правами `0600`, случайным паролем, scrypt-хэшем и ключом сессий. Не добавляйте `.env`, базу или бэкапы в Git. Docker-образ не содержит этих файлов. Запускайте один контейнер приложения на один локальный SQLite volume; сетевые файловые системы и несколько реплик не поддерживаются.

| Параметр                   | Назначение                                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `APP_URL`                  | Полный внешний origin, например `https://bills.example.com`, без подпути. Используется для проверки Origin и Secure-cookie. |
| `ADMIN_USERNAME`           | Логин владельца, по умолчанию `admin`. Смена логина не меняет владельца данных.                                             |
| `ADMIN_PASSWORD_HASH`      | Scrypt-хэш; генерируется setup, обычный пароль здесь не хранится.                                                           |
| `SESSION_SECRET`           | Случайный секрет подписи cookie. Его смена завершает все сессии.                                                            |
| `LIVE_SUBMISSIONS_ENABLED` | `false` по умолчанию. `true` разрешает подтверждённую пользователем передачу газа.                                          |
| `DATABASE_PATH`            | В Docker: `/data/bill-hub.sqlite`. При локальном запуске: `./data/bill-hub.sqlite`.                                         |
| `PORT`                     | Порт внутри контейнера, по умолчанию `3000`. Обычно менять не нужно.                                                        |

Переменные читаются во время запуска; сборка образа не требует секретов. После изменения `.env` контейнер необходимо **пересоздать**, простой `docker restart` не перечитывает `--env-file`.

Cookie HttpOnly, SameSite=Strict, срок 7 дней. При `APP_URL=https://…` cookie дополнительно Secure. Выход удаляет cookie в текущем браузере; для отзыва всех выданных cookie смените `SESSION_SECRET`. Лимит входа: 8 попыток за 15 минут на весь экземпляр; сбрасывается после успешного входа или рестарта. Дополнительный лимит Nginx защищает от потока запросов до проверки пароля.

## Сервер с Nginx и HTTPS

1. Направьте DNS домена на сервер. Установите Docker, Nginx и получите TLS-сертификат своим обычным способом (например, Certbot).
2. Создайте `.env` с `--url https://bills.example.com`.
3. Соберите и запустите контейнер командами из README. Порт приложения опубликован только на `127.0.0.1:3000`.
4. Скопируйте [nginx.conf.example](nginx.conf.example) в конфигурацию Nginx, замените домен и пути сертификата. Файл предназначен для включения внутри секции `http`, как обычный `/etc/nginx/conf.d/bill-hub.conf`.
5. Выполните `sudo nginx -t`, затем `sudo systemctl reload nginx`. Откройте `https://bills.example.com`.

Nginx принимает HTTPS на 443 и перенаправляет HTTP с 80. Контейнеру нужен исходящий HTTPS-доступ к `www.gazprom.kg` и `api.gazprom.kg` для передачи газа. Дополнительный публичный порт базы данных не нужен.

Для доступа к домашнему серверу через SSH без публичного домена оставьте `APP_URL=http://localhost:3000` и используйте `ssh -L 3000:127.0.0.1:3000 user@server`, затем откройте localhost в браузере.

## Проверка состояния

```bash
docker ps --filter name=bill-hub
docker inspect --format '{{.State.Health.Status}}' bill-hub
docker logs --tail 100 bill-hub
curl --fail http://127.0.0.1:3000/api/health
```

Healthcheck проверяет доступность HTTP и таблицы SQLite. При `403` на сохранении сравните `APP_URL` с адресом браузера. При `401` войдите заново. При ошибке прав на bind mount выдайте каталогу данных uid/gid `1000:1000`; named volume из README получает права из образа автоматически.

## Бэкап

Создаётся через SQLite Online Backup API: учитывает уже записанные данные в WAL и допускает работающий контейнер. Копирование одного активного `.sqlite` обычным `cp` не заменяет этот способ.

```bash
docker exec bill-hub node scripts/backup.mjs /data/backups/latest.sqlite
mkdir -p backups
docker cp bill-hub:/data/backups/latest.sqlite ./backups/latest.sqlite
chmod 600 ./backups/latest.sqlite
```

Скопируйте бэкап на другой носитель/сервер. Также сохраните `.env` в защищённом месте. JSON-экспорт из интерфейса предназначен для просмотра/переноса вручную; автоматического JSON-импорта нет.

## Восстановление

Остановите приложение. Сначала сохраните текущую базу предыдущей командой. Используйте образ той же версии, что создал бэкап, затем обновляйте его обычным способом.

Проверка файла без изменения данных:

```bash
docker run --rm --user 0 --entrypoint node \
  --mount type=bind,source="$PWD/backups",target=/restore,readonly \
  bill-hub:local --input-type=module -e \
  "import {DatabaseSync} from 'node:sqlite'; const d=new DatabaseSync('/restore/latest.sqlite',{readOnly:true}); if(d.prepare('PRAGMA quick_check').get().quick_check!=='ok') process.exit(1); d.prepare('SELECT id FROM utility_accounts LIMIT 1').all(); d.prepare('SELECT id FROM utility_readings LIMIT 1').all(); d.close();"
```

Только после успешной проверки замените остановленную базу. Следующие команды намеренно заменяют текущие данные бэкапом:

```bash
docker stop bill-hub
docker run --rm --user 0 --entrypoint sh \
  --mount source=bill-hub-data,target=/data \
  --mount type=bind,source="$PWD/backups",target=/restore,readonly \
  bill-hub:local -c 'set -eu; cp /restore/latest.sqlite /data/restoring.sqlite; chown 1000:1000 /data/restoring.sqlite; chmod 600 /data/restoring.sqlite; rm -f /data/bill-hub.sqlite-wal /data/bill-hub.sqlite-shm; mv /data/restoring.sqlite /data/bill-hub.sqlite'
docker start bill-hub
```

После старта проверьте healthcheck и историю. Отправки, выполненные **после** момента бэкапа, могли не попасть в восстановленную историю: сначала сверьте их у поставщика, чтобы не отправить повторно.

## Обновление и откат

1. Сделайте и выгрузите бэкап.
2. Сохраните текущий образ и обновите код:

```bash
docker image tag bill-hub:local bill-hub:previous
git pull --ff-only
docker build --pull -t bill-hub:local .
```

3. После успешной сборки пересоздайте контейнер:

```bash
docker stop bill-hub
docker rm bill-hub
```

4. Повторите `docker run` из README с прежним `bill-hub-data` и `.env`. Данные остаются в volume, миграции выполняются перед стартом HTTP. Проверьте healthcheck и историю.

Не удаляйте `bill-hub-data` и не используйте `docker volume prune` для обновления. Если новая версия не запускается, прочитайте логи. Откат контейнера делается той же командой запуска с образом `bill-hub:previous`; если схема базы изменилась несовместимо, сначала восстановите предобновленческий бэкап. Автоматических обратных миграций нет.

## Сброс пароля

В отдельном временном каталоге снова запустите `scripts/setup.mjs` (с абсолютным путём к скрипту проекта). Он покажет новый пароль и создаст новый `.env` только в этом каталоге. Перенесите `ADMIN_PASSWORD_HASH` и `SESSION_SECRET` в рабочий `.env`, сохранив свой `APP_URL` и остальные настройки, затем пересоздайте контейнер. Удалите временный файл. Все прежние сессии перестанут действовать; SQLite не изменится.
