# FS-Search: Modern Full-Stack Search Application

A clean, modern full-stack search application built with **Typesense**, **Node.js**, and **React**. Now featuring **real-time sync**, **multi-provider support**, and **Kubernetes deployment**.

## 🏗️ Architecture

### Backend (Node.js + TypeScript + Express)
- **Multi-Provider Search**: Supports Typesense and Meilisearch
- **Real-time Sync**: AWS SQS/SNS integration for database change events
- **Service Layer**: Clean abstraction over search providers
- **API Layer**: RESTful endpoints for search and sync operations  
- **Configuration**: Environment-based config management
- **Logging**: Structured logging with configurable levels
- **Error Handling**: Proper error boundaries and typed exceptions

### Frontend (React 18 + TypeScript + Vite)
- **React 18** with modern patterns
- **TanStack Query** for data fetching
- **Tailwind CSS** + **Shadcn UI** for styling
- **Responsive design** with accessibility focus

### Search Providers
- **Typesense** (Primary) - Fast, typo-tolerant search with clustering
- **Meilisearch** - Lightweight alternative with good defaults

### Real-time Sync
- **AWS SQS/SNS** message queues for change events
- **Database triggers** and **API-driven** sync support
- **Incremental updates** with batching and retry logic
- **Bulk operations** for efficient data management

### Deployment
- **Docker** containers for local development
- **Kubernetes** manifests for production deployment
- **CI/CD** ready with automated deployment scripts

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Colima (Docker alternative) - **Required for enterprise compliance**
- Kubernetes cluster (for production)
- AWS account (for real-time sync)

### Colima Setup (Enterprise Required)

**All platforms use Colima - Docker Desktop is not permitted**

```bash
# Install Colima (macOS/Linux)
brew install colima

# Install Docker CLI and Compose
brew install docker docker-compose

# Start Colima with optimized settings
colima start --cpu 4 --memory 8 --disk 60

# Verify setup is working
docker version
docker-compose version
```

### Local Development

```bash
# 1. Setup Colima (one-time)
npm run colima:setup

# 2. Install dependencies
npm run setup

# 3. Start with Colima + Docker Compose
npm run docker:dev

# OR start components separately:

# 1. Ensure Colima is running
colima status || colima start

# 2. Start Typesense server via Colima
docker run -p 8108:8108 -v typesense-data:/data typesense/typesense:0.25.0 \
  --data-dir /data --api-key=dev-api-key-change-in-production --enable-cors

# 3. Seed sample data
npm run seed

# 4. Start development servers
npm run fullstack
```

### Production Deployment

```bash
# Deploy to Kubernetes
npm run k8s:deploy

# OR deploy with custom settings
./scripts/deploy.sh --registry your-registry.com --environment production
```

## 📝 Available Scripts

### Development
| Script | Description |
|--------|-------------|
| `npm run setup` | Install dependencies and build |
| `npm run build` | Build TypeScript to dist/ |
| `npm run start` | Start production server from dist/ |
| `npm run dev` | Run TypeScript application directly |
| `npm run api` | Start API server only |
| `npm run frontend` | Start frontend development server |
| `npm run fullstack` | Start both API and frontend concurrently |
| `npm run demo` | Run demonstration script |

### Data Management
| Script | Description |
|--------|-------------|
| `npm run seed` | Seed all collections with sample data |
| `npm run seed:claims` | Seed only claims data |
| `npm run seed:locations` | Seed only locations data |
| `npm run seed:software` | Seed only software stack data |
| `npm run validate-data` | Validate seed data schemas |

### Testing & Quality
| Script | Description |
|--------|-------------|
| `npm run test` | Run Jest tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run test:integration` | Run integration tests only |
| `npm run test:unit` | Run unit tests only |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint issues |

### Real-time Sync
| Script | Description |
|--------|-------------|
| `npm run sync:start` | Start sync system |
| `npm run sync:stop` | Stop sync system |
| `npm run sync:status` | Get sync system status |

### Docker & Colima
| Script | Description |
|--------|-------------|
| `npm run docker:build` | Build Docker image |
| `npm run docker:run` | Run production containers |
| `npm run docker:dev` | Run development containers |
| `npm run colima:setup` | Setup Colima |
| `npm run colima:start` | Start Colima |
| `npm run colima:stop` | Stop Colima |
| `npm run colima:test` | Test Docker functionality |

### Deployment
| Script | Description |
|--------|-------------|
| `npm run k8s:deploy` | Deploy to Kubernetes |
| `npm run k8s:deploy-dev` | Deploy development environment |

### Performance & Security
| Script | Description |
|--------|-------------|
| `npm run bench:load` | Run load tests with k6 |
| `npm run bench:index` | Run index performance tests |
| `npm run bench:all` | Run all benchmarks |
| `npm run security:audit` | Audit dependencies (moderate level) |
| `npm run security:check` | Security check (high level) |

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Search Provider Selection
SEARCH_PROVIDER=typesense  # typesense | meilisearch

# Typesense Configuration
TYPESENSE_HOST=localhost
TYPESENSE_PORT=8108
TYPESENSE_PROTOCOL=http
TYPESENSE_API_KEY=dev-api-key-change-in-production
TYPESENSE_COLLECTION=software_stack_components

# Meilisearch Configuration
MEILISEARCH_HOST=localhost
MEILISEARCH_PORT=7700
MEILISEARCH_PROTOCOL=http
MEILISEARCH_MASTER_KEY=your-master-key
MEILISEARCH_INDEX=software_stack_components

# Real-time Sync (AWS)
AWS_REGION=us-west-2
AWS_SQS_QUEUE_URL=https://sqs.us-west-2.amazonaws.com/123456789012/fs-search-updates
AWS_SNS_TOPIC_ARN=arn:aws:sns:us-west-2:123456789012:fs-search-updates
AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=YOUR_SECRET_KEY

# API Configuration
API_PORT=3001
API_HOST=localhost
API_CORS_ORIGIN=*
API_AUTH_ENABLED=false
API_KEY=your-api-key

# Application
NODE_ENV=development
LOG_LEVEL=INFO
```

### SearchAdapter System

Clean SearchAdapter interface supporting multiple search providers.

#### Supported Providers
- ✅ **Typesense** - Fast, typo-tolerant search (default)
- ✅ **Meilisearch** - Instant search with great relevance

#### Provider Switching

**Switch Commands:**
```bash
# Test Typesense (fast, typo-tolerant search)
./scripts/provider-switch.sh switch typesense

# Test Meilisearch (instant, relevant results)  
./scripts/provider-switch.sh switch meilisearch

# Compare both side-by-side
./scripts/provider-switch.sh compare
```

**Each switch automatically:**
- Updates environment configuration
- Starts the appropriate Docker service
- Seeds data collections (87 documents)
- Provides ready-to-use API endpoints

**Test your setup:**
```bash
# After switching, test the search
curl "http://localhost:3001/api/search?q=javascript"

# Start development servers
npm run api        # API server (port 3001)
npm run frontend   # Frontend (port 3000)
```

**Verify status:**
```bash
./scripts/provider-switch.sh status  # Check services
docker ps                            # Verify containers
```

#### Extensibility
Additional providers can be added by implementing the SearchAdapter interface.



## 📚 API Reference

### Core Search Endpoints

| Method | Endpoint | Parameters | Description |
|--------|----------|------------|-------------|
| `GET` | `/api/health` | None | System status & provider info (public) |
| `GET` | `/api/search` | `q`, `category?`, `tags?`, `page?`, `limit?` | General document search |
| `GET` | `/api/search/claims` | `q`, `claimType?`, `claimStatus?`, `province?`, `page?`, `limit?` | Warranty claims search |
| `GET` | `/api/search/locations` | `q`, `province?`, `postalCode?`, `page?`, `limit?` | Postal code locations search |
| `GET` | `/api/search/category/:category` | None | Search by specific category |
| `POST` | `/api/search/tags` | `{"tags": ["tag1", "tag2"]}` | Multi-tag search |
| `GET` | `/api/facets` | None | Available search filters |

### Sync Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/sync/status` | Sync system status & queue stats |
| `GET` | `/api/sync/health` | Health check with detailed diagnostics |
| `GET` | `/api/sync/metrics` | Performance metrics (JSON) |
| `GET` | `/api/sync/metrics/prometheus` | Prometheus-format metrics |
| `POST` | `/api/sync/start` | Start real-time sync system |
| `POST` | `/api/sync/stop` | Stop sync system |
| `POST` | `/api/sync/process-event` | Manually process sync event |
| `POST` | `/api/sync/process-batch` | Process multiple events |
| `POST` | `/api/sync/metrics/reset` | Reset metrics counters |

### Authentication & Security

- **API Key Required**: All endpoints except `/api/health` require authentication
- **Rate Limiting**: Built-in request throttling
- **Input Validation**: Zod schema validation on all parameters
- **CORS**: Configurable cross-origin support

### Common Parameters

- `q` (required): Search query string (1-256 chars)
- `page` (optional): Page number (default: 1, max: 1000)
- `limit` (optional): Results per page (default: 10, max: 100)

### Example Requests

```bash
# Basic search with pagination
curl "http://localhost:3001/api/search?q=javascript&limit=5&page=1"

# Claims search with filters
curl "http://localhost:3001/api/search/claims?q=warranty&claimType=damage&province=ON"

# Tag-based search
curl -X POST http://localhost:3001/api/search/tags \
  -H "Content-Type: application/json" \
  -d '{"tags": ["frontend", "javascript"]}'

# Manual sync event
curl -X POST http://localhost:3001/api/sync/process-event \
  -H "Content-Type: application/json" \
  -d '{
    "eventData": {
      "eventType": "UPDATE",
      "documentType": "software_stack",
      "data": {"id": "react", "name": "React", "category": "Frontend"}
    }
  }'
```

## 🏛️ Project Structure

```
search-poc/
├── src/                              # Backend source
│   ├── api/
│   │   ├── server.ts                # Express API server
│   │   ├── sync-endpoints.ts        # Sync API endpoints
│   │   ├── validators.ts            # Request validation schemas
│   │   └── middleware/
│   │       └── auth.ts              # Authentication middleware
│   ├── services/
│   │   ├── search/
│   │   │   ├── adapters/
│   │   │   │   ├── SearchAdapter.ts     # Core interface
│   │   │   │   ├── TypesenseAdapter.ts  # Typesense implementation
│   │   │   │   ├── MeilisearchAdapter.ts # Meilisearch implementation
│   │   │   │   ├── AdapterFactory.ts    # Provider factory
│   │   │   │   └── index.ts            # Public exports
│   │   │   ├── SearchService.ts        # Main service layer
│   │   │   ├── interfaces.ts           # Search interfaces
│   │   │   └── index.ts               # Public exports
│   │   └── sync/
│   │       ├── interfaces.ts        # Sync interfaces
│   │       ├── processor.ts         # Event processor
│   │       ├── sqs-consumer.ts      # AWS SQS consumer
│   │       ├── event-transformer.ts # Event transformation
│   │       ├── metrics.ts           # Metrics collection
│   │       ├── sync-manager.ts      # Sync orchestration
│   │       └── index.ts             # Public exports
│   ├── config/
│   │   └── index.ts                 # Configuration management
│   ├── lib/
│   │   ├── logger.ts                # Logging utility
│   │   └── security.ts              # Security middleware
│   ├── seed-data/
│   │   ├── claims.json              # Sample claims data (37 records)
│   │   ├── locations.json           # Sample locations data (50 records)
│   │   └── README.md                # Seed data documentation
│   ├── utils/
│   │   └── validate-seed-data.ts    # Data validation utility
│   ├── data.ts                      # Data seeding logic
│   ├── index.ts                     # Main application entry
│   └── schema.ts                    # TypeScript schemas
├── frontend/                        # React frontend
│   ├── src/
│   │   ├── components/              # React components
│   │   │   ├── ui/                  # UI primitives (shadcn)
│   │   │   └── __tests__/           # Component tests
│   │   ├── hooks/                   # Custom React hooks
│   │   ├── lib/                     # Utilities and schemas
│   │   ├── services/                # API client
│   │   ├── test/                    # Test utilities
│   │   └── types/                   # TypeScript types
│   ├── package.json                 # Frontend dependencies
│   └── vite.config.ts               # Vite configuration
├── k8s/                             # Kubernetes manifests
│   ├── namespace.yaml
│   ├── typesense-statefulset.yaml
│   ├── app-deployment.yaml
│   └── ingress.yaml
├── scripts/
│   ├── deploy.sh                    # Deployment automation
│   ├── provider-switch.sh           # Provider switching utility
│   ├── colima-setup.sh              # Colima setup script
│   └── benchmarks/                  # Performance benchmarks
├── tests/                           # Backend tests
│   ├── unit/                        # Unit tests
│   ├── integration/                 # Integration tests
│   └── performance/                 # Performance tests
├── docker-compose.yml               # Docker orchestration
├── Dockerfile                       # Production container
└── package.json                     # Backend dependencies
```

## 🔄 Real-time Sync

### Architecture

The sync system provides real-time updates from your primary database to the search index:

```
Database → Triggers/CDC → SNS → SQS → Search Index
```

### Supported Event Sources

1. **Database Triggers**: PostgreSQL, MySQL, SQL Server triggers
2. **Change Data Capture**: AWS DMS, Debezium
3. **Application Events**: Direct API calls
4. **Message Queues**: AWS SQS/SNS, RabbitMQ, Kafka

### Event Format

```json
{
  "id": "evt_123456789",
  "eventType": "INSERT|UPDATE|DELETE|BULK_UPDATE|BULK_DELETE",
  "documentType": "claims|locations|software_stack",
  "timestamp": 1640995200000,
  "data": { /* document data */ },
  "oldData": { /* previous data for updates */ },
  "metadata": {
    "source": "database-trigger",
    "user": "user123",
    "correlationId": "req_123"
  }
}
```

### Monitoring

Access sync metrics at:
- Prometheus format: `GET /api/sync/metrics/prometheus`
- JSON format: `GET /api/sync/metrics`
- Health check: `GET /api/sync/health`

## 🚀 Deployment

### Kubernetes Production

1. **Configure secrets**:
```bash
kubectl create secret generic typesense-secret \
  --from-literal=TYPESENSE_API_KEY=your-secure-key

kubectl create secret generic aws-secret \
  --from-literal=AWS_ACCESS_KEY_ID=your-key \
  --from-literal=AWS_SECRET_ACCESS_KEY=your-secret \
  --from-literal=SQS_QUEUE_URL=your-queue-url
```

2. **Deploy**:
```bash
./scripts/deploy.sh --environment production --registry your-registry.com
```

3. **Scale**:
```bash
kubectl scale deployment fs-search-api --replicas=5
kubectl scale statefulset typesense --replicas=3
```

### Colima Development (Enterprise Required)

**All development uses Colima - no Docker Desktop**

```bash
# One-time setup
npm run colima:setup

# Start all services via Colima
npm run docker:dev

# View logs
docker-compose logs -f fs-search-api

# Scale services
docker-compose up --scale fs-search-api=3

# Colima management
npm run colima:stop   # Stop when done
npm run colima:start  # Start again later

# Check Colima status
colima status

# Restart if needed
colima restart
```

### Provider-Specific Deployment

#### Typesense Cluster
- HA StatefulSet with 3 replicas
- Persistent volumes for data
- Service discovery for cluster formation

#### Meilisearch
- Single replica deployment
- Volume for index persistence

## 🔍 Features

### Search Capabilities
- **Full-text search** with typo tolerance
- **Faceted search** with filters
- **Multi-collection search** (claims, locations)
- **Pagination** and result limiting
- **Custom scoring** and relevance

### Performance
- **Real-time indexing** 
- **Horizontal scaling** via Kubernetes
- **Bulk operations** for large datasets
- **Metrics and monitoring** built-in

### Developer Experience
- **Multi-provider** support (Typesense, Meilisearch)
- **Type-safe** TypeScript throughout
- **Comprehensive testing** with Jest
- **Docker** development environment
- **Kubernetes** deployment ready

## 🧪 Testing

```bash
# Run backend tests
npm run test

# Test search functionality
npm run demo

# Validate data schemas
npm run validate-data

# Test sync system
npm run sync:status
```

