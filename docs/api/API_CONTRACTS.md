# API Contracts v1.0

## Authentication
- POST /v1/auth/login → LoginResponse
- POST /v1/auth/register → User
- POST /v1/auth/refresh → LoginResponse
- POST /v1/auth/logout → { message }

## Users
- GET /v1/users → User[]
- GET /v1/users/:id → User
- PUT /v1/users/:id → User
- DELETE /v1/users/:id → User (soft delete)
- GET /v1/users/roles/list → Role[]

## Products
- GET /v1/products?search=&categoryId= → Product[]
- GET /v1/products/barcode/:barcode → Product
- GET /v1/products/:id → Product
- POST /v1/products → Product
- PUT /v1/products/:id → Product
- DELETE /v1/products/:id → Product
- GET /v1/products/categories/list → Category[]
- GET /v1/products/units/list → Unit[]

## Customers
- GET /v1/customers?search=&category= → Customer[]
- GET /v1/customers/:id → Customer
- POST /v1/customers → Customer
- PUT /v1/customers/:id → Customer
- DELETE /v1/customers/:id → Customer
- POST /v1/customers/visits → CustomerVisit
- GET /v1/customers/:id/visits → CustomerVisit[]

## Orders
- GET /v1/orders?status=&customerId=&fromDate=&toDate= → Order[]
- GET /v1/orders/:id → Order
- POST /v1/orders → Order
- PUT /v1/orders/:id/status → Order
- POST /v1/orders/:id/payments → Payment

## Sync
- POST /v1/sync/push → SyncEvent[]
- POST /v1/sync/pull → SyncEvent[]
- GET /v1/sync/pending → SyncEvent[]
