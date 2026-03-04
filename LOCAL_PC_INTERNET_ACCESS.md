# 💻 ЗАПУСК CRM НА ЛИЧНОМ ПК С ДОСТУПОМ ИЗ ИНТЕРНЕТА

## 📋 Содержание
1. [Обзор способов](#обзор-способов)
2. [Способ 1: ngrok (Самый простой - 2 минуты)](#способ-1-ngrok-самый-простой)
3. [Способ 2: LocalTunnel (Бесплатно)](#способ-2-localtunnel)
4. [Способ 3: Cloudflare Tunnel (Профессионально)](#способ-3-cloudflare-tunnel)
5. [Способ 4: Открыть порты на роутере (Постоянный доступ)](#способ-4-открыть-порты-на-роутере)

---

## 🎯 Обзор способов

| Способ | Сложность | Стоимость | Время работы | Рекомендация |
|--------|-----------|-----------|--------------|--------------|
| **ngrok** | ⭐ Очень легко | $0-8/мес | До 8 часов | ✅ Для демонстрации |
| **LocalTunnel** | ⭐ Легко | Бесплатно | Без ограничений | ✅ Для тестирования |
| **Cloudflare Tunnel** | ⭐⭐ Средне | Бесплатно | Постоянно | ✅ Для production |
| **Port Forwarding** | ⭐⭐⭐ Сложно | Бесплатно | Постоянно | Если есть статический IP |

---

## 🚀 Способ 1: ngrok (САМЫЙ ПРОСТОЙ - 2 минуты)

**Идеально для демонстрации заказчику!**

### ✅ Плюсы:
- Очень просто настроить
- HTTPS из коробки
- Красивый URL
- Работает на любой ОС

### ❌ Минусы:
- Бесплатно только 8 часов (потом нужно перезапустить)
- URL меняется при каждом перезапуске (в бесплатной версии)

---

### Шаг 1: Установка ngrok

#### Windows:
1. Скачайте: https://ngrok.com/download
2. Распакуйте `ngrok.exe` в любую папку (например `C:\ngrok`)
3. Добавьте в PATH или запускайте из этой папки

#### macOS:
```bash
brew install ngrok/ngrok/ngrok
```

#### Linux:
```bash
# Скачать
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar -xvzf ngrok-v3-stable-linux-amd64.tgz
sudo mv ngrok /usr/local/bin/
```

---

### Шаг 2: Регистрация (опционально, но рекомендуется)

1. Перейдите на https://ngrok.com/
2. Зарегистрируйтесь (бесплатно)
3. Получите authtoken
4. Выполните команду:

```bash
ngrok config add-authtoken ВАШ_ТОКЕН
```

**Без регистрации:** работает, но сессия ограничена 2 часами.

---

### Шаг 3: Запустите ваш CRM локально

**Терминал 1 - Backend:**
```bash
cd tour-crm/backend
npm run dev
# Должен запуститься на http://localhost:3001
```

**Терминал 2 - Frontend:**
```bash
cd tour-crm/frontend
npm run dev
# Должен запуститься на http://localhost:3000
```

✅ **Убедитесь, что оба сервиса работают локально!**

---

### Шаг 4: Запустите ngrok для Frontend

**Терминал 3 - ngrok для Frontend:**
```bash
ngrok http 3000
```

**Вы увидите:**
```
ngrok                                                                                        

Session Status                online
Account                       ваш_email@gmail.com
Version                       3.0.0
Region                        Europe (eu)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abcd-1234-5678.ngrok-free.app -> http://localhost:3000

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

**Важно:** Скопируйте URL из строки `Forwarding` → это ваш публичный адрес Frontend!

Например: `https://abcd-1234-5678.ngrok-free.app`

---

### Шаг 5: Запустите ngrok для Backend

**Терминал 4 - ngrok для Backend:**
```bash
ngrok http 3001
```

Скопируйте URL Backend, например: `https://efgh-9876-5432.ngrok-free.app`

---

### Шаг 6: Обновите конфигурацию Frontend

**Временно измените `frontend/vite.config.ts`:**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'https://efgh-9876-5432.ngrok-free.app', // ← ВАШ BACKEND URL
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
```

**Перезапустите Frontend:**
```bash
# Остановите (Ctrl+C) и запустите снова
npm run dev
```

---

### Шаг 7: Готово! 🎉

**Отправьте заказчику ссылку на Frontend:**
```
https://abcd-1234-5678.ngrok-free.app
```

**Логин:** admin  
**Пароль:** admin123

---

### ⚠️ Важные моменты ngrok:

1. **При первом открытии** ngrok покажет предупреждение:
   ```
   You are about to visit: https://abcd-1234.ngrok-free.app
   This site is served by ngrok.io
   [Visit Site]
   ```
   Это нормально - просто нажмите **"Visit Site"**

2. **URL меняется** при каждом перезапуске (в бесплатной версии)

3. **Ограничение:** 40 подключений/минуту на бесплатном плане

4. **Веб-интерфейс:** http://localhost:4040 (показывает все запросы)

---

### 💰 Платная версия ngrok ($8/месяц):

- Постоянный URL (custom subdomain)
- Неограниченное время работы
- Больше одновременных туннелей
- Без предупреждений

Для разовой демонстрации **бесплатной версии достаточно!**

---

## 🆓 Способ 2: LocalTunnel (Бесплатно, без ограничений)

**Альтернатива ngrok, полностью бесплатно.**

### Шаг 1: Установка

```bash
npm install -g localtunnel
```

### Шаг 2: Запустите CRM локально

```bash
# Терминал 1 - Backend
cd backend
npm run dev

# Терминал 2 - Frontend  
cd frontend
npm run dev
```

### Шаг 3: Создайте туннели

**Терминал 3 - Frontend туннель:**
```bash
lt --port 3000 --subdomain my-crm-frontend
```

**Терминал 4 - Backend туннель:**
```bash
lt --port 3001 --subdomain my-crm-backend
```

**Вы получите URLs:**
- Frontend: `https://my-crm-frontend.loca.lt`
- Backend: `https://my-crm-backend.loca.lt`

### Шаг 4: Обновите Frontend конфиг

В `frontend/vite.config.ts`:
```typescript
proxy: {
  '/api': {
    target: 'https://my-crm-backend.loca.lt',
    changeOrigin: true,
  },
}
```

### ⚠️ Особенности LocalTunnel:

- **При первом открытии** нужно ввести код подтверждения (показывается на экране)
- Subdomain может быть занят - выберите другой
- Менее стабильно, чем ngrok
- Но полностью бесплатно!

---

## ☁️ Способ 3: Cloudflare Tunnel (Профессионально)

**Лучшее бесплатное решение для постоянного доступа.**

### ✅ Плюсы:
- Бесплатно навсегда
- Стабильно
- HTTPS автоматически
- Можно привязать свой домен
- Без ограничений по времени

### ❌ Минусы:
- Чуть сложнее в настройке

---

### Шаг 1: Установка cloudflared

#### Windows:
1. Скачайте: https://github.com/cloudflare/cloudflared/releases
2. Переименуйте в `cloudflared.exe`
3. Поместите в `C:\cloudflared\`

#### macOS:
```bash
brew install cloudflare/cloudflare/cloudflared
```

#### Linux:
```bash
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

---

### Шаг 2: Авторизация

```bash
cloudflared tunnel login
```

Откроется браузер - войдите в Cloudflare аккаунт (создайте если нет).

---

### Шаг 3: Создание туннеля

```bash
# Создать туннель
cloudflared tunnel create tour-crm

# Вы получите UUID туннеля, запомните его
```

---

### Шаг 4: Создание конфигурационного файла

Создайте файл `~/.cloudflared/config.yml`:

```yaml
tunnel: ВАШ_TUNNEL_UUID
credentials-file: /путь/к/.cloudflared/ВАШ_TUNNEL_UUID.json

ingress:
  # Frontend
  - hostname: tour-crm.your-domain.com
    service: http://localhost:3000
  
  # Backend  
  - hostname: api.tour-crm.your-domain.com
    service: http://localhost:3001
  
  # Catch-all rule
  - service: http_status:404
```

**Без домена можно использовать:**
```yaml
tunnel: ВАШ_TUNNEL_UUID
credentials-file: /путь/к/.cloudflared/ВАШ_TUNNEL_UUID.json

ingress:
  - service: http://localhost:3000
```

---

### Шаг 5: Маршрутизация DNS

```bash
# Для каждого hostname создайте DNS запись
cloudflared tunnel route dns tour-crm tour-crm.your-domain.com
cloudflared tunnel route dns tour-crm api.tour-crm.your-domain.com
```

---

### Шаг 6: Запуск туннеля

```bash
cloudflared tunnel run tour-crm
```

**Или запустить как сервис (будет работать всегда):**

```bash
cloudflared service install
```

---

### Шаг 7: Готово!

Ваш сайт доступен по адресу:
- `https://tour-crm.your-domain.com` (если есть домен)
- Или по временному URL от Cloudflare

---

## 🔓 Способ 4: Открыть порты на роутере (Port Forwarding)

**Для постоянного доступа без посредников.**

### ⚠️ Внимание:
- Нужен статический IP или динамический DNS
- Потенциальные риски безопасности
- Нужен доступ к роутеру

---

### Шаг 1: Узнать локальный IP вашего ПК

#### Windows:
```bash
ipconfig
# Найдите IPv4 адрес, например: 192.168.1.100
```

#### macOS/Linux:
```bash
ifconfig
# или
ip addr show
```

---

### Шаг 2: Настроить Port Forwarding на роутере

1. Откройте веб-интерфейс роутера (обычно `192.168.1.1` или `192.168.0.1`)
2. Войдите (логин/пароль часто на наклейке роутера)
3. Найдите раздел **Port Forwarding** (или **Virtual Server**)
4. Добавьте правила:

```
Внешний порт: 80
Внутренний порт: 3000
Внутренний IP: 192.168.1.100 (ваш IP)
Протокол: TCP

Внешний порт: 3001
Внутренний порт: 3001
Внутренний IP: 192.168.1.100
Протокол: TCP
```

---

### Шаг 3: Узнать внешний IP

```bash
# В браузере откройте:
https://ifconfig.me

# Или:
curl ifconfig.me
```

Это ваш **внешний IP адрес** (например: `203.123.45.67`)

---

### Шаг 4: Доступ к сайту

```
http://203.123.45.67:3000
```

---

### Шаг 5: Настроить HTTPS (опционально)

**Без домена сложно**, но можно:

1. Купить домен ($10/год)
2. Настроить A-запись на ваш IP
3. Использовать Nginx + Let's Encrypt

---

### 📱 Динамический IP?

Если ваш IP меняется, используйте **Dynamic DNS** сервисы:
- **No-IP:** https://www.noip.com/ (бесплатно)
- **DuckDNS:** https://www.duckdns.org/ (бесплатно)
- **Dynu:** https://www.dynu.com/ (бесплатно)

Они дадут вам доменное имя вида: `your-crm.ddns.net`

---

## 📊 Сравнение способов

| Параметр | ngrok | LocalTunnel | Cloudflare | Port Forwarding |
|----------|-------|-------------|------------|-----------------|
| **Настройка** | 2 минуты | 2 минуты | 10 минут | 20 минут |
| **Стоимость** | $0-8/мес | Бесплатно | Бесплатно | Бесплатно |
| **HTTPS** | ✅ Авто | ✅ Авто | ✅ Авто | ❌ Сложно |
| **Стабильность** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Время работы** | 8 часов* | ∞ | ∞ | ∞ |
| **Кастомный URL** | Платно | Нет | ✅ | Свой домен |
| **Безопасность** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

*На бесплатном плане*

---

## 🎯 Мои рекомендации

### Для разовой демонстрации (1-2 часа):
→ **ngrok** (бесплатно, 2 минуты настройки)

### Для тестирования (несколько дней):
→ **LocalTunnel** (бесплатно навсегда)

### Для постоянного использования:
→ **Cloudflare Tunnel** (бесплатно, профессионально)

### Если есть статический IP:
→ **Port Forwarding** + Nginx

---

## ✅ Быстрая инструкция (ngrok - 2 минуты)

```bash
# 1. Установите ngrok
# Windows: скачайте с ngrok.com/download
# macOS: brew install ngrok/ngrok/ngrok
# Linux: wget + установка (см. выше)

# 2. Запустите CRM локально
cd tour-crm/backend && npm run dev  # Терминал 1
cd tour-crm/frontend && npm run dev # Терминал 2

# 3. Запустите ngrok для Frontend
ngrok http 3000  # Терминал 3
# Скопируйте URL: https://xxxx.ngrok-free.app

# 4. Запустите ngrok для Backend
ngrok http 3001  # Терминал 4
# Скопируйте URL: https://yyyy.ngrok-free.app

# 5. Обновите frontend/vite.config.ts
# Измените proxy target на Backend URL

# 6. Перезапустите Frontend
# Ctrl+C в терминале 2, затем npm run dev

# 7. Отправьте заказчику Frontend URL
# https://xxxx.ngrok-free.app
```

**Время: 2-5 минут**  
**Стоимость: Бесплатно**  
**Работает до: 8 часов (потом просто перезапустить)**

---

## 🔒 Безопасность

### Важные моменты:

1. **Смените пароль админа** перед демонстрацией
2. **Используйте HTTPS** (ngrok/Cloudflare дают автоматически)
3. **Не оставляйте открытым 24/7** если не нужно
4. **Не выкладывайте URL публично**
5. **Закройте туннель** после демонстрации (Ctrl+C)

---

## 🐛 Решение проблем

### ngrok говорит "tunnel not found":
```bash
# Зарегистрируйтесь и добавьте authtoken
ngrok config add-authtoken YOUR_TOKEN
```

### "This site can't be reached":
- Убедитесь, что CRM запущен локально
- Проверьте порты (3000, 3001)
- Перезапустите ngrok

### Frontend не подключается к Backend:
- Проверьте `vite.config.ts` proxy
- Убедитесь, что Backend URL правильный
- Перезапустите Frontend

### Медленная загрузка:
- Это нормально для ngrok/tunnels
- Зависит от вашего интернет соединения
- Для production используйте облачный хостинг

---

## 📞 Нужна помощь?

**Самый простой способ (рекомендую):**
1. Скачайте ngrok
2. Запустите `ngrok http 3000`
3. Скопируйте URL
4. Готово!

**Если не получается:**
- Проверьте, что CRM работает на localhost:3000
- Убедитесь, что ngrok запущен
- Посмотрите логи ngrok

---

## 💡 Полезные команды

### Проверить занятость портов:

**Windows:**
```bash
netstat -ano | findstr :3000
netstat -ano | findstr :3001
```

**macOS/Linux:**
```bash
lsof -i :3000
lsof -i :3001
```

### Освободить порт:

**Windows:**
```bash
taskkill /PID [номер_процесса] /F
```

**macOS/Linux:**
```bash
kill -9 [номер_процесса]
```

---

## 🎓 После демонстрации

Когда закончите показ:

1. **Остановите ngrok** (Ctrl+C в терминалах 3 и 4)
2. **Остановите CRM** (Ctrl+C в терминалах 1 и 2)
3. **Верните vite.config.ts** к исходному виду

**Если понравилось заказчику:**
→ Разверните на облачном хостинге (Railway/Render)  
→ См. `DEPLOYMENT_GUIDE.md`

---

**Готово! Теперь ваш CRM доступен из интернета! 🌐**

*P.S. Для разовой демонстрации ngrok - идеальное решение!*
