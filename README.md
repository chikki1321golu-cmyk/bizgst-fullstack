# BizGST — Production-Ready GST Accounting System

> Smart GST accounting for Indian retail and wholesale businesses. Zero accounting knowledge required.

## What It Does

- **Record sales** in under 10 seconds — GST calculated automatically
- **Record purchases** — ITC eligibility auto-detected from supplier GSTIN
- **Generate GSTR-1 and GSTR-3B** — ready for GST portal upload
- **Export compliant JSON** — directly uploadable to GST portal
- **Mobile-first UI** — works on any device

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, DM Sans font |
| Backend | Node.js 20 + Express 4 |
| Database | PostgreSQL 16 |
| ORM | Prisma 5 |
| Auth | OTP (SMS via Twilio) + JWT |
| GST Engine | Custom Node.js service |

---

## Project Structure

```
bizgst/
├── backend/
│   ├── config/
│   │   └── prisma.js              # Prisma client singleton
│   ├── prisma/
│   │   ├── schema.prisma          # Prisma ORM schema
│   │   ├── schema.sql             # Raw SQL (alternative)
│   │   └── seed.js                # Sample data seeder
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   ├── business.controller.js
│   │   │   ├── sales.controller.js
│   │   │   ├── purchases.controller.js
│   │   │   ├── products.controller.js
│   │   │   └── gst.controller.js
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js  # JWT validation
│   │   │   └── error.middleware.js # Global error handler
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── business.routes.js
│   │   │   ├── sales.routes.js
│   │   │   ├── purchases.routes.js
│   │   │   ├── products.routes.js
│   │   │   ├── parties.routes.js
│   │   │   ├── gst.routes.js
│   │   │   └── export.routes.js
│   │   ├── services/
│   │   │   └── gst.engine.js      # ★ Core GST calculation logic
│   │   ├── utils/
│   │   │   └── logger.js
│   │   ├── app.js
│   │   └── server.js
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── components/
│       │   ├── auth/
│       │   │   ├── LoginPage.js    # OTP login form
│       │   │   └── BusinessSetup.js
│       │   ├── dashboard/
│       │   │   └── Dashboard.js   # Real-time GST metrics
│       │   ├── sales/
│       │   │   ├── AddSaleModal.js # Live GST preview
│       │   │   └── SalesList.js
│       │   ├── purchases/
│       │   │   └── Purchases.js   # ITC eligibility display
│       │   ├── products/
│       │   │   └── ProductsPage.js
│       │   └── gst/
│       │       └── GSTReturns.js  # GSTR-1 + GSTR-3B
│       ├── context/
│       │   └── AuthContext.js     # Global auth state
│       ├── hooks/
│       │   └── useData.js         # Data fetching hooks
│       ├── services/
│       │   └── api.js             # Axios + JWT interceptor
│       ├── utils/
│       │   └── helpers.js
│       ├── App.js
│       └── index.js
│
├── docker-compose.yml
└── README.md
```

---

## Quick Start

### Option A — Docker (Recommended)

```bash
# 1. Clone the project
git clone <repo-url> bizgst && cd bizgst

# 2. Start everything
docker-compose up --build

# 3. Run migrations inside the backend container
docker exec bizgst_backend npx prisma migrate dev --name init
docker exec bizgst_backend node prisma/seed.js

# 4. Open http://localhost:3000
# Login: mobile 9876543210, OTP 123456
```

### Option B — Manual Setup

#### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

#### Backend

```bash
cd backend
npm install

# Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET

# Create database
createdb bizgst_db

# Run Prisma migrations
npx prisma migrate dev --name init
npx prisma generate

# Seed sample data
node prisma/seed.js

# Start development server
npm run dev
# → API running at http://localhost:5000
```

#### Frontend

```bash
cd frontend
npm install

cp .env.example .env
# REACT_APP_API_URL=http://localhost:5000/api

npm start
# → App running at http://localhost:3000
```

---

## Environment Variables

### Backend `.env`

```env
NODE_ENV=development
PORT=5000

# PostgreSQL connection string
DATABASE_URL="postgresql://postgres:password@localhost:5432/bizgst_db"

# JWT — generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your_64_char_random_secret_here
JWT_EXPIRES_IN=7d

# OTP — set MOCK_OTP=true for development (no SMS sent, OTP logged to console)
MOCK_OTP=true
FIXED_DEV_OTP=123456

# Production: Twilio credentials
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxx
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx

FRONTEND_URL=http://localhost:3000
```

### Frontend `.env`

```env
REACT_APP_API_URL=http://localhost:5000/api
```

---

## API Reference

### Authentication

```
POST /api/auth/otp-request   { mobile: "9876543210" }
POST /api/auth/otp-verify    { mobile: "9876543210", otp: "123456" }
GET  /api/auth/profile       (Bearer token required)
```

### Business Profile

```
GET  /api/business           Get current business
POST /api/business           Create business profile { name, gstin, address }
PUT  /api/business           Update business
```

### Sales

```
GET    /api/sales?period=032025&page=1&limit=50
GET    /api/sales/:id
POST   /api/sales            Create invoice (GST auto-calculated by backend)
DELETE /api/sales/:id        Cancel invoice (soft delete)
```

**POST /api/sales payload:**
```json
{
  "partyName": "Ramesh Traders",
  "partyGstin": "27XYZAB1234C1Z5",
  "partyStateCode": "27",
  "invoiceDate": "2025-03-01",
  "items": [
    {
      "productId": "uuid-optional",
      "description": "Mobile Phone",
      "hsnCode": "8517",
      "quantity": 2,
      "unitPrice": 12000,
      "gstRate": 18,
      "discount": 0
    }
  ]
}
```

### Purchases

```
GET  /api/purchases?period=032025
GET  /api/purchases/:id
POST /api/purchases          Record purchase + ITC auto-calculated
```

### Products

```
GET    /api/products
POST   /api/products         { name, hsnCode, gstRate, unit, basePrice }
PUT    /api/products/:id
DELETE /api/products/:id     Soft deactivate
```

### GST Returns

```
GET /api/gst/summary?period=032025    Dashboard summary
GET /api/gst/gstr1?period=032025      Generate GSTR-1 payload
GET /api/gst/gstr3b?period=032025     Generate GSTR-3B payload
```

### Export (JSON download)

```
GET /api/export/gstr1?period=032025   Download GSTR1_032025.json
GET /api/export/gstr3b?period=032025  Download GSTR3B_032025.json
```

---

## GST Engine Logic

The GST engine (`backend/src/services/gst.engine.js`) implements:

| Rule | Logic |
|---|---|
| Intrastate supply | CGST = rate/2, SGST = rate/2 |
| Interstate supply | IGST = rate (full) |
| B2B classification | Customer GSTIN present → B2B |
| B2CS (large B2C) | No GSTIN + interstate + taxable ≥ ₹2,50,000 |
| B2C (small) | No GSTIN + taxable < ₹2,50,000 (consolidated) |
| ITC eligible | Supplier GSTIN present + not blocked category |
| ITC blocked | No supplier GSTIN (Section 17(5)) |
| RCM flag | Buyer liable to pay tax directly |

**Key design principle:** The frontend **never** calculates GST. It sends raw inputs (quantity, price, state codes) and the backend engine returns computed tax values. This ensures legal accuracy and prevents UI manipulation of tax amounts.

---

## Database Design Decisions

1. **Tax amounts stored on invoice** — immutable snapshot, never re-computed from items. GST rate changes don't affect historical records.

2. **Denormalized HSN/rate on line items** — same reason as above. If you change a product's GST rate, old invoices remain accurate.

3. **Soft deletes everywhere** — invoices use `status = CANCELLED`, products use `is_active = FALSE`. Financial records are never hard-deleted for audit compliance.

4. **ITC columns on purchase invoices** — `itc_eligible`, `itc_cgst`, `itc_sgst`, `itc_igst` stored separately from raw tax amounts, because ITC eligibility can differ from tax paid.

5. **UUID primary keys** — future-proof for distributed systems, safe to expose in URLs.

---

## Security

- All routes except `/api/auth/*` require Bearer JWT
- Rate limiting: 200 req/15min general, 10 req/15min for auth
- Helmet.js security headers
- OTP expires in 10 minutes, single-use
- GSTIN format validation on all inputs
- Input sanitization via `express-validator`
- Passwords: not stored (OTP-only auth)

---

## Production Deployment

### Backend — Railway / Render / Heroku

```bash
# Set env vars in dashboard, then:
npm run db:migrate
npm start
```

### Frontend — Vercel / Netlify

```bash
npm run build
# Upload /build folder or connect git repo
# Set REACT_APP_API_URL to your backend URL
```

### Database — Supabase / Neon / Railway

```
DATABASE_URL=postgresql://user:pass@host:5432/bizgst_db?sslmode=require
```

---

## GST JSON Output Sample

**GSTR-1 (B2B section):**
```json
{
  "gstin": "27ABCDE1234F1Z5",
  "fp": "032025",
  "b2b": [{
    "ctin": "27XYZAB1234C1Z5",
    "inv": [{
      "inum": "INV-0001",
      "idt": "01-03-2025",
      "val": 28320,
      "pos": "27",
      "rchrg": "N",
      "itms": [{
        "num": 1,
        "itm_det": {
          "hsn_sc": "8517",
          "txval": 24000,
          "crt": 9,
          "camt": 2160,
          "srt": 9,
          "samt": 2160,
          "iamt": 0
        }
      }]
    }]
  }]
}
```

---

## License

MIT — Free to use for your business.
