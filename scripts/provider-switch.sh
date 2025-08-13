#!/bin/bash

# FS-Search Provider Switching Script
# Elegant solution for testing multiple search providers locally on macOS with Colima

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env"
BACKUP_ENV="$PROJECT_ROOT/.env.backup"

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')] INFO: $1${NC}"
}

highlight() {
    echo -e "${PURPLE}[$(date +'%H:%M:%S')] $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log "🔍 Checking prerequisites..."
    
    # Check Colima
    if ! command -v colima &> /dev/null; then
        error "Colima is required but not installed. Run: brew install colima"
    fi
    
    # Check if Colima is running
    if ! colima status &> /dev/null; then
        warn "Colima is not running. Starting..."
        colima start --cpu 4 --memory 8 --disk 60
    fi
    
    # Check Docker
    if ! docker version &> /dev/null; then
        error "Docker CLI is not working. Check Colima setup."
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js is required but not installed"
    fi
    
    log "✅ Prerequisites check passed"
}

# Backup current .env
backup_env() {
    if [[ -f "$ENV_FILE" ]]; then
        cp "$ENV_FILE" "$BACKUP_ENV"
        info "📄 Backed up current .env to .env.backup"
    fi
}

# Restore .env from backup
restore_env() {
    if [[ -f "$BACKUP_ENV" ]]; then
        cp "$BACKUP_ENV" "$ENV_FILE"
        info "📄 Restored .env from backup"
    fi
}

# Setup environment for provider
setup_provider_env() {
    local provider="$1"
    
    log "⚙️  Setting up environment for $provider..."
    
    # Create base .env if it doesn't exist
    if [[ ! -f "$ENV_FILE" ]]; then
        cp "$PROJECT_ROOT/env.example" "$ENV_FILE"
    fi
    
    # Update SEARCH_PROVIDER
    if grep -q "^SEARCH_PROVIDER=" "$ENV_FILE"; then
        sed -i.bak "s/^SEARCH_PROVIDER=.*/SEARCH_PROVIDER=$provider/" "$ENV_FILE"
    else
        echo "SEARCH_PROVIDER=$provider" >> "$ENV_FILE"
    fi
    
    # Provider-specific configuration
    case "$provider" in
        "typesense")
            # Ensure Typesense config is present
            grep -q "^TYPESENSE_HOST=" "$ENV_FILE" || echo "TYPESENSE_HOST=localhost" >> "$ENV_FILE"
            grep -q "^TYPESENSE_PORT=" "$ENV_FILE" || echo "TYPESENSE_PORT=8108" >> "$ENV_FILE"
            grep -q "^TYPESENSE_API_KEY=" "$ENV_FILE" || echo "TYPESENSE_API_KEY=dev-api-key-change-in-production" >> "$ENV_FILE"
            ;;
        "meilisearch")
            # Ensure Meilisearch config is present
            grep -q "^MEILISEARCH_HOST=" "$ENV_FILE" || echo "MEILISEARCH_HOST=localhost" >> "$ENV_FILE"
            grep -q "^MEILISEARCH_PORT=" "$ENV_FILE" || echo "MEILISEARCH_PORT=7700" >> "$ENV_FILE"
            grep -q "^MEILISEARCH_MASTER_KEY=" "$ENV_FILE" || echo "MEILISEARCH_MASTER_KEY=dev-master-key-change-in-production" >> "$ENV_FILE"
            ;;
    esac
    
    log "✅ Environment configured for $provider"
}

# Start provider services
start_provider_services() {
    local provider="$1"
    
    log "🚀 Starting $provider services via Colima..."
    
    # Stop any existing containers first and remove them
    log "🧹 Cleaning up existing containers..."
    docker-compose down --remove-orphans &> /dev/null || true
    docker-compose -f docker-compose.meilisearch.yml down --remove-orphans &> /dev/null || true
    
    # Force stop containers using our ports
    docker ps -q --filter "publish=7700" | xargs -r docker stop &> /dev/null || true
    docker ps -q --filter "publish=8108" | xargs -r docker stop &> /dev/null || true
    
    # Remove any orphaned containers by name
    docker rm -f fs-search-typesense fs-search-meilisearch fs-search-api fs-search-app-meilisearch &> /dev/null || true
    
    # Wait for ports to be freed
    sleep 1
    
    case "$provider" in
        "typesense")
            log "🔧 Starting Typesense..."
            docker-compose up -d typesense
            # Wait for health check
            sleep 5
            if curl -f http://localhost:8108/health &> /dev/null; then
                log "✅ Typesense is healthy"
            else
                error "❌ Typesense failed to start properly"
            fi
            ;;
        "meilisearch")
            log "🔧 Starting Meilisearch..."
            docker-compose -f docker-compose.meilisearch.yml up -d meilisearch
            # Wait for health check
            sleep 10
            if curl -f http://localhost:7700/health &> /dev/null; then
                log "✅ Meilisearch is healthy"
            else
                error "❌ Meilisearch failed to start properly"
            fi
            ;;
    esac
}

# Seed data for provider
seed_data() {
    local provider="$1"
    
    log "🌱 Seeding data for $provider..."
    
    cd "$PROJECT_ROOT"
    
    # Wait a bit for the service to be fully ready
    sleep 3
    
    # Seed all collections
    npm run seed 2>/dev/null || {
        warn "Initial seed failed, retrying..."
        sleep 5
        npm run seed || error "Failed to seed data"
    }
    
    log "✅ Data seeded successfully"
}

# Verify provider is working
verify_provider() {
    local provider="$1"
    
    log "🔍 Verifying $provider is working..."
    
    # Check direct provider health
    case "$provider" in
        "typesense")
            if ! curl -f http://localhost:8108/health &> /dev/null; then
                error "Typesense health check failed"
            fi
            ;;
        "meilisearch")
            if ! curl -f http://localhost:7700/health &> /dev/null; then
                error "Meilisearch health check failed"
            fi
            ;;
    esac
    
    log "✅ $provider verification passed"
}

# Switch to provider
switch_to_provider() {
    local provider="$1"
    
    highlight "🔄 Switching to $provider..."
    
    backup_env
    setup_provider_env "$provider"
    start_provider_services "$provider"
    verify_provider "$provider"
    seed_data "$provider"
    
    highlight "🎉 Successfully switched to $provider!"
    show_test_urls "$provider"
}

# Show testing URLs and commands
show_test_urls() {
    local provider="$1"
    
    info "🌐 Ready for testing! Here are your endpoints:"
    echo ""
    info "📡 API Endpoints:"
    info "   Health Check: curl http://localhost:3001/api/health"
    info "   Basic Search: curl \"http://localhost:3001/api/search?q=javascript\""
    info "   Claims Search: curl \"http://localhost:3001/api/search/claims?q=warranty\""
    info "   Locations Search: curl \"http://localhost:3001/api/search/locations?q=12345\""
    echo ""
    
    case "$provider" in
        "typesense")
            info "🔍 Typesense Direct:"
            info "   Dashboard: http://localhost:8108"
            info "   Health: curl http://localhost:8108/health"
            info "   Collections: curl http://localhost:8108/collections -H \"X-TYPESENSE-API-KEY: dev-api-key-change-in-production\""
            ;;
        "meilisearch")
            info "🔍 Meilisearch Direct:"
            info "   Dashboard: http://localhost:7700"
            info "   Health: curl http://localhost:7700/health"
            info "   Indexes: curl http://localhost:7700/indexes -H \"Authorization: Bearer your-master-key\""
            ;;
    esac
    
    echo ""
    info "🚀 Quick Start API Server:"
    info "   npm run api        # Start API server"
    info "   npm run frontend   # Start frontend (port 3000)"
    info "   npm run fullstack  # Start both API and frontend"
    echo ""
    info "🔄 Switch Providers:"
    info "   ./scripts/provider-switch.sh switch typesense"
    info "   ./scripts/provider-switch.sh switch meilisearch"
    info "   ./scripts/provider-switch.sh compare    # Run both side-by-side"
}

# Compare providers side by side
compare_providers() {
    log "🆚 Setting up provider comparison..."
    
    # Start both providers
    log "🚀 Starting both Typesense and Meilisearch..."
    
    # Stop everything first and clean up completely
    log "🧹 Cleaning up all existing containers..."
    docker-compose down --remove-orphans &> /dev/null || true
    docker-compose -f docker-compose.meilisearch.yml down --remove-orphans &> /dev/null || true
    
    # Force stop and remove any containers using our ports
    log "🔧 Freeing up ports 7700 and 8108..."
    docker ps -q --filter "publish=7700" | xargs -r docker stop &> /dev/null || true
    docker ps -q --filter "publish=8108" | xargs -r docker stop &> /dev/null || true
    
    # Remove any orphaned containers
    docker rm -f fs-search-typesense fs-search-meilisearch fs-search-api fs-search-app-meilisearch &> /dev/null || true
    
    # Clean up any unused networks
    docker network prune -f &> /dev/null || true
    
    # Wait a moment for ports to be freed
    sleep 2
    
    # Start Typesense on port 8108
    docker-compose up -d typesense
    
    # Start Meilisearch on port 7700
    docker-compose -f docker-compose.meilisearch.yml up -d meilisearch
    
    # Wait for both to be ready
    log "⏳ Waiting for services to be ready..."
    sleep 10
    
    # Verify both are running
    if curl -f http://localhost:8108/health &> /dev/null && \
       curl -f http://localhost:7700/health &> /dev/null; then
        log "✅ Both providers are running"
    else
        error "❌ Failed to start both providers"
    fi
    
    # Seed data for both
    log "🌱 Seeding data for comparison..."
    
    # Seed Typesense
    setup_provider_env "typesense"
    npm run seed &> /dev/null
    
    # Seed Meilisearch  
    setup_provider_env "meilisearch"
    npm run seed &> /dev/null
    
    highlight "🎉 Comparison setup complete!"
    echo ""
    info "🔍 Both providers are now running with identical data:"
    info "   ✅ Typesense:  http://localhost:8108/health"
    info "   ✅ Meilisearch: http://localhost:7700/health"
    echo ""
    info "🧪 Test both providers by switching your API:"
    info "   ./scripts/provider-switch.sh switch typesense    # API → Typesense"
    info "   ./scripts/provider-switch.sh switch meilisearch  # API → Meilisearch"
    echo ""
    info "📊 Compare performance:"
    info "   npm run bench:all                                # Run benchmarks"
    echo ""
    info "💡 Pro tip: Keep this terminal open and use another terminal to switch providers!"
    info "           Then test the same queries against both providers."
}

# Show current status
show_status() {
    log "📊 Current Provider Status"
    echo "=========================="
    
    # Current environment
    if [[ -f "$ENV_FILE" ]]; then
        local current_provider=$(grep "^SEARCH_PROVIDER=" "$ENV_FILE" | cut -d'=' -f2)
        info "Current provider: ${current_provider:-"not set"}"
    else
        warn "No .env file found"
    fi
    
    # Service status
    echo ""
    info "Service Status:"
    
    # Typesense
    if curl -f http://localhost:8108/health &> /dev/null; then
        echo "   ✅ Typesense (port 8108): Running"
    else
        echo "   ❌ Typesense (port 8108): Not running"
    fi
    
    # Meilisearch
    if curl -f http://localhost:7700/health &> /dev/null; then
        echo "   ✅ Meilisearch (port 7700): Running"
    else
        echo "   ❌ Meilisearch (port 7700): Not running"
    fi
    
    # Colima
    if colima status &> /dev/null; then
        echo "   ✅ Colima: Running"
    else
        echo "   ❌ Colima: Not running"
    fi
    
    # API status
    echo ""
    if curl -f http://localhost:3001/api/health &> /dev/null; then
        local api_info=$(curl -s http://localhost:3001/api/health | jq -r '.provider // "unknown"' 2>/dev/null || echo "unknown")
        echo "   ✅ API (port 3001): Running with $api_info"
    else
        echo "   ❌ API (port 3001): Not running"
    fi
}

# Cleanup all services
cleanup() {
    log "🧹 Cleaning up all services..."
    
    # Stop all containers
    docker-compose down --remove-orphans &> /dev/null || true
    docker-compose -f docker-compose.meilisearch.yml down --remove-orphans &> /dev/null || true
    
    # Remove any orphaned containers by name
    docker rm -f fs-search-typesense fs-search-meilisearch fs-search-api fs-search-app-meilisearch &> /dev/null || true
    
    # Clean up networks and unused volumes
    docker network prune -f &> /dev/null || true
    docker volume prune -f &> /dev/null || true
    
    # Restore backup if exists
    restore_env
    
    log "✅ Cleanup complete - all containers, networks, and volumes removed"
}

# Show help
show_help() {
    echo ""
    highlight "🔄 FS-Search Provider Switching Tool"
    echo "==========================================="
    echo ""
    info "🎯 Purpose: Elegantly switch between Typesense and Meilisearch for local testing"
    echo ""
    info "📋 Usage: $0 <command> [options]"
    echo ""
    echo "🔧 Commands:"
    echo "  switch <provider>   Switch to specific provider (typesense|meilisearch)"
    echo "  compare            Start both providers for side-by-side testing"
    echo "  status             Show current status of all services"
    echo "  cleanup            Stop all services and restore environment"
    echo "  help               Show this help message"
    echo ""
    echo "💡 Examples:"
    echo "  $0 switch typesense      # Switch to Typesense (fast, typo-tolerant)"
    echo "  $0 switch meilisearch    # Switch to Meilisearch (instant, relevant)"
    echo "  $0 compare               # Run both for direct comparison"
    echo "  $0 status                # Check what's currently running"
    echo "  $0 cleanup               # Clean slate (stop everything)"
    echo ""
    echo "⚡ Quick Workflow:"
    echo "  1. $0 switch typesense    # Set up Typesense"
    echo "  2. npm run api            # Start API server"
    echo "  3. Test your searches     # Use the provided curl commands"
    echo "  4. $0 switch meilisearch  # Switch to Meilisearch"
    echo "  5. Compare results        # Same API, different search engine!"
    echo ""
    echo "📋 Prerequisites:"
    echo "  ✅ Colima installed and running (enterprise compliance)"
    echo "  ✅ Node.js and npm available"
    echo "  ✅ Run from project root directory"
    echo ""
    info "🚀 Pro tip: Use '$0 compare' to run both providers simultaneously"
    info "           for true side-by-side performance testing!"
}

# Main function
main() {
    local command="${1:-help}"
    
    case "$command" in
        "switch")
            local provider="$2"
            if [[ -z "$provider" ]]; then
                error "Provider required. Usage: $0 switch <typesense|meilisearch>"
            fi
            
            if [[ "$provider" != "typesense" && "$provider" != "meilisearch" ]]; then
                error "Invalid provider: $provider. Use 'typesense' or 'meilisearch'"
            fi
            
            check_prerequisites
            switch_to_provider "$provider"
            ;;
        "compare")
            check_prerequisites
            compare_providers
            ;;
        "status")
            show_status
            ;;
        "cleanup")
            cleanup
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            error "Unknown command: $command. Use 'help' for usage information."
            ;;
    esac
}

# Run main function with all arguments
main "$@"
