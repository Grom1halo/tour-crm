# ⚡ БЫСТРЫЙ ДЕПЛОЙ - ШПАРГАЛКА

## 🎯 Самый быстрый способ (Railway - 5 минут)

### 1. Загрузите на GitHub
```bash
git init
git add .
git commit -m "Tour CRM MVP"
git remote add origin https://github.com/USERNAME/tour-crm-mvp.git
git push -u origin main
```

### 2. Зарегистрируйтесь на Railway
https://railway.app/ → Sign up with GitHub

### 3. Создайте проект
"New Project" → "Deploy from GitHub" → выберите `tour-crm-mvp`

### 4. Добавьте PostgreSQL
"+ New" → "Database" → "PostgreSQL"

### 5. Настройте Backend
Откройте Backend Service → Variables:
```env
NODE_ENV=production
PORT=3001
DATABASE_URL=<копируйте из PostgreSQL>
JWT_SECRET=random-secret-key-here
```

### 6. Примените SQL схему
```bash
# Скопируйте DATABASE_URL из Railway PostgreSQL
psql "postgres://..." -f database/schema.sql
psql "postgres://..." -f database/test_data.sql
```

### 7. Настройте Frontend
Variables:
```env
VITE_API_URL=https://your-backend.railway.app/api
```

### 8. Готово! 🎉
Railway даст вам URL: `https://tour-crm-xxxx.railway.app`

---

## 💰 Стоимость

| Платформа | Стоимость | План |
|-----------|-----------|------|
| Railway | $5/мес + usage | Hobby Plan |
| Render | $0 (с ограничениями) | Free |
| Render | $7/мес | Starter |
| DigitalOcean | $12-20/мес | Basic |
| VPS (Hetzner) | €4/мес | Самостоятельно |

---

## 🔑 Важные переменные окружения

### Backend:
```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
```

### Frontend:
```env
VITE_API_URL=https://your-backend-url.com/api
```

---

## 📋 Чеклист перед деплоем

- [ ] Код загружен на GitHub (Private repo)
- [ ] .env файлы НЕ загружены (в .gitignore)
- [ ] PostgreSQL база создана
- [ ] SQL схема применена
- [ ] Backend переменные настроены
- [ ] Frontend переменные настроены
- [ ] SSL включён (Railway/Render делают автоматически)

---

## 🚀 После деплоя

1. Откройте ваш URL
2. Войдите: admin / admin123
3. **СРАЗУ СМЕНИТЕ ПАРОЛЬ!**
4. Отправьте ссылку заказчику

---

## 🐛 Проблемы?

### Backend не запускается:
- Проверьте логи в Railway/Render
- Убедитесь, что DATABASE_URL правильный
- Проверьте, что порт = 3001

### Frontend показывает ошибки:
- Проверьте VITE_API_URL
- Убедитесь, что Backend запущен
- Откройте DevTools (F12) → Console

### База данных пуста:
- Примените schema.sql и test_data.sql
- Проверьте connection string

---

## 📞 Нужна помощь?

Смотрите полный гайд: **DEPLOYMENT_GUIDE.md**

---

**Время деплоя: 5-10 минут** ⏱️
