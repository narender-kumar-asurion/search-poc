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
| `npm run dev` | Run TypeScript application directly |
| `npm run api` | Start API server only |
| `npm run frontend` | Start frontend development server |
| `npm run fullstack` | Start both API and frontend concurrently |

### Data Management
| Script | Description |
|--------|-------------|
| `npm run seed` | Seed database with sample data |
| `npm run seed:claims` | Seed only claims data |
| `npm run seed:locations` | Seed only locations data |
| `npm run seed:software` | Seed only software stack data |

### Real-time Sync
| Script | Description |
|--------|-------------|
| `npm run sync:start` | Start sync system |
| `npm run sync:stop` | Stop sync system |
| `npm run sync:status` | Get sync system status |

### Docker
| Script | Description |
|--------|-------------|
| `npm run docker:build` | Build Docker image |
| `npm run docker:run` | Run production containers |
| `npm run docker:dev` | Run development containers |
| `npm run colima:setup` | Setup Colima (macOS) |
| `npm run colima:start` | Start Colima (macOS) |
| `npm run colima:stop` | Stop Colima (macOS) |
| `npm run colima:test` | Test Docker functionality |

### Kubernetes
| Script | Description |
|--------|-------------|
| `npm run k8s:deploy` | Deploy to Kubernetes |
| `npm run k8s:deploy-dev` | Deploy development environment |

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Search Provider Selection (UPDATED!)
SEARCH_PROVIDER=typesense  # typesense | meilisearch (fully supported)

# Typesense Configuration
TYPESENSE_HOST=localhost
TYPESENSE_PORT=8108
TYPESENSE_PROTOCOL=http
TYPESENSE_API_KEY=dev-api-key-change-in-production
TYPESENSE_COLLECTION=software_stack_components

# Meilisearch Configuration (NEW!)
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
NODE_ENV=development
LOG_LEVEL=INFO
```

### 🔄 New SearchAdapter System

**Major Update**: The codebase now features a clean SearchAdapter interface that supports multiple providers with production-ready implementations.

#### Supported Providers
- ✅ **Typesense** - Fast, typo-tolerant search (default)
- ✅ **Meilisearch** - Instant search with great relevance (NEW!)

#### 🎯 Elegant Provider Switching

**Use the enhanced switching script for seamless testing:**

```bash
# Quick switch to any provider (handles everything automatically)
./scripts/provider-switch.sh switch typesense     # Fast, typo-tolerant
./scripts/provider-switch.sh switch meilisearch   # Instant, relevant results

# Run both providers simultaneously for comparison
./scripts/provider-switch.sh compare

# Check current status
./scripts/provider-switch.sh status

# Clean up everything
./scripts/provider-switch.sh cleanup
```

**What the script handles automatically:**
- ✅ Colima status verification and startup
- ✅ Environment configuration (.env updates)
- ✅ Service startup via Docker Compose
- ✅ Health checks and verification
- ✅ Data seeding with sample content
- ✅ Helpful testing URLs and commands

**Manual Provider Switch (if needed):**
```bash
# Ensure Colima is running first
colima status || colima start

# For Meilisearch
echo "SEARCH_PROVIDER=meilisearch" > .env
docker-compose -f docker-compose.meilisearch.yml up -d
npm run seed

# For Typesense  
echo "SEARCH_PROVIDER=typesense" > .env
docker-compose up -d
npm run seed
```

#### Extensibility
Additional providers (Algolia, Elasticsearch) can be added by implementing the SearchAdapter interface when needed.

### Provider Configuration Examples

#### Meilisearch Setup
```env
SEARCH_PROVIDER=meilisearch
MEILISEARCH_HOST=localhost
MEILISEARCH_PORT=7700
MEILISEARCH_PROTOCOL=http
MEILISEARCH_MASTER_KEY=your-master-key
MEILISEARCH_INDEX=software_stack_components
```

#### Typesense Setup (Default)
```env
SEARCH_PROVIDER=typesense
TYPESENSE_HOST=localhost
TYPESENSE_PORT=8108
TYPESENSE_PROTOCOL=http
TYPESENSE_API_KEY=dev-api-key-change-in-production
TYPESENSE_COLLECTION=software_stack_components
```

📖 **All documentation is consolidated in this README for simplicity**

## 📚 API Endpoints

### Search Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check and provider info |
| `GET` | `/api/search?q=term` | Full-text search |
| `GET` | `/api/search/claims?q=term` | Search warranty claims |
| `GET` | `/api/search/locations?q=term` | Search postal codes |
| `GET` | `/api/search/category/:category` | Search by category |
| `POST` | `/api/search/tags` | Search by tags |
| `GET` | `/api/facets` | Get available facets |

### Sync Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/sync/status` | Sync system status |
| `GET` | `/api/sync/health` | Sync health check |
| `GET` | `/api/sync/metrics` | Sync performance metrics |
| `POST` | `/api/sync/start` | Start sync system |
| `POST` | `/api/sync/stop` | Stop sync system |
| `POST` | `/api/sync/process-event` | Process manual sync event |

### Example Usage

```bash
# Basic search
curl "http://localhost:3001/api/search?q=javascript&limit=5"

# Claims search with filters
curl "http://localhost:3001/api/search/claims?q=warranty&limit=10"

# Get sync status
curl "http://localhost:3001/api/sync/status"

# Process manual sync event
curl -X POST http://localhost:3001/api/sync/process-event \
  -H "Content-Type: application/json" \
  -d '{
    "eventData": {
      "eventType": "UPDATE",
      "documentType": "software_stack",
      "data": {"id": "react", "name": "React", "category": "Frontend Framework"}
    }
  }'
```

## 🏛️ Project Structure

```
fs-search/
├── src/                              # Backend source
│   ├── api/
│   │   ├── server.ts                # Express API server
│   │   └── sync-endpoints.ts        # Sync API endpoints
│   ├── services/
│   │   ├── search/
│   │   │   ├── adapters/
│   │   │   │   ├── SearchAdapter.ts     # Core interface
│   │   │   │   ├── TypesenseAdapter.ts  # Typesense implementation
│   │   │   │   ├── MeilisearchAdapter.ts # Meilisearch implementation
│   │   │   │   ├── AdapterFactory.ts    # Simple factory
│   │   │   │   └── index.ts            # Public exports
│   │   │   ├── SearchService.ts        # API service layer
│   │   │   ├── interfaces.ts           # Generic interfaces
│   │   │   └── index.ts               # Main exports
│   │   ├── sync/
│   │   │   ├── interfaces.ts        # Sync interfaces
│   │   │   ├── processor.ts         # Event processor
│   │   │   ├── sqs-consumer.ts      # AWS SQS consumer
│   │   │   ├── event-transformer.ts # Event transformation
│   │   │   ├── metrics.ts           # Metrics collection
│   │   │   └── sync-manager.ts      # Sync orchestration
│   │   └── searchService.ts         # Main service layer
│   ├── data.ts                      # Data seeding
│   ├── schema.ts                    # Data schemas
│   └── lib/
│       └── logger.ts                # Logging utility
├── k8s/                             # Kubernetes manifests
│   ├── namespace.yaml
│   ├── typesense-statefulset.yaml
│   ├── app-deployment.yaml
│   └── ingress.yaml
├── scripts/
│   └── deploy.sh                    # Deployment automation
├── docker-compose.yml               # Docker development
├── Dockerfile                       # Production container
└── frontend/                        # React frontend
    └── src/
        ├── components/              # React components
        └── services/
            └── searchAPI.ts         # API client
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
- Optional Redis for caching
- Volume for index persistence

#### Future Providers
Additional search providers can be integrated by implementing the SearchAdapter interface and updating the AdapterFactory.

## 🔍 Features

### Search Capabilities
- **Full-text search** with typo tolerance
- **Faceted search** with filters
- **Geo-spatial search** for locations
- **Auto-complete** and suggestions
- **Highlighting** of search terms
- **Multi-language** support
- **Custom scoring** and relevance

### Performance
- **Real-time indexing** (< 100ms)
- **Horizontal scaling** via Kubernetes
- **Bulk operations** for large datasets
- **Connection pooling** and caching
- **Metrics and monitoring** built-in

### Developer Experience
- **Multi-provider** support with unified API
- **Type-safe** TypeScript throughout
- **Comprehensive testing** with Jest
- **Docker** development environment
- **CI/CD ready** deployment scripts

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

## 📊 Monitoring

### Metrics Available
- Search query performance
- Sync event processing rates
- Error rates and types
- Queue depths and latency
- Resource utilization

### Prometheus Integration
```bash
# Scrape search metrics
curl http://localhost:3001/api/sync/metrics/prometheus

# Grafana dashboard available at /grafana
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

---

**Built with ❤️ for modern search applications**