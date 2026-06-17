# Деплой на Linux-сервер (без Docker)

Инструкция для Ubuntu 22.04/24.04 VPS с доменом и HTTPS. Архитектура:
**Node/Express отдаёт и REST API, и собранный фронт** (один процесс, один origin),
а **nginx** терминирует TLS и проксирует на него. Так не нужно возиться с CORS.

```
Браузер ──HTTPS──> nginx (:443) ──proxy──> Node/Express (:4000) ──> PostgreSQL
                                              └─ отдаёт client/dist (SPA)
```

Все команды — под пользователем с `sudo`. Замените `your-domain.com` на свой домен.

> Предварительно: A-запись домена должна указывать на IP сервера.

---

## 1. Установка зависимостей

```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL, nginx, certbot, git
sudo apt-get install -y postgresql nginx git
sudo apt-get install -y certbot python3-certbot-nginx
```

## 2. Пользователь и каталог приложения

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin gradebook
sudo mkdir -p /var/www/gradebook
sudo chown gradebook:gradebook /var/www/gradebook
```

## 3. Получить код

```bash
sudo -u gradebook git clone https://github.com/savalyev/Web-based-Gradebook.git /var/www/gradebook
cd /var/www/gradebook
```

## 4. База данных

```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE gradebook LOGIN PASSWORD 'СГЕНЕРИРУЙТЕ_СИЛЬНЫЙ_ПАРОЛЬ';
CREATE DATABASE gradebook OWNER gradebook;
SQL
```

## 5. Конфигурация `.env`

```bash
cd /var/www/gradebook/server
sudo -u gradebook cp .env.production.example .env
# Сгенерировать JWT-секрет:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
sudo -u gradebook nano .env
```
В `.env` укажите: `DATABASE_URL` (с паролем из шага 4), `JWT_SECRET` (сгенерированный),
`CLIENT_ORIGIN=https://your-domain.com`, пути `UPLOAD_DIR` и `CLIENT_DIST`
(по умолчанию подходят `/var/www/gradebook/uploads` и `/var/www/gradebook/client/dist`),
`TRUST_PROXY=1`.

## 6. Сборка

```bash
# Фронтенд
cd /var/www/gradebook/client
sudo -u gradebook npm ci
sudo -u gradebook npm run build      # -> client/dist

# Бэкенд
cd /var/www/gradebook/server
sudo -u gradebook npm ci
sudo -u gradebook npm run build      # tsc -> dist + копирует schema.sql
```

## 7. Миграция и первичные данные

```bash
cd /var/www/gradebook/server
sudo -u gradebook --preserve-env=PATH bash -c 'set -a; . ./.env; set +a; npm run migrate:prod && npm run seed:prod'
mkdir -p /var/www/gradebook/uploads && sudo chown gradebook:gradebook /var/www/gradebook/uploads
```
Seed создаст демо-аккаунты (`admin@demo` / `admin123` и др.) — **смените пароли после первого входа** или удалите демо-пользователей через админ-панель.

## 8. systemd-сервис

```bash
sudo cp /var/www/gradebook/deploy/gradebook.service /etc/systemd/system/gradebook.service
# при необходимости поправьте путь к node:  which node
sudo systemctl daemon-reload
sudo systemctl enable --now gradebook
sudo systemctl status gradebook        # должно быть active (running)
curl -s http://127.0.0.1:4000/api/health   # {"ok":true}
```

## 9. nginx

```bash
sudo cp /var/www/gradebook/deploy/nginx.conf /etc/nginx/sites-available/gradebook
sudo sed -i 's/your-domain.com/ВАШ_ДОМЕН/g' /etc/nginx/sites-available/gradebook
sudo ln -s /etc/nginx/sites-available/gradebook /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

## 10. HTTPS (Let's Encrypt)

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```
Certbot сам выпустит сертификат, добавит блок `443 ssl` и редирект с HTTP на HTTPS.
Автопродление уже настроено systemd-таймером (`systemctl status certbot.timer`).

## 11. Проверка

Откройте `https://your-domain.com`, войдите демо-аккаунтом, проверьте журнал,
загрузку файла, экспорт в Excel. **Сразу смените пароль admin** в «Личном кабинете».

---

## Обновление версии

```bash
cd /var/www/gradebook
sudo -u gradebook git pull
cd client && sudo -u gradebook npm ci && sudo -u gradebook npm run build
cd ../server && sudo -u gradebook npm ci && sudo -u gradebook npm run build
# если менялась схема БД:
sudo -u gradebook --preserve-env=PATH bash -c 'set -a; . ./.env; set +a; npm run migrate:prod'
sudo systemctl restart gradebook
```

## Логи и обслуживание

```bash
journalctl -u gradebook -f          # логи приложения
sudo systemctl restart gradebook    # перезапуск
```

## Чек-лист безопасности

- [ ] Сильный `JWT_SECRET` и пароль БД в `.env` (файл не в git).
- [ ] Сменены/удалены демо-аккаунты.
- [ ] Включён firewall: `sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable`.
- [ ] PostgreSQL слушает только localhost (по умолчанию так и есть).
- [ ] Сертификат выпущен, HTTP редиректит на HTTPS.
