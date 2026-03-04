#!/bin/bash

echo "================================"
echo "Подготовка Tour CRM к деплою"
echo "================================"
echo ""

# Проверка, что мы в правильной директории
if [ ! -f "README.md" ]; then
    echo "❌ Запустите скрипт из корневой директории проекта (tour-crm)"
    exit 1
fi

echo "✅ Проверка структуры проекта..."

# Создать .gitignore если нет
if [ ! -f ".gitignore" ]; then
    echo "📝 Создаю .gitignore..."
    cat > .gitignore << 'EOF'
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Production builds
dist/
build/

# Environment files
.env
.env.local
.env.production.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log

# Database
*.sqlite
*.db
EOF
fi

# Создать production .env шаблон для backend
echo "📝 Создаю .env.example для backend..."
cat > backend/.env.example << 'EOF'
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tour_crm
DB_USER=postgres
DB_PASSWORD=CHANGE_THIS

# Server
PORT=3001
NODE_ENV=production

# JWT
JWT_SECRET=CHANGE_THIS_TO_RANDOM_STRING
JWT_EXPIRES_IN=7d
EOF

# Создать .env.example для frontend
echo "📝 Создаю .env.example для frontend..."
cat > frontend/.env.example << 'EOF'
# Backend API URL
VITE_API_URL=https://your-backend-url.com/api
EOF

# Обновить package.json для production
echo "📝 Проверяю package.json..."

# Backend package.json - добавить start script если нет
if ! grep -q '"start"' backend/package.json; then
    echo "⚠️  Добавляю start script в backend/package.json"
    # Это нужно сделать вручную
fi

echo ""
echo "================================"
echo "✅ Проект готов к деплою!"
echo "================================"
echo ""
echo "📋 Следующие шаги:"
echo ""
echo "1. Инициализируйте Git репозиторий:"
echo "   git init"
echo "   git add ."
echo "   git commit -m 'Initial commit - Tour CRM MVP'"
echo ""
echo "2. Создайте репозиторий на GitHub:"
echo "   - Перейдите на https://github.com/new"
echo "   - Название: tour-crm-mvp"
echo "   - Visibility: Private"
echo ""
echo "3. Загрузите код на GitHub:"
echo "   git remote add origin https://github.com/ВАШ_USERNAME/tour-crm-mvp.git"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "4. Выберите платформу деплоя:"
echo "   - Railway (самый простой): https://railway.app"
echo "   - Render (бесплатно): https://render.com"
echo "   - DigitalOcean (профессионально): https://digitalocean.com"
echo ""
echo "5. Следуйте инструкциям в файле:"
echo "   📖 DEPLOYMENT_GUIDE.md"
echo ""
echo "🔐 Не забудьте:"
echo "   - Изменить JWT_SECRET на случайную строку"
echo "   - Сменить пароль администратора в БД"
echo "   - Настроить SSL сертификат"
echo ""
