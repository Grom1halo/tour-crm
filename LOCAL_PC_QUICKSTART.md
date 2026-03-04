# ⚡ ЗАПУСК НА ЛИЧНОМ ПК - ШПАРГАЛКА

## 🎯 Самый быстрый способ (ngrok - 2 минуты)

### Windows:

```bash
# 1. Установите ngrok
# Скачайте: https://ngrok.com/download
# Распакуйте ngrok.exe

# 2. Запустите автоматический скрипт
start-demo-windows.bat

# 3. Или вручную:
cd backend
start cmd /k "npm run dev"

cd ..\frontend
start cmd /k "npm run dev"

ngrok http 3000  # В новом окне
ngrok http 3001  # В новом окне
```

### macOS/Linux:

```bash
# 1. Установите ngrok
brew install ngrok/ngrok/ngrok

# 2. Запустите автоматический скрипт
./start-demo.sh

# 3. Или вручную:
cd backend && npm run dev &
cd frontend && npm run dev &
ngrok http 3000 &
ngrok http 3001 &
```

---

## 📋 Пошаговая инструкция

### Шаг 1: Запустите Backend
```bash
cd tour-crm/backend
npm run dev
# ✅ Должно показать: "Database connected"
```

### Шаг 2: Запустите Frontend (новый терминал)
```bash
cd tour-crm/frontend
npm run dev
# ✅ Должно показать: "ready in ... ms"
```

### Шаг 3: Запустите ngrok для Frontend (новый терминал)
```bash
ngrok http 3000
# ✅ Скопируйте URL: https://xxxx.ngrok-free.app
```

### Шаг 4: Запустите ngrok для Backend (новый терминал)
```bash
ngrok http 3001
# ✅ Скопируйте URL: https://yyyy.ngrok-free.app
```

### Шаг 5: Обновите Frontend конфигурацию

Откройте `frontend/vite.config.ts`:

```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'https://yyyy.ngrok-free.app', // ← ВАШ BACKEND URL
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
```

### Шаг 6: Перезапустите Frontend
```bash
# В терминале Frontend:
# Нажмите Ctrl+C
npm run dev
```

### Шаг 7: Отправьте ссылку заказчику
```
https://xxxx.ngrok-free.app

Логин: admin
Пароль: admin123
```

---

## 🕐 Время работы

| Вариант | Время | Ограничения |
|---------|-------|-------------|
| **ngrok (бесплатно)** | 8 часов | После - перезапустить |
| **ngrok (платно $8/мес)** | ∞ | Постоянный URL |
| **LocalTunnel** | ∞ | Бесплатно, но менее стабильно |
| **Cloudflare Tunnel** | ∞ | Бесплатно, но сложнее настроить |

---

## ✅ Чеклист

- [ ] Node.js и PostgreSQL установлены
- [ ] CRM работает локально (localhost:3000)
- [ ] ngrok установлен
- [ ] Backend ngrok запущен (получен URL)
- [ ] Frontend ngrok запущен (получен URL)
- [ ] vite.config.ts обновлён с Backend URL
- [ ] Frontend перезапущен
- [ ] Ссылка отправлена заказчику

---

## 🐛 Проблемы?

### "ngrok: command not found"
→ Установите ngrok или добавьте в PATH

### Frontend не грузится
→ Проверьте, что localhost:3000 работает

### Backend ошибки
→ Проверьте, что PostgreSQL запущен

### "This site can't be reached"
→ Убедитесь, что CRM работает локально

---

## 🛑 Остановка

```bash
# Остановите все терминалы (Ctrl+C):
# 1. Backend
# 2. Frontend
# 3. ngrok Frontend
# 4. ngrok Backend
```

---

## 💡 Советы

- **Веб-интерфейс ngrok:** http://localhost:4040
- **При первом открытии** ngrok покажет предупреждение - это нормально
- **URL меняется** при каждом перезапуске (бесплатная версия)
- **Для production** используйте облачный хостинг

---

## 📞 Альтернативы ngrok

### LocalTunnel (бесплатно):
```bash
npm install -g localtunnel
lt --port 3000
```

### Cloudflare Tunnel (бесплатно):
```bash
cloudflared tunnel --url http://localhost:3000
```

---

**Время настройки: 2-5 минут**  
**Полный гайд:** `LOCAL_PC_INTERNET_ACCESS.md`
