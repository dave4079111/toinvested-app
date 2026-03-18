# ToInvested.com

AI-Powered Investment Platform for Real Estate, Stocks, and Crypto.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your settings

# 3. Start the server
npm start

# Server runs at http://localhost:3000
# Admin panel at http://localhost:3000/admin
```

## Features

- **AI Analyzers**: Property, Fix & Flip, BRRRR, Stock, Bitcoin, Renovation ROI
- **Content Management**: Blog posts, education content (admin panel)
- **Product Store**: Digital products with checkout (Stripe integration)
- **Member Dashboard**: User authentication, profiles, membership tiers
- **Lead Capture**: Newsletter signup, contact forms, coaching bookings
- **Admin Dashboard**: Full management panel at `/admin`
- **Self-Healing**: Auto-restart, health monitoring, error recovery, log rotation

## Admin Panel

Default login: `admin@toinvested.com` / `admin123` (change in `.env`)

From the admin panel you can:
- View dashboard stats (users, leads, revenue, orders)
- Create/edit blog posts and content
- Manage products and pricing
- View and manage leads and bookings
- Monitor system health and logs

## Production Deployment

### With Docker
```bash
docker build -t toinvested .
docker run -p 3000:3000 --env-file .env toinvested
```

### With PM2
```bash
npm install -g pm2
pm2 start scripts/monitor.js --name toinvested
```

### On Vercel
Push to GitHub and connect to Vercel. Config is in `vercel.json`.

## Self-Healing System

The app monitors itself and auto-repairs:
- **Memory**: Detects high memory usage, triggers garbage collection
- **Database**: Verifies connectivity, reinitializes if connection lost
- **Files**: Checks critical files exist
- **Logs**: Auto-rotates when logs exceed 50MB
- **Process**: Auto-restarts on crashes (up to 10 times)
- **Health Endpoint**: `GET /api/health` for monitoring

## API Endpoints

| Endpoint | Description |
|---|---|
| `POST /api/auth/register` | User registration |
| `POST /api/auth/login` | User login |
| `GET /api/content/posts` | Get blog posts |
| `GET /api/products` | Get store products |
| `POST /api/products/checkout` | Create order |
| `POST /api/leads/newsletter` | Newsletter signup |
| `POST /api/leads/contact` | Contact form |
| `POST /api/leads/booking` | Coaching booking |
| `POST /api/analyzers/property` | Property analysis |
| `POST /api/analyzers/flip` | Fix & flip analysis |
| `POST /api/analyzers/brrrr` | BRRRR analysis |
| `POST /api/analyzers/stock` | Stock analysis |
| `POST /api/analyzers/bitcoin` | Bitcoin analysis |
| `POST /api/analyzers/renovation` | Renovation ROI |
| `GET /api/health` | System health check |

## Environment Variables

See `.env.example` for all configuration options including:
- Stripe payment keys
- SMTP email settings
- JWT authentication secret
- Admin credentials
- Self-healing configuration
