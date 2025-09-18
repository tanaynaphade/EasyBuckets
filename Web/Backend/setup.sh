#!/bin/bash

# NBA Analytics Backend Setup Script
# This script sets up the complete development environment

echo "🏀 NBA Analytics Backend Setup"
echo "=============================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

echo "✅ Node.js $(node --version) found"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker and try again."
    exit 1
fi

echo "✅ Docker $(docker --version | cut -d' ' -f3 | cut -d',' -f1) found"

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose and try again."
    exit 1
fi

echo "✅ Docker Compose $(docker-compose --version | cut -d' ' -f3 | cut -d',' -f1) found"

# Create project directory if it doesn't exist
echo "📁 Setting up project structure..."
mkdir -p logs
mkdir -p mongo-init

# Set up environment file
if [ ! -f .env ]; then
    echo "🔧 Creating environment configuration..."
    cp .env.example .env
    echo "✅ Created .env file from template"
    echo "⚠️  Please edit .env with your specific configuration before starting"
else
    echo "✅ Environment file already exists"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Create MongoDB initialization script
cat > mongo-init/init-mongo.js << 'EOF'
// MongoDB initialization script for NBA Analytics
db = db.getSiblingDB('nba_analytics');

// Create collections with validation
db.createCollection('users', {
   validator: {
      $jsonSchema: {
         bsonType: "object",
         required: ["name", "email", "password"],
         properties: {
            name: {
               bsonType: "string",
               description: "must be a string and is required"
            },
            email: {
               bsonType: "string", 
               pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$",
               description: "must be a valid email and is required"
            },
            password: {
               bsonType: "string",
               description: "must be a string and is required"
            }
         }
      }
   }
});

db.createCollection('donations', {
   validator: {
      $jsonSchema: {
         bsonType: "object",
         required: ["donorName", "donorEmail", "amount"],
         properties: {
            amount: {
               bsonType: "number",
               minimum: 1,
               description: "must be a number greater than 0"
            }
         }
      }
   }
});

db.createCollection('testimonials');

// Create indexes for better performance
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "createdAt": -1 });
db.donations.createIndex({ "donorEmail": 1 });
db.donations.createIndex({ "amount": -1 });
db.donations.createIndex({ "status": 1 });
db.testimonials.createIndex({ "rating": -1 });
db.testimonials.createIndex({ "isApproved": 1, "isVisible": 1 });

print('NBA Analytics database initialized successfully!');
EOF

echo "✅ Created MongoDB initialization script"

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration:"
echo "   nano .env"
echo ""
echo "2. Start the application with Docker:"
echo "   docker-compose up -d"
echo ""
echo "3. Or start locally (make sure MongoDB is running):"
echo "   npm run dev"
echo ""
echo "4. Test the API:"
echo "   curl http://localhost:5000/api/health"
echo ""
echo "5. View API documentation:"
echo "   http://localhost:5000/api/docs"
echo ""
echo "📚 For detailed information, see README.md"
echo "🐳 Docker logs: docker-compose logs -f"
echo "🔍 Health check: http://localhost:5000/api/health"
