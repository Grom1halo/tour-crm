#!/bin/bash

echo "================================"
echo "Tour CRM - Quick Demo with ngrok"
echo "================================"
echo ""

# Проверка что ngrok установлен
if ! command -v ngrok &> /dev/null; then
    echo "❌ ERROR: ngrok not found!"
    echo ""
    echo "Please install ngrok:"
    echo "  macOS: brew install ngrok/ngrok/ngrok"
    echo "  Linux: see https://ngrok.com/download"
    echo ""
    exit 1
fi

# Проверка что мы в правильной директории
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "❌ ERROR: Please run this script from tour-crm root directory"
    exit 1
fi

echo "✅ ngrok found"
echo ""

# Функция для остановки всех процессов
cleanup() {
    echo ""
    echo "Stopping all services..."
    pkill -f "npm run dev"
    pkill -f "ngrok http"
    echo "✅ All services stopped"
    exit 0
}

# Перехват Ctrl+C
trap cleanup INT TERM

echo "[1/5] Starting Backend..."
cd backend
npm run dev > /tmp/tour-crm-backend.log 2>&1 &
BACKEND_PID=$!
cd ..
echo "⏳ Waiting for backend..."
sleep 10

echo ""
echo "[2/5] Starting Frontend..."
cd frontend
npm run dev > /tmp/tour-crm-frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..
echo "⏳ Waiting for frontend..."
sleep 10

echo ""
echo "[3/5] Starting ngrok for Frontend (port 3000)..."
ngrok http 3000 > /tmp/tour-crm-ngrok-frontend.log 2>&1 &
NGROK_FRONTEND_PID=$!
sleep 3

echo ""
echo "[4/5] Starting ngrok for Backend (port 3001)..."
ngrok http 3001 > /tmp/tour-crm-ngrok-backend.log 2>&1 &
NGROK_BACKEND_PID=$!
sleep 3

echo ""
echo "================================"
echo "✅ READY! All services started"
echo "================================"
echo ""
echo "📋 Get your URLs:"
echo ""
echo "Frontend ngrok: http://localhost:4040"
echo "Backend ngrok:  http://localhost:4041"
echo ""
echo "Or get URLs from ngrok API:"
echo ""

# Попробовать получить URLs из ngrok API
sleep 2
FRONTEND_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o 'https://[^"]*ngrok[^"]*' | head -1)
BACKEND_URL=$(curl -s http://localhost:4041/api/tunnels | grep -o 'https://[^"]*ngrok[^"]*' | head -1)

if [ ! -z "$FRONTEND_URL" ]; then
    echo "🌐 Frontend URL: $FRONTEND_URL"
else
    echo "🌐 Frontend URL: Check http://localhost:4040"
fi

if [ ! -z "$BACKEND_URL" ]; then
    echo "🔌 Backend URL: $BACKEND_URL"
else
    echo "🔌 Backend URL: Check http://localhost:4041"
fi

echo ""
echo "================================"
echo "📝 Next steps:"
echo "================================"
echo ""
echo "1. Copy Backend URL from above"
echo ""
echo "2. Update frontend/vite.config.ts:"
echo "   proxy: {"
echo "     '/api': {"
echo "       target: 'YOUR_BACKEND_URL',"
echo "       ..."
echo "     }"
echo "   }"
echo ""
echo "3. Restart Frontend:"
echo "   - Kill the frontend process"
echo "   - cd frontend && npm run dev"
echo ""
echo "4. Send Frontend URL to your client!"
echo ""
echo "================================"
echo "Press Ctrl+C to stop all services"
echo "================================"
echo ""

# Держать скрипт запущенным
wait
