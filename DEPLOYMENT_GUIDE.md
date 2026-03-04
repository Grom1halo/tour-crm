# 🌐 ГАЙД ПО ДЕПЛОЮ CRM В ИНТЕРНЕТ

## 📋 Содержание
1. [Выбор способа деплоя](#выбор-способа-деплоя)
2. [Вариант 1: Railway (Самый простой)](#вариант-1-railway-бесплатно-5-минут)
3. [Вариант 2: Render (Бесплатно)](#вариант-2-render-бесплатно)
4. [Вариант 3: DigitalOcean (Профессионально)](#вариант-3-digitalocean-профессионально)
5. [Вариант 4: VPS (Полный контроль)](#вариант-4-vps-полный-контроль)
6. [Настройка домена](#настройка-домена)
7. [SSL сертификат](#ssl-сертификат)

---

## 🎯 Выбор способа деплоя

| Способ | Сложность | Стоимость | Время | Рекомендация |
|--------|-----------|-----------|-------|--------------|
| Railway | ⭐ Легко | $5-10/мес | 5 мин | ✅ Для быстрой демонстрации |
| Render | ⭐⭐ Средне | Бесплатно* | 10 мин | ✅ Для MVP и тестирования |
| DigitalOcean App Platform | ⭐⭐ Средне | $12-20/мес | 15 мин | ✅ Для production |
| VPS (самостоятельно) | ⭐⭐⭐⭐ Сложно | $5-15/мес | 1-2 часа | Для опытных |

**Бесплатно с ограничениями (спящий режим после неактивности)*

---

## 🚀 Вариант 1: Railway (Бесплатно $5 кредитов, 5 минут)

**Самый простой способ!** Подходит для демонстрации заказчику.

### Шаг 1: Регистрация

1. Перейдите на https://railway.app/
2. Нажмите **"Start a New Project"**
3. Войдите через GitHub (создайте аккаунт GitHub если нет)

### Шаг 2: Загрузка проекта на GitHub

```bash
# В папке tour-crm выполните:

# 1. Инициализируйте git (если ещё не сделали)
git init

# 2. Добавьте все файлы
git add .

# 3. Сделайте первый коммит
git commit -m "Initial commit - Tour CRM MVP"

# 4. Создайте репозиторий на GitHub
# Перейдите на https://github.com/new
# Название: tour-crm-mvp
# Visibility: Private (для приватного проекта)

# 5. Привяжите репозиторий
git remote add origin https://github.com/ВАШ_USERNAME/tour-crm-mvp.git
git branch -M main
git push -u origin main
```

### Шаг 3: Деплой на Railway

1. **В Railway нажмите:** "New Project" → "Deploy from GitHub repo"
2. **Выберите репозиторий:** `tour-crm-mvp`
3. **Railway автоматически обнаружит:** Node.js проект

### Шаг 4: Настройка PostgreSQL

1. В Railway проекте нажмите: **"+ New"** → **"Database"** → **"PostgreSQL"**
2. Railway создаст базу данных автоматически
3. Скопируйте строку подключения (будет что-то вроде `postgresql://user:pass@host:port/db`)

### Шаг 5: Настройка Backend

1. Откройте **Backend Service** в Railway
2. Перейдите в **"Variables"**
3. Добавьте переменные окружения:

```env
NODE_ENV=production
PORT=3001
JWT_SECRET=your-super-secret-key-change-this
JWT_EXPIRES_IN=7d

# PostgreSQL (скопируйте из Railway)
DATABASE_URL=postgresql://postgres:password@hostname:5432/railway
```

4. В **"Settings"** → **"Build"**:
   - Root Directory: `backend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`

### Шаг 6: Применить SQL схему

```bash
# Локально подключитесь к Railway БД и примените схему
psql "postgresql://postgres:password@hostname:5432/railway" -f database/schema.sql
psql "postgresql://postgres:password@hostname:5432/railway" -f database/test_data.sql
```

### Шаг 7: Настройка Frontend

1. Откройте **Frontend Service**
2. Перейдите в **"Variables"**:

```env
VITE_API_URL=https://ваш-backend.railway.app/api
```

3. В **"Settings"** → **"Build"**:
   - Root Directory: `frontend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run preview` (для Vite в production)

### Шаг 8: Получить URL

Railway автоматически даст вам URL вида:
- Frontend: `https://tour-crm-frontend-xxx.railway.app`
- Backend: `https://tour-crm-backend-xxx.railway.app`

✅ **Готово!** Отправьте ссылку заказчику.

---

## 🎨 Вариант 2: Render (Бесплатно)

**Плюсы:** Бесплатно для тестирования  
**Минусы:** "Засыпает" после 15 минут неактивности (запуск займёт 30-60 сек)

### Шаг 1: Регистрация

1. Перейдите на https://render.com/
2. Зарегистрируйтесь через GitHub

### Шаг 2: Загрузка на GitHub

(Такой же как в Railway - см. выше)

### Шаг 3: Создать PostgreSQL

1. На Render: **"New +"** → **"PostgreSQL"**
2. Имя: `tour-crm-db`
3. Plan: **Free** (ограничение 90 дней, потом нужно пересоздать)
4. Нажмите **"Create Database"**
5. Скопируйте **Internal Database URL**

### Шаг 4: Применить схему

```bash
# Подключитесь к Render БД
psql "postgres://user:pass@hostname/dbname" -f database/schema.sql
psql "postgres://user:pass@hostname/dbname" -f database/test_data.sql
```

### Шаг 5: Создать Backend Service

1. **"New +"** → **"Web Service"**
2. Подключите GitHub репозиторий
3. Настройки:
   - Name: `tour-crm-backend`
   - Root Directory: `backend`
   - Environment: **Node**
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Plan: **Free**

4. **Environment Variables:**

```env
NODE_ENV=production
PORT=3001
DB_HOST=<из Internal Database URL>
DB_PORT=5432
DB_NAME=<из Internal Database URL>
DB_USER=<из Internal Database URL>
DB_PASSWORD=<из Internal Database URL>
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d
```

### Шаг 6: Создать Frontend Service

1. **"New +"** → **"Static Site"**
2. Подключите тот же GitHub репозиторий
3. Настройки:
   - Name: `tour-crm-frontend`
   - Root Directory: `frontend`
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist`

4. **Environment Variables:**

```env
VITE_API_URL=https://tour-crm-backend.onrender.com/api
```

### Шаг 7: Получить URL

Render даст вам:
- Frontend: `https://tour-crm-frontend.onrender.com`
- Backend: `https://tour-crm-backend.onrender.com`

⚠️ **Внимание:** На бесплатном плане сервис "засыпает" после 15 минут. Первый запуск займёт ~30 секунд.

---

## 💎 Вариант 3: DigitalOcean App Platform (Профессионально)

**Для продакшена.** Стоимость: ~$12-20/мес

### Шаг 1: Регистрация

1. Перейдите на https://www.digitalocean.com/
2. Зарегистрируйтесь (нужна кредитная карта)
3. **Бонус:** Используйте промокод для $200 кредита на 60 дней

### Шаг 2: Создать приложение

1. В панели DigitalOcean: **"Apps"** → **"Create App"**
2. Выберите **GitHub** → подключите репозиторий
3. DigitalOcean автоматически обнаружит Node.js

### Шаг 3: Настройка компонентов

**App Spec будет выглядеть так:**

```yaml
name: tour-crm
services:
  - name: backend
    github:
      repo: ваш-username/tour-crm-mvp
      branch: main
      deploy_on_push: true
    source_dir: /backend
    build_command: npm install && npm run build
    run_command: npm start
    envs:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        scope: RUN_TIME
        type: SECRET
      - key: JWT_SECRET
        scope: RUN_TIME
        type: SECRET
    http_port: 3001
    
  - name: frontend
    github:
      repo: ваш-username/tour-crm-mvp
      branch: main
      deploy_on_push: true
    source_dir: /frontend
    build_command: npm install && npm run build
    run_command: npm run preview
    envs:
      - key: VITE_API_URL
        value: ${backend.PUBLIC_URL}/api
    http_port: 3000

databases:
  - name: tour-crm-db
    engine: PG
    version: "15"
    size: basic-xs
    num_nodes: 1
```

### Шаг 4: Применить схему

DigitalOcean предоставит connection string для БД:

```bash
psql "postgresql://user:pass@host:port/db?sslmode=require" -f database/schema.sql
psql "postgresql://user:pass@host:port/db?sslmode=require" -f database/test_data.sql
```

### Шаг 5: Деплой

Нажмите **"Create Resources"** → DigitalOcean развернёт всё автоматически.

URL будет: `https://tour-crm-xxxxx.ondigitalocean.app`

---

## 🖥️ Вариант 4: VPS (Полный контроль)

**Для опытных разработчиков.** Полная настройка сервера.

### Провайдеры:
- **DigitalOcean:** $6/мес (Droplet)
- **Hetzner:** €4/мес (очень дешево)
- **Linode:** $5/мес
- **Vultr:** $5/мес
- **AWS Lightsail:** $5/мес

### Процесс настройки:

#### Шаг 1: Создать сервер

1. Выберите провайдера
2. Создайте Ubuntu 22.04 сервер
3. Минимальные требования: 1GB RAM, 1 CPU

#### Шаг 2: Подключиться к серверу

```bash
ssh root@ВАШ_IP_АДРЕС
```

#### Шаг 3: Установить зависимости

```bash
# Обновить систему
apt update && apt upgrade -y

# Установить Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Установить PostgreSQL
apt install postgresql postgresql-contrib -y

# Установить Nginx
apt install nginx -y

# Установить Certbot (для SSL)
apt install certbot python3-certbot-nginx -y

# Установить Git
apt install git -y
```

#### Шаг 4: Настроить PostgreSQL

```bash
# Переключиться на postgres пользователя
sudo -u postgres psql

# В psql:
CREATE DATABASE tour_crm;
CREATE USER tour_crm_user WITH PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE tour_crm TO tour_crm_user;
\q
```

#### Шаг 5: Загрузить проект

```bash
# Создать директорию
mkdir -p /var/www/tour-crm
cd /var/www/tour-crm

# Клонировать с GitHub
git clone https://github.com/ваш-username/tour-crm-mvp.git .

# Применить SQL схемы
psql -U tour_crm_user -d tour_crm -f database/schema.sql
psql -U tour_crm_user -d tour_crm -f database/test_data.sql
```

#### Шаг 6: Настроить Backend

```bash
cd backend

# Установить зависимости
npm install

# Создать .env файл
nano .env
```

Содержимое .env:
```env
NODE_ENV=production
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tour_crm
DB_USER=tour_crm_user
DB_PASSWORD=secure_password_here
JWT_SECRET=super-secret-key-change-this
JWT_EXPIRES_IN=7d
```

```bash
# Собрать проект
npm run build

# Установить PM2 для автозапуска
npm install -g pm2

# Запустить Backend
pm2 start dist/server.js --name tour-crm-backend

# Автозапуск при перезагрузке
pm2 startup
pm2 save
```

#### Шаг 7: Настроить Frontend

```bash
cd ../frontend

# Установить зависимости
npm install

# Создать .env файл
nano .env.production
```

Содержимое:
```env
VITE_API_URL=https://ваш-домен.com/api
```

```bash
# Собрать production версию
npm run build

# Скопировать build в Nginx
cp -r dist /var/www/tour-crm-frontend
```

#### Шаг 8: Настроить Nginx

```bash
nano /etc/nginx/sites-available/tour-crm
```

Содержимое:
```nginx
# Backend
server {
    listen 80;
    server_name api.ваш-домен.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Frontend
server {
    listen 80;
    server_name ваш-домен.com www.ваш-домен.com;
    
    root /var/www/tour-crm-frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Активировать конфигурацию
ln -s /etc/nginx/sites-available/tour-crm /etc/nginx/sites-enabled/

# Проверить конфигурацию
nginx -t

# Перезапустить Nginx
systemctl restart nginx
```

#### Шаг 9: Настроить SSL (HTTPS)

```bash
# Получить SSL сертификат от Let's Encrypt
certbot --nginx -d ваш-домен.com -d www.ваш-домен.com -d api.ваш-домен.com

# Certbot автоматически настроит HTTPS
# Выберите: Redirect HTTP to HTTPS
```

#### Шаг 10: Настроить Firewall

```bash
# Разрешить нужные порты
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

✅ **Готово!** Ваш сайт доступен по адресу: `https://ваш-домен.com`

---

## 🌍 Настройка домена

### Купить домен:

**Регистраторы:**
- **Namecheap:** https://www.namecheap.com/ (~$10/год)
- **GoDaddy:** https://www.godaddy.com/
- **Google Domains:** https://domains.google/
- **CloudFlare:** https://www.cloudflare.com/products/registrar/ (дешевле всех)

### Настройка DNS:

После покупки домена настройте A-записи:

```
Тип    Имя      Значение           TTL
A      @        IP_ВАШЕГО_СЕРВЕРА  3600
A      www      IP_ВАШЕГО_СЕРВЕРА  3600
A      api      IP_ВАШЕГО_СЕРВЕРА  3600
```

**Для Railway/Render/DigitalOcean:**
Используйте CNAME вместо A:

```
Тип     Имя      Значение                              TTL
CNAME   @        tour-crm.railway.app                  3600
CNAME   www      tour-crm.railway.app                  3600
```

⏱️ **DNS распространяется за 5 минут - 24 часа** (обычно ~1 час)

---

## 🔒 SSL сертификат (HTTPS)

### Автоматически:
- **Railway/Render/DigitalOcean:** SSL включён по умолчанию!

### На VPS вручную:
```bash
# Let's Encrypt (бесплатно)
certbot --nginx -d ваш-домен.com

# Автообновление
certbot renew --dry-run
```

---

## 📊 Сравнение вариантов

| Параметр | Railway | Render | DigitalOcean | VPS |
|----------|---------|--------|--------------|-----|
| **Стоимость** | $5-10/мес | Бесплатно* | $12-20/мес | $5-15/мес |
| **Время setup** | 5 минут | 10 минут | 15 минут | 1-2 часа |
| **Сложность** | ⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| **Автодеплой** | ✅ | ✅ | ✅ | ❌ |
| **Автомасштаб** | ✅ | ✅ | ✅ | ❌ |
| **Бэкапы БД** | ✅ | ❌ | ✅ | Вручную |
| **SSL** | ✅ Авто | ✅ Авто | ✅ Авто | Вручную |
| **Производ.** | Хорошо | Средне | Отлично | Зависит |
| **Поддержка** | 24/7 | Email | 24/7 | Нет |

**Бесплатно с ограничениями*

---

## 🎯 Рекомендация для вашего случая

### Для демонстрации заказчику (1-2 недели):
→ **Railway** или **Render (Free)**

### Для MVP и первых пользователей:
→ **Render (Paid)** или **DigitalOcean App Platform**

### Для продакшена:
→ **DigitalOcean App Platform** или **VPS** (если есть опыт)

---

## ✅ Чеклист деплоя

- [ ] Проект загружен на GitHub
- [ ] Выбран хостинг (Railway/Render/DigitalOcean/VPS)
- [ ] PostgreSQL база создана
- [ ] SQL схема применена (`schema.sql`)
- [ ] Тестовые данные загружены (`test_data.sql`)
- [ ] Backend развёрнут и работает
- [ ] Frontend развёрнут и работает
- [ ] Environment переменные настроены
- [ ] HTTPS (SSL) включён
- [ ] Домен настроен (опционально)
- [ ] Протестирован логин (admin/admin123)
- [ ] Проверена работа всех функций

---

## 🚨 Важные моменты для продакшена

1. **Измените пароль админа** в БД
2. **Смените JWT_SECRET** на случайную строку
3. **Настройте автобэкапы БД** (ежедневно)
4. **Настройте мониторинг** (Uptime Robot, Pingdom)
5. **Добавьте логирование** (Winston, Sentry)
6. **Настройте CORS** правильно в backend
7. **Добавьте rate limiting** (против DDoS)
8. **Проверьте безопасность** (npm audit)

---

## 🆘 Нужна помощь с деплоем?

Если возникли проблемы:

1. Проверьте логи на хостинге
2. Убедитесь, что environment переменные правильные
3. Проверьте подключение к БД
4. Проверьте порты и файрволлы
5. Посмотрите документацию хостинга

---

**Удачи с деплоем! 🚀**

*P.S. Рекомендую начать с Railway - самый простой вариант для демонстрации заказчику!*
