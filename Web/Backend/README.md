# NBA Analytics Dashboard Backend

A comprehensive backend API for an NBA analytics dashboard built with Node.js, Express.js, and MongoDB. Features secure user authentication, donation management with leaderboards, and testimonial system.

## 🏀 Features

### Core Functionality
- **Transactions & Leaderboard**: Kickstarter-style donation system with real-time leaderboards
- **User Authentication**: Secure JWT-based authentication with refresh tokens
- **Testimonials**: Public testimonial submission and moderation system
- **Security**: Industry-standard security practices with bcrypt, rate limiting, and input validation

### Technical Features
- **MongoDB Integration**: Scalable NoSQL database with Mongoose ODM
- **Docker Support**: Full containerization with Docker Compose
- **Environment Configuration**: Secure environment variable management
- **Rate Limiting**: Comprehensive rate limiting for different endpoints
- **Input Validation**: Robust validation and sanitization
- **Error Handling**: Centralized error handling with detailed logging
- **API Documentation**: Built-in API documentation and health checks

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Docker & Docker Compose
- MongoDB (if not using Docker)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd nba-analytics-backend
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Using Docker (Recommended)**
   ```bash
   docker-compose up -d
   ```

4. **Or run locally**
   ```bash
   npm install
   npm run dev
   ```

### Environment Variables

```env
# MongoDB Configuration
MONGODB_URI=mongodb://mongo:27017/nba_analytics
MONGODB_USER=nba_user
MONGODB_PASSWORD=secure_password_123

# JWT Configuration  
JWT_SECRET=your-super-secure-jwt-secret-key-min-32-chars
JWT_EXPIRES_IN=24h

# Server Configuration
PORT=5000
NODE_ENV=development

# Security Configuration
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/profile` - Get user profile
- `POST /api/auth/refresh` - Refresh access token

### Donations
- `POST /api/donations` - Submit donation
- `GET /api/donations/leaderboard` - Get leaderboard
- `GET /api/donations/stats` - Get donation statistics
- `GET /api/donations` - Get donations (auth required)

### Testimonials
- `POST /api/testimonials` - Submit testimonial
- `GET /api/testimonials/approved` - Get approved testimonials
- `GET /api/testimonials/featured` - Get featured testimonials
- `GET /api/testimonials/stats/ratings` - Get rating statistics

### System
- `GET /api/health` - Health check
- `GET /api/docs` - API documentation
- `GET /api/status` - System status

## 🏗️ Architecture

```
src/
├── config/          # Configuration files
│   ├── database.js  # MongoDB connection
│   ├── jwt.js       # JWT configuration
│   └── environment.js # Environment variables
├── controllers/     # Request handlers
├── middleware/      # Custom middleware
├── models/          # MongoDB schemas
├── routes/          # API route definitions
├── services/        # Business logic
└── utils/           # Utility functions
```

## 🛡️ Security Features

- **Password Hashing**: bcrypt with configurable rounds
- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Multiple rate limiting strategies
- **Input Validation**: Comprehensive request validation
- **Security Headers**: Helmet.js security headers
- **CORS**: Configurable cross-origin resource sharing
- **Request Sanitization**: XSS protection and input cleaning

## 🐳 Docker Configuration

The application includes a complete Docker setup:

- **Multi-stage build** for optimized production images
- **MongoDB container** with persistent volumes
- **Health checks** for container monitoring
- **Network isolation** for security
- **Environment-based configuration**

## 📝 Development

### Available Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests
- `npm run docker:build` - Build Docker image
- `npm run docker:run` - Start with Docker Compose

### Code Structure
- **Controllers**: Handle HTTP requests and responses
- **Services**: Contain business logic and data processing
- **Models**: Define database schemas and methods
- **Middleware**: Handle authentication, validation, and security
- **Utils**: Shared utilities for logging, error handling, and responses

## 🔧 Configuration

### Rate Limiting
- General API: 100 requests per 15 minutes
- Authentication: 5 attempts per 15 minutes
- Donations: 10 submissions per hour
- Testimonials: 2 submissions per hour

### Security Settings
- Password minimum: 8 characters with complexity requirements
- JWT expiry: 24 hours (configurable)
- bcrypt rounds: 12 (configurable)
- Account lockout: 5 failed attempts, 2-hour lock

## 🚀 Deployment

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Use strong JWT secrets
- [ ] Configure proper MongoDB authentication
- [ ] Set up SSL/TLS termination
- [ ] Configure log rotation
- [ ] Set up monitoring and alerting
- [ ] Review and adjust rate limits
- [ ] Configure backup strategy

### Environment-specific Configuration
The application supports multiple environments with different configurations:
- **Development**: Detailed logging, relaxed security
- **Production**: Optimized performance, strict security
- **Test**: Isolated database, minimal logging

## 📋 API Documentation

Visit `/api/docs` when the server is running for complete API documentation including:
- Available endpoints
- Request/response schemas
- Authentication requirements
- Rate limiting information
- Example requests

## 🔍 Monitoring & Logging

### Health Checks
- **Application**: `/api/health` - Basic application health
- **Database**: `/api/status` - Detailed system status including DB connectivity
- **Docker**: Built-in health check for container monitoring

### Logging
- **Winston**: Structured logging with multiple transports
- **Morgan**: HTTP request logging
- **Error Tracking**: Comprehensive error logging with stack traces
- **Security Events**: Failed login attempts and suspicious activity

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Check the API documentation at `/api/docs`
- Review the health check at `/api/health`
- Check application logs for debugging information

## 🔄 Updates & Maintenance

Regular maintenance tasks:
- Update dependencies
- Review security configurations
- Monitor performance metrics
- Backup database regularly
- Update documentation
