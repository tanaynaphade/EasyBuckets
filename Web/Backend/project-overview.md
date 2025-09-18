
# NBA Analytics Dashboard Backend - Complete File Structure

## 📁 Project Overview

This is a complete, production-ready Node.js backend built for an NBA analytics dashboard. The system includes:
- 🔐 JWT Authentication with refresh tokens
- 💰 Donation system with leaderboards  
- ⭐ Testimonial management with moderation
- 🐳 Full Docker containerization
- 🛡️ Industry-standard security practices
- 📊 Comprehensive monitoring and logging

## 📂 Complete Directory Structure

```
nba-analytics-backend/
├── 📁 src/
│   ├── 📁 config/
│   │   ├── database.js          # MongoDB connection and management
│   │   ├── jwt.js               # JWT token handling and verification
│   │   └── environment.js       # Environment variable validation
│   │
│   ├── 📁 controllers/
│   │   ├── authController.js    # Authentication endpoints
│   │   ├── donationController.js # Donation management endpoints
│   │   └── testimonialController.js # Testimonial CRUD endpoints
│   │
│   ├── 📁 middleware/
│   │   ├── auth.js              # JWT authentication middleware
│   │   ├── rateLimiter.js       # Rate limiting configurations  
│   │   ├── security.js          # Security headers and CORS
│   │   └── validation.js        # Input validation and sanitization
│   │
│   ├── 📁 models/
│   │   ├── User.js              # User schema with auth features
│   │   ├── Donation.js          # Donation schema with aggregations
│   │   └── Testimonial.js       # Testimonial schema with moderation
│   │
│   ├── 📁 routes/
│   │   ├── authRoutes.js        # Authentication route definitions
│   │   ├── donationRoutes.js    # Donation route definitions  
│   │   ├── testimonialRoutes.js # Testimonial route definitions
│   │   └── index.js             # Main route aggregator
│   │
│   ├── 📁 services/
│   │   ├── authService.js       # Authentication business logic
│   │   ├── donationService.js   # Donation business logic
│   │   └── testimonialService.js # Testimonial business logic
│   │
│   └── 📁 utils/
│       ├── errorHandler.js      # Centralized error handling
│       ├── logger.js            # Winston logging configuration
│       └── responseHandler.js   # Standardized API responses
│
├── 📄 app.js                    # Express application setup
├── 📄 server.js                 # Server initialization  
├── 📄 package.json              # Dependencies and scripts
├── 📄 docker-compose.yml        # Multi-container setup
├── 📄 Dockerfile                # Container build instructions
├── 📄 healthcheck.js            # Docker health check script
├── 📄 .env.example              # Environment variables template
├── 📄 .gitignore               # Git ignore patterns
└── 📄 README.md                # Complete documentation
```

## 🎯 Key Features Implementation

### 1. Authentication System
- **JWT Access Tokens**: Short-lived (24h) with user claims
- **Refresh Tokens**: Long-lived (7d) for token renewal  
- **Account Security**: Login attempt limits and account lockout
- **Password Hashing**: bcrypt with configurable salt rounds
- **Role-based Access**: User, moderator, admin permissions

### 2. Donation Management
- **Transaction Storage**: Complete donation records with metadata
- **Payment Methods**: Support for multiple payment processors
- **Leaderboard System**: Real-time top donor rankings
- **Analytics**: Revenue tracking and donation trends
- **Status Management**: Pending, completed, failed, refunded states

### 3. Testimonial System  
- **Public Submission**: No authentication required for submissions
- **Moderation Workflow**: Admin approval process with notes
- **Rating System**: 1-5 star ratings with statistics
- **Featured Content**: Ability to highlight testimonials
- **Analytics**: Review trends and approval rates

### 4. Security & Performance
- **Rate Limiting**: Endpoint-specific limits (5-100 req/15min)
- **Input Validation**: Comprehensive request validation
- **Security Headers**: Helmet.js with CSP and HSTS
- **CORS Configuration**: Environment-specific origin control
- **Request Sanitization**: XSS and injection protection

### 5. Infrastructure
- **MongoDB**: Scalable document database with indexes
- **Docker**: Full containerization with compose
- **Health Checks**: Application and database monitoring
- **Logging**: Structured logging with Winston
- **Error Handling**: Centralized error management

## 🚀 Quick Start Commands

```bash
# 1. Clone and setup
git clone <repository-url>
cd nba-analytics-backend
cp .env.example .env

# 2. Edit environment variables
nano .env

# 3. Start with Docker (recommended)
docker-compose up -d

# 4. Or start locally
npm install
npm run dev

# 5. Test the API
curl http://localhost:5000/api/health
```

## 📊 Environment Configuration

### Required Variables
```env
MONGODB_URI=mongodb://mongo:27017/nba_analytics
MONGODB_USER=nba_user  
MONGODB_PASSWORD=secure_password_123
JWT_SECRET=your-super-secure-jwt-secret-key-min-32-chars
PORT=5000
NODE_ENV=development
```

### Security Variables
```env
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
ALLOWED_ORIGINS=http://localhost:3000
```

## 🔗 API Endpoints Summary

### Authentication (`/api/auth`)
- `POST /register` - User registration
- `POST /login` - User authentication  
- `GET /profile` - User profile
- `POST /logout` - Session termination

### Donations (`/api/donations`)
- `POST /` - Submit donation
- `GET /leaderboard` - Top donors
- `GET /stats` - Revenue analytics
- `GET /` - All donations (admin)

### Testimonials (`/api/testimonials`)
- `POST /` - Submit review
- `GET /approved` - Public testimonials
- `GET /featured` - Featured reviews
- `PATCH /:id/approve` - Moderate (admin)

### System (`/api`)
- `GET /health` - Service health
- `GET /docs` - API documentation
- `GET /status` - Detailed status

## 🛠️ Development Tools

### Available Scripts
```json
{
  "start": "node server.js",
  "dev": "nodemon server.js", 
  "test": "jest",
  "docker:build": "docker build -t nba-analytics-backend .",
  "docker:run": "docker-compose up -d",
  "docker:stop": "docker-compose down"
}
```

### Dependencies Used
- **Framework**: Express.js 4.18.2
- **Database**: Mongoose 7.5.0  
- **Authentication**: jsonwebtoken 9.0.2
- **Security**: bcrypt 5.1.1, helmet 7.0.0
- **Validation**: express-validator 7.0.1
- **Logging**: winston 3.10.0
- **Rate Limiting**: express-rate-limit 6.10.0

## 📈 Production Considerations

### Performance
- Connection pooling for MongoDB
- Compression middleware for responses
- Request timeout handling
- Memory usage monitoring

### Security  
- Environment-based secrets
- Input sanitization on all endpoints
- Rate limiting per endpoint type
- Security headers with CSP
- Account lockout mechanisms

### Monitoring
- Health check endpoints
- Structured logging with Winston
- Error tracking and alerting
- Database connection monitoring
- Performance metrics collection

### Scalability
- Stateless authentication (JWT)
- Database connection pooling
- Horizontal scaling ready
- Load balancer compatible
- Caching layer ready (Redis)

This backend provides a solid foundation for an NBA analytics platform with room for expansion into features like real-time data feeds, analytics dashboards, and user-generated content moderation.
