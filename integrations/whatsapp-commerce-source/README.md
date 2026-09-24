# RsSmart-Whatsapp Commerce SaaS

A full-stack SaaS platform for WhatsApp-based commerce.

## Project Structure

```
whatsapp-commerce/
├── frontend/          # React + Vite frontend
├── backend/           # Node.js + Express API
├── database/          # PostgreSQL migrations & seeds
├── docker/            # Docker configurations
├── docs/              # Documentation
├── docker-compose.yml # Docker orchestration
└── .env.example       # Environment template
```

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- npm

### 1. Clone & Setup
```bash
cd whatsapp-commerce
cp .env.example .env
# Edit .env with your database credentials and JWT secret
```

### 2. Install Dependencies
```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 3. Setup Database
```bash
# Create database (PostgreSQL must be running)
createdb whatsapp_commerce

# Run migrations
psql -d whatsapp_commerce -f backend/src/database/migrations/001_init.sql
psql -d whatsapp_commerce -f backend/src/database/migrations/002_products_customers.sql
psql -d whatsapp_commerce -f backend/src/database/migrations/003_orders.sql
psql -d whatsapp_commerce -f backend/src/database/migrations/004_whatsapp.sql
psql -d whatsapp_commerce -f backend/src/database/migrations/005_settings.sql
```

### 4. Run
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000
- Health Check: http://localhost:5000/api/health

## Docker Setup

```bash
docker-compose up --build
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, React Router, Recharts, CSS Modules |
| Backend | Node.js, Express, JWT, bcryptjs, pg |
| Database | PostgreSQL 16 |
| DevOps | Docker, Docker Compose |

## API Endpoints

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Health check |

### Authentication
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | /api/auth/register | Register new user | No |
| POST | /api/auth/login | Login user | No |
| GET | /api/auth/me | Get current user | Yes (Bearer) |

### Products
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | /api/products | List products (search, filter) | Yes |
| GET | /api/products/low-stock | Low stock alerts | Yes |
| GET | /api/products/:id | Get single product | Yes |
| POST | /api/products | Create product | Yes |
| PUT | /api/products/:id | Update product | Yes |
| DELETE | /api/products/:id | Delete product | Yes |

### Categories
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | /api/categories | List categories | Yes |
| GET | /api/categories/:id | Get single category | Yes |
| POST | /api/categories | Create category | Yes |
| PUT | /api/categories/:id | Update category | Yes |
| DELETE | /api/categories/:id | Delete category | Yes |

### Customers
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | /api/customers | List customers (search) | Yes |
| GET | /api/customers/:id | Get single customer | Yes |
| POST | /api/customers | Create customer | Yes |
| PUT | /api/customers/:id | Update customer | Yes |
| DELETE | /api/customers/:id | Delete customer | Yes |

### Orders
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | /api/orders/stats | Order statistics | Yes |
| GET | /api/orders | List orders (search, status filter) | Yes |
| GET | /api/orders/:id | Get order with items & history | Yes |
| POST | /api/orders | Create order with items | Yes |
| PATCH | /api/orders/:id/status | Update order status | Yes |
| DELETE | /api/orders/:id | Delete order | Yes |

### WhatsApp
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | /api/whatsapp/webhook | Receive WhatsApp webhook | No |
| GET | /api/whatsapp/webhook | Webhook verification (challenge) | No |
| GET | /api/whatsapp/conversations | List conversations | Yes |
| GET | /api/whatsapp/conversations/:id/messages | Get messages | Yes |
| POST | /api/whatsapp/conversations/:id/messages | Send message | Yes |
| GET | /api/whatsapp/templates | List message templates | Yes |
| POST | /api/whatsapp/templates | Create template | Yes |
| PUT | /api/whatsapp/templates/:id | Update template | Yes |
| DELETE | /api/whatsapp/templates/:id | Delete template | Yes |
| POST | /api/whatsapp/send-template | Send template message | Yes |
| GET | /api/whatsapp/webhook-logs | View webhook logs | Yes |

### Settings
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | /api/settings/public | Get public settings | No |
| GET | /api/settings | List all settings | Yes |
| GET | /api/settings/:key | Get single setting | Yes |
| PUT | /api/settings/:key | Update single setting | Yes |
| PUT | /api/settings | Update multiple settings | Yes |

### Analytics
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | /api/analytics/summary | Dashboard summary | Yes |
| GET | /api/analytics/sales | Sales overview by date | Yes |
| GET | /api/analytics/top-products | Top selling products | Yes |
| GET | /api/analytics/status-breakdown | Order status distribution | Yes |
| GET | /api/analytics/customer-growth | New customers over time | Yes |
| GET | /api/analytics/revenue-by-category | Revenue by category | Yes |
| GET | /api/analytics/recent-activity | Recent orders | Yes |

## Order Status Workflow

```
pending → confirmed → processing → shipped → delivered
   ↓
cancelled
```

## WhatsApp Integration

### Webhook Setup
Configure your WhatsApp Business API or Twilio webhook URL to:
```
POST https://your-domain.com/api/whatsapp/webhook
```

### Order Notifications
When an order is created or its status changes, an automatic WhatsApp message is sent to the customer.

### Message Templates
Create reusable templates with variables like `{{customerName}}` and `{{orderNumber}}`.

### Mock Mode
The WhatsApp sender is currently in mock mode (logs to console). To enable real sending, replace `sendWhatsAppMessage()` in `backend/src/services/whatsapp.service.js` with your provider's API call (Meta, Twilio, MessageBird, etc.).

## Settings

The Settings page provides 5 configuration tabs:

| Tab | Settings |
|-----|----------|
| **Business Info** | Store name, address, phone, email |
| **Tax & Currency** | Currency code/symbol, tax rate, tax enabled, tax inclusive |
| **Business Hours** | Operating hours per day of week |
| **Receipt & Branding** | Receipt footer text, order number prefix |
| **WhatsApp** | Auto-reply greeting message |

## Dashboard Analytics

The Dashboard features interactive charts powered by Recharts:

| Chart | Type | Data |
|-------|------|------|
| **Sales Trend** | Area Chart | Revenue over time (7/30/90 days) |
| **Order Status** | Donut Chart | Distribution by status |
| **Top Products** | Horizontal Bar | Best sellers by quantity |
| **Revenue by Category** | Bar Chart | Sales breakdown by category |
| **Customer Growth** | Line Chart | New customers over time |
| **Recent Activity** | List | Latest orders with status |

## Authentication Flow

1. **Register**: `POST /api/auth/register` with `{ email, password, fullName }`
2. **Login**: `POST /api/auth/login` with `{ email, password }`
3. **Token**: JWT returned, stored in `localStorage` as `token`
4. **Protected Routes**: Frontend guards routes; backend verifies Bearer token
5. **Logout**: Clears token and redirects to login

## Environment Variables

```env
# Backend
NODE_ENV=development
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=whatsapp_commerce
DB_USER=postgres
DB_PASSWORD=your_password
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=your-super-secret-key

# Frontend
VITE_API_BASE_URL=http://localhost:5000/api
```

## License

MIT
