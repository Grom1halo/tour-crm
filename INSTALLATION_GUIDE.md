# 🖥️ ПОЛНЫЙ ГАЙД ПО ЗАПУСКУ НА ЛОКАЛЬНОМ ПК

## 📋 Содержание
1. [Требования](#требования)
2. [Установка программ](#установка-программ)
3. [Настройка PostgreSQL](#настройка-postgresql)
4. [Запуск Backend](#запуск-backend)
5. [Запуск Frontend](#запуск-frontend)
6. [Проверка работы](#проверка-работы)
7. [Решение проблем](#решение-проблем)

---

## 📌 Требования

### Минимальные требования к ПК:
- **OS:** Windows 10/11, macOS 10.15+, Linux (Ubuntu 20.04+)
- **RAM:** 4 GB (рекомендуется 8 GB)
- **Свободное место:** 2 GB
- **Процессор:** Любой современный (2015+)

### Нужно установить:
1. Node.js 18 или новее
2. PostgreSQL 14 или новее
3. Git (опционально, для клонирования)
4. Текстовый редактор (VS Code рекомендуется)

---

## 🔧 Установка программ

### 1. Node.js

#### Windows:
1. Скачайте установщик: https://nodejs.org/en/download/
2. Выберите **LTS версию** (например 18.x или 20.x)
3. Запустите установщик (.msi файл)
4. Следуйте инструкциям (все галочки оставить по умолчанию)
5. Проверьте установку:
```bash
# Откройте командную строку (Win+R → cmd)
node --version
# Должно показать: v18.x.x или v20.x.x

npm --version
# Должно показать: 9.x.x или 10.x.x
```

#### macOS:
```bash
# Вариант 1: Скачать с сайта
# https://nodejs.org/en/download/

# Вариант 2: Через Homebrew (если установлен)
brew install node@18

# Проверка
node --version
npm --version
```

#### Linux (Ubuntu/Debian):
```bash
# Обновить пакеты
sudo apt update

# Установить Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Проверка
node --version
npm --version
```

---

### 2. PostgreSQL

#### Windows:
1. Скачайте установщик: https://www.postgresql.org/download/windows/
2. Запустите установщик
3. **ВАЖНО:** Запомните пароль для пользователя `postgres`!
4. Порт оставьте: `5432`
5. Locale: выберите `Russian, Russia` или `English, United States`
6. Установите все компоненты (PostgreSQL Server, pgAdmin, Command Line Tools)

**Проверка установки:**
```bash
# Откройте командную строку
psql --version
# Должно показать: psql (PostgreSQL) 14.x или 15.x
```

#### macOS:
```bash
# Через Homebrew
brew install postgresql@15

# Запустить PostgreSQL
brew services start postgresql@15

# Проверка
psql --version
```

#### Linux (Ubuntu/Debian):
```bash
# Установка
sudo apt update
sudo apt install postgresql postgresql-contrib

# Запуск сервиса
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Проверка
psql --version
```

---

### 3. Git (опционально)

#### Windows:
- Скачайте: https://git-scm.com/download/win
- Установите с настройками по умолчанию

#### macOS:
```bash
brew install git
```

#### Linux:
```bash
sudo apt install git
```

---

## 🗄️ Настройка PostgreSQL

### Шаг 1: Подключение к PostgreSQL

#### Windows:
```bash
# Вариант 1: Через командную строку
psql -U postgres

# Вариант 2: Через pgAdmin (GUI)
# Запустите pgAdmin из меню Пуск
```

#### macOS/Linux:
```bash
# Переключиться на пользователя postgres
sudo -u postgres psql

# Или напрямую
psql -U postgres
```

**При первом входе введите пароль, который установили при инсталляции!**

---

### Шаг 2: Создание базы данных

В консоли PostgreSQL (после команды `psql`) выполните:

```sql
-- Создать базу данных
CREATE DATABASE tour_crm;

-- Проверить, что создалась
\l

-- Выйти
\q
```

**Скриншот должен показать:**
```
                                List of databases
   Name    |  Owner   | Encoding |   Collate   |    Ctype    |
-----------+----------+----------+-------------+-------------+
 tour_crm  | postgres | UTF8     | en_US.UTF-8 | en_US.UTF-8 |
```

---

### Шаг 3: Применение SQL схемы

#### Windows:
```bash
# Перейдите в папку с проектом
cd C:\Users\ВашеИмя\Downloads\tour-crm

# Примените схему
psql -U postgres -d tour_crm -f database\schema.sql

# Примените тестовые данные
psql -U postgres -d tour_crm -f database\test_data.sql
```

#### macOS/Linux:
```bash
# Перейдите в папку с проектом
cd ~/Downloads/tour-crm

# Примените схему
psql -U postgres -d tour_crm -f database/schema.sql

# Примените тестовые данные
psql -U postgres -d tour_crm -f database/test_data.sql
```

**Вы должны увидеть:**
```
CREATE TABLE
CREATE TABLE
CREATE INDEX
INSERT 0 1
...
Database populated successfully!
```

---

### Шаг 4: Проверка данных в БД

```bash
# Подключитесь к БД
psql -U postgres -d tour_crm

# Проверьте таблицы
\dt

# Проверьте пользователей
SELECT username, role FROM users;

# Должно показать:
#    username   |    role
# --------------+-----------
#  admin        | admin
#  manager1     | manager
#  ...

# Выйдите
\q
```

✅ **База данных готова!**

---

## 🔧 Запуск Backend

### Шаг 1: Открыть терминал в папке backend

#### Windows:
```bash
# Вариант 1: Через проводник
# 1. Откройте папку tour-crm\backend в проводнике
# 2. В адресной строке наберите cmd и нажмите Enter

# Вариант 2: Через командную строку
cd C:\Users\ВашеИмя\Downloads\tour-crm\backend
```

#### macOS/Linux:
```bash
cd ~/Downloads/tour-crm/backend
```

---

### Шаг 2: Настроить файл .env

Откройте файл `backend/.env` в текстовом редакторе:

```env
# Если ваш пароль PostgreSQL другой - измените здесь!
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tour_crm
DB_USER=postgres
DB_PASSWORD=ВАШ_ПАРОЛЬ_POSTGRES  # ← ИЗМЕНИТЕ ЭТО!

PORT=3001
NODE_ENV=development

JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
```

**ВАЖНО:** Замените `DB_PASSWORD` на пароль, который вы задали при установке PostgreSQL!

---

### Шаг 3: Установить зависимости

```bash
# В папке tour-crm/backend выполните:
npm install
```

**Вы увидите:**
```
added 234 packages in 45s
```

Это займёт 30-60 секунд.

---

### Шаг 4: Запустить сервер

```bash
npm run dev
```

**Должно появиться:**
```
=================================
🚀 Tour CRM Backend Server
📡 Running on port 3001
🌍 Environment: development
=================================
✓ Database connected
```

✅ **Backend работает!** Оставьте это окно терминала открытым.

---

### Проверка Backend API

Откройте браузер и перейдите:
- http://localhost:3001/health

Должен показать:
```json
{
  "status": "ok",
  "timestamp": "2026-02-10T12:34:56.789Z"
}
```

---

## 🎨 Запуск Frontend

### Шаг 1: Открыть ВТОРОЙ терминал

**ВАЖНО:** Backend должен продолжать работать! Откройте НОВОЕ окно терминала.

#### Windows:
```bash
# Откройте новое окно командной строки
# Win+R → cmd

cd C:\Users\ВашеИмя\Downloads\tour-crm\frontend
```

#### macOS/Linux:
```bash
# Откройте новый терминал (Cmd+T или Ctrl+Shift+T)
cd ~/Downloads/tour-crm/frontend
```

---

### Шаг 2: Установить зависимости

```bash
npm install
```

**Это займёт 1-2 минуты.**

---

### Шаг 3: Запустить приложение

```bash
npm run dev
```

**Должно появиться:**
```
  VITE v5.0.8  ready in 523 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

✅ **Frontend работает!**

---

## 🎉 Проверка работы

### 1. Откройте браузер

Перейдите на: **http://localhost:3000**

### 2. Вы увидите страницу логина

**Введите:**
- Username: `admin`
- Password: `admin123`

### 3. После входа вы увидите:

- ✅ Главную страницу с ваучерами
- ✅ Меню навигации (Vouchers, Clients, Companies, Tours, Agents)
- ✅ Кнопку "+ New Voucher"

### 4. Проверьте функционал:

**Попробуйте:**
- Создать нового клиента (меню Clients → + Add Client)
- Создать ваучер (+ New Voucher)
- Посмотреть список ваучеров с фильтрами
- Добавить платёж к ваучеру

---

## 🎯 Итоговая проверка

### У вас должно быть открыто:

1. ✅ **Терминал 1** (Backend): показывает логи API запросов
2. ✅ **Терминал 2** (Frontend): показывает Vite dev server
3. ✅ **Браузер** (http://localhost:3000): открыта CRM система

### Порты должны быть заняты:

```bash
# Проверка портов (в новом терминале)

# Windows:
netstat -ano | findstr :3000
netstat -ano | findstr :3001
netstat -ano | findstr :5432

# macOS/Linux:
lsof -i :3000
lsof -i :3001
lsof -i :5432
```

---

## 🛑 Как остановить

### Остановка Frontend:
В терминале с Frontend нажмите: **Ctrl+C**

### Остановка Backend:
В терминале с Backend нажмите: **Ctrl+C**

### Остановка PostgreSQL:

#### Windows:
```bash
# Через pgAdmin → правый клик на сервер → Stop

# Или через команду
pg_ctl -D "C:\Program Files\PostgreSQL\15\data" stop
```

#### macOS:
```bash
brew services stop postgresql@15
```

#### Linux:
```bash
sudo systemctl stop postgresql
```

---

## 🔄 Запуск в следующий раз

После перезагрузки ПК:

### 1. Убедитесь, что PostgreSQL запущен

#### Windows:
PostgreSQL обычно запускается автоматически.

Проверка:
```bash
psql -U postgres -d tour_crm -c "SELECT 1;"
```

Если ошибка, запустите через pgAdmin.

#### macOS:
```bash
brew services start postgresql@15
```

#### Linux:
```bash
sudo systemctl start postgresql
```

---

### 2. Запустите Backend

```bash
cd tour-crm/backend
npm run dev
```

---

### 3. Запустите Frontend (в новом терминале)

```bash
cd tour-crm/frontend
npm run dev
```

---

### 4. Откройте браузер

http://localhost:3000

✅ **Готово!**

---

## 🐛 Решение проблем

### Проблема 1: "psql: command not found"

**Решение (Windows):**
1. Добавьте PostgreSQL в PATH:
   - Панель управления → Система → Дополнительные параметры системы
   - Переменные среды → Path → Изменить
   - Добавить: `C:\Program Files\PostgreSQL\15\bin`
2. Перезапустите командную строку

**Решение (macOS/Linux):**
```bash
# Найдите где установлен psql
which psql

# Если не найден, переустановите PostgreSQL
```

---

### Проблема 2: "Cannot connect to database"

**Решение:**
1. Проверьте, запущен ли PostgreSQL:
```bash
# Windows
sc query postgresql-x64-15

# macOS
brew services list | grep postgresql

# Linux
sudo systemctl status postgresql
```

2. Проверьте пароль в `backend/.env`
3. Попробуйте подключиться вручную:
```bash
psql -U postgres -d tour_crm
```

---

### Проблема 3: "Port 3000 already in use"

**Решение:**

#### Windows:
```bash
# Найти процесс на порту 3000
netstat -ano | findstr :3000

# Убить процесс (замените PID на номер из предыдущей команды)
taskkill /PID 1234 /F
```

#### macOS/Linux:
```bash
# Убить процесс на порту 3000
lsof -ti:3000 | xargs kill -9

# Убить процесс на порту 3001
lsof -ti:3001 | xargs kill -9
```

---

### Проблема 4: "npm install" не работает

**Решение:**
```bash
# Очистить кеш npm
npm cache clean --force

# Удалить node_modules и попробовать снова
rm -rf node_modules
npm install

# Windows:
rmdir /s /q node_modules
npm install
```

---

### Проблема 5: "Module not found" ошибки

**Решение:**
```bash
# Переустановить зависимости
cd backend
rm -rf node_modules package-lock.json
npm install

cd ../frontend
rm -rf node_modules package-lock.json
npm install
```

---

### Проблема 6: Белый экран в браузере

**Решение:**
1. Откройте консоль браузера (F12)
2. Посмотрите ошибки в Console
3. Проверьте, что Backend работает: http://localhost:3001/health
4. Очистите кеш браузера (Ctrl+Shift+Delete)
5. Перезапустите Frontend

---

### Проблема 7: "ECONNREFUSED" ошибки в браузере

**Причина:** Frontend не может подключиться к Backend

**Решение:**
1. Убедитесь, что Backend запущен (терминал 1 должен работать)
2. Проверьте http://localhost:3001/health в браузере
3. Проверьте файл `frontend/vite.config.ts` - должен быть proxy к :3001

---

## 📱 Доступ с телефона/планшета (в локальной сети)

### 1. Узнайте IP адрес вашего ПК

#### Windows:
```bash
ipconfig
# Найдите IPv4 адрес, например: 192.168.1.100
```

#### macOS/Linux:
```bash
ifconfig | grep inet
# или
ip addr show
```

### 2. Запустите Frontend с --host

```bash
cd frontend
npm run dev -- --host
```

### 3. Откройте на телефоне

```
http://192.168.1.100:3000
```

(Замените на ваш IP адрес)

---

## 🎓 Полезные команды

### PostgreSQL:

```bash
# Подключиться к БД
psql -U postgres -d tour_crm

# Список таблиц
\dt

# Описание таблицы
\d vouchers

# Запрос данных
SELECT * FROM users;

# Выход
\q
```

### npm команды:

```bash
# Установить зависимости
npm install

# Запустить в dev режиме
npm run dev

# Собрать для production
npm run build

# Очистить кеш
npm cache clean --force
```

---

## 📚 Дополнительные материалы

### Видеоуроки:
- **Node.js установка:** https://www.youtube.com/results?search_query=nodejs+install+windows
- **PostgreSQL установка:** https://www.youtube.com/results?search_query=postgresql+install+windows
- **React основы:** https://react.dev/learn

### Документация:
- Node.js: https://nodejs.org/en/docs/
- PostgreSQL: https://www.postgresql.org/docs/
- React: https://react.dev
- Vite: https://vitejs.dev

---

## ✅ Чеклист успешного запуска

- [ ] Node.js установлен (проверка: `node --version`)
- [ ] PostgreSQL установлен (проверка: `psql --version`)
- [ ] База данных `tour_crm` создана
- [ ] SQL схема применена (`schema.sql`)
- [ ] Тестовые данные загружены (`test_data.sql`)
- [ ] Backend зависимости установлены (`npm install` в backend/)
- [ ] Backend запущен (терминал показывает "Database connected")
- [ ] Frontend зависимости установлены (`npm install` в frontend/)
- [ ] Frontend запущен (терминал показывает "ready in ... ms")
- [ ] Браузер открыт на http://localhost:3000
- [ ] Логин admin/admin123 работает
- [ ] Вижу список ваучеров

**Если все галочки стоят - ВСЁ РАБОТАЕТ! 🎉**

---

## 🆘 Нужна помощь?

Если что-то не получается:

1. Внимательно прочитайте сообщения об ошибках
2. Проверьте раздел "Решение проблем" выше
3. Убедитесь, что все порты свободны (3000, 3001, 5432)
4. Перезапустите PostgreSQL
5. Очистите кеш npm и переустановите зависимости

---

**Удачи в запуске! 🚀**

*P.S. Сохраните этот файл - он пригодится при следующем запуске!*
