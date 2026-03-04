# Tour Tour Phuket CRM System

Полнофункциональная CRM-система для управления клиентами, ваучерами и финансовой отчетностью турагентства.

## 🚀 Технологии

### Backend
- Node.js + Express + TypeScript
- PostgreSQL (база данных)
- JWT аутентификация
- bcrypt для паролей

### Frontend
- React 18 + TypeScript
- Vite (сборщик)
- Tailwind CSS
- React Router
- Axios

## 📋 Функционал

### Реализовано в прототипе:

✅ **Аутентификация и роли**
- Логин/Logout
- 4 роли: Manager, Hotline, Accountant, Admin
- Разграничение доступа по ролям

✅ **Управление клиентами**
- Создание/редактирование/удаление
- Поиск по имени и телефону
- Привязка к менеджеру

✅ **Управление ваучерами**
- Создание ваучеров (Group Tour, Individual Tour, TourFlot)
- Редактирование ваучеров
- Автоматический расчёт Total Net/Sale
- Фильтры по дате, статусу оплаты, компании
- Поиск по номеру, телефону, компании
- Soft delete (корзина) с восстановлением
- Копирование ваучеров

✅ **Управление платежами**
- Добавление платежей к ваучеру
- Автоматический расчёт статуса оплаты
- Расчёт Cash on Tour

✅ **Справочники (Admin)**
- Компании (туроператоры)
- Туры
- Цены на туры с периодами действия
- Агенты с комиссиями

### Запланировано для расширения:

⏳ Генерация PDF ваучеров
⏳ Отчёты для бухгалтера (Payments Report)
⏳ Расчёт зарплат менеджеров
⏳ Расчёт комиссий агентов
⏳ Экспорт в Excel
⏳ Импорт клиентов из Excel
⏳ Управление пользователями

## 🛠 Установка и запуск

### Требования

- Node.js 18+ 
- PostgreSQL 14+
- npm или yarn

### 1. Клонируйте проект

```bash
cd /path/to/tour-crm
```

### 2. Настройка базы данных

```bash
# Создайте базу данных PostgreSQL
createdb tour_crm

# Или через psql:
psql -U postgres
CREATE DATABASE tour_crm;
\q

# Примените SQL схему
psql -U postgres -d tour_crm -f database/schema.sql
```

### 3. Настройка Backend

```bash
cd backend

# Установите зависимости
npm install

# Настройте .env файл (уже создан, проверьте параметры)
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=tour_crm
# DB_USER=postgres
# DB_PASSWORD=postgres

# Запустите сервер в dev режиме
npm run dev
```

Backend запустится на `http://localhost:3001`

### 4. Настройка Frontend

Откройте новый терминал:

```bash
cd frontend

# Установите зависимости
npm install

# Запустите dev сервер
npm run dev
```

Frontend запустится на `http://localhost:3000`

### 5. Откройте браузер

Перейдите на `http://localhost:3000`

**Демо логин:**
- Username: `admin`
- Password: `admin123`

## 📊 Структура базы данных

### Основные таблицы:

- `users` - пользователи системы (менеджеры, админы, бухгалтеры)
- `clients` - клиенты турагентства
- `companies` - компании-туроператоры (партнеры)
- `tours` - список туров
- `tour_prices` - цены на туры с периодами действия
- `agents` - агенты-партнеры с комиссиями
- `vouchers` - ваучеры (основная сущность)
- `payments` - платежи по ваучерам
- `voucher_accounting` - дополнительные данные для бухгалтерии

### Автоматические расчёты (PostgreSQL triggers):

- `Total Net Price` = (Adults × Adult Net) + (Children × Child Net) + (Infants × Infant Net) + ((Adults + Children) × Transfer Net) + Other Net
- `Total Sale Price` = аналогично для Sale цен
- `Paid to Agency` = сумма всех платежей
- `Cash on Tour` = Total Sale - Paid to Agency
- `Payment Status` = автоматически обновляется при добавлении платежей

## 🔐 Роли и права доступа

### Manager (Менеджер)
- Видит только своих клиентов и ваучеры
- Создаёт/редактирует клиентов
- Создаёт/редактирует/удаляет свои ваучеры
- Добавляет платежи
- Копирует ваучеры

### Hotline (Горячая линия)
- Видит всех клиентов и все ваучеры
- НЕ может редактировать/создавать/удалять

### Accountant (Бухгалтер)
- Работает с отчётами (в разработке)
- Может редактировать финансовые данные

### Admin (Администратор)
- Полный доступ ко всему
- Управление справочниками
- Управление пользователями
- Видит корзину всех менеджеров

## 📁 Структура проекта

```
tour-crm/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.ts
│   │   ├── controllers/
│   │   │   ├── authController.ts
│   │   │   ├── clientController.ts
│   │   │   ├── voucherController.ts
│   │   │   ├── paymentController.ts
│   │   │   └── referenceController.ts
│   │   ├── middleware/
│   │   │   └── auth.ts
│   │   ├── routes/
│   │   │   └── index.ts
│   │   └── server.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── index.ts
│   │   ├── components/
│   │   │   └── Layout.tsx
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── VouchersPage.tsx
│   │   │   ├── VoucherFormPage.tsx
│   │   │   └── ClientsPage.tsx
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── database/
│   └── schema.sql
└── README.md
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/login` - логин
- `GET /api/auth/me` - текущий пользователь

### Clients
- `GET /api/clients` - список клиентов
- `POST /api/clients` - создать клиента
- `PUT /api/clients/:id` - обновить клиента
- `DELETE /api/clients/:id` - удалить клиента

### Vouchers
- `GET /api/vouchers` - список ваучеров (с фильтрами)
- `GET /api/vouchers/:id` - получить ваучер
- `POST /api/vouchers` - создать ваучер
- `PUT /api/vouchers/:id` - обновить ваучер
- `DELETE /api/vouchers/:id` - удалить (в корзину)
- `POST /api/vouchers/:id/restore` - восстановить
- `POST /api/vouchers/:id/copy` - копировать
- `GET /api/vouchers/prices/lookup` - получить цены на дату

### Payments
- `POST /api/payments` - добавить платёж
- `PUT /api/payments/:id` - обновить платёж
- `DELETE /api/payments/:id` - удалить платёж

### Reference Data (Admin only)
- Companies: `GET/POST/PUT /api/companies`
- Tours: `GET/POST/PUT /api/tours`
- Tour Prices: `GET/POST/PUT /api/tour-prices`
- Agents: `GET/POST/PUT /api/agents`

## 🎯 Следующие шаги для разработки

1. **Генерация PDF ваучеров** - дизайн для 3 типов туров
2. **Payments Report** - главный отчёт для бухгалтера
3. **Автоподгрузка цен** - при выборе тура и даты
4. **Управление пользователями** - CRUD для админа
5. **Импорт/Экспорт Excel** - клиенты и отчёты
6. **Mobile optimization** - улучшить адаптивность
7. **Тесты** - покрыть критический функционал

## 📝 Примечания

- Пароль для демо админа: `admin123` (в продакшене использовать bcrypt)
- Все даты в формате ISO 8601
- Валюта: Thai Baht (฿)
- Автонумерация ваучеров: V[YY][MM][####] (например V2502-0001)

## 🐛 Known Issues

- Нет валидации форм на стороне клиента
- Нет обработки ошибок загрузки данных
- Нет пагинации (лимит 100-200 записей)
- Нет кеширования запросов

## 📞 Поддержка

Для вопросов и предложений обращайтесь к разработчику проекта.

---

**Версия:** 1.0.0 (MVP)  
**Дата:** February 2026  
**Разработчик:** Claude + Your Team
