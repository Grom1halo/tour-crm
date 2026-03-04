#!/bin/bash

echo "================================"
echo "Tour CRM - Quick Start Script"
echo "================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    echo "Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"
echo ""

echo "🚀 Starting Tour CRM services..."
echo ""

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose down

# Build and start services
echo "🔨 Building and starting services..."
docker-compose up -d --build

# Wait for services to be healthy
echo ""
echo "⏳ Waiting for services to start..."
sleep 10

# Check if services are running
if docker-compose ps | grep -q "Up"; then
    echo ""
    echo "================================"
    echo "✅ Tour CRM is running!"
    echo "================================"
    echo ""
    echo "📱 Frontend: http://localhost:3000"
    echo "🔌 Backend API: http://localhost:3001"
    echo "🗄️  Database: localhost:5432"
    echo ""
    echo "🔐 Demo Login:"
    echo "   Username: admin"
    echo "   Password: admin123"
    echo ""
    echo "📝 View logs:"
    echo "   docker-compose logs -f"
    echo ""
    echo "🛑 Stop services:"
    echo "   docker-compose down"
    echo ""
else
    echo ""
    echo "❌ Failed to start services. Check logs:"
    echo "   docker-compose logs"
    exit 1
fi
