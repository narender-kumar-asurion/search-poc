#!/bin/bash

# Colima Setup Script for FS-Search
# Alternative to Docker Desktop on macOS

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

check_existing_docker() {
    if command -v docker &> /dev/null; then
        warn "Docker CLI is already installed"
        info "Current Docker context: $(docker context show 2>/dev/null || echo 'none')"
        
        # Check if it's pointing to an unsupported runtime
        local docker_host=$(docker context inspect --format '{{.Endpoints.docker.Host}}' 2>/dev/null || echo "")
        if [[ "$docker_host" == *"docker-desktop"* ]]; then
            error "Existing Docker installation points to unsupported runtime. Please clean up first."
        fi
    fi
}

check_homebrew() {
    if ! command -v brew &> /dev/null; then
        error "Homebrew is required but not installed. Install from https://brew.sh"
    fi
    log "✅ Homebrew is installed"
}

install_colima() {
    if command -v colima &> /dev/null; then
        log "✅ Colima is already installed"
        colima version
    else
        log "📦 Installing Colima..."
        brew install colima
        log "✅ Colima installed successfully"
    fi
}

install_docker_cli() {
    if command -v docker &> /dev/null; then
        log "✅ Docker CLI is already installed"
    else
        log "📦 Installing Docker CLI..."
        brew install docker
        log "✅ Docker CLI installed successfully"
    fi
}

install_docker_compose() {
    if command -v docker-compose &> /dev/null; then
        log "✅ Docker Compose is already installed"
    else
        log "📦 Installing Docker Compose..."
        brew install docker-compose
        log "✅ Docker Compose installed successfully"
    fi
}

start_colima() {
    if colima status &> /dev/null; then
        log "✅ Colima is already running"
        colima status
    else
        log "🚀 Starting Colima..."
        
        # Start with reasonable defaults for development
        colima start \
            --cpu 4 \
            --memory 8 \
            --disk 60 \
            --arch $(uname -m) \
            --vm-type=qemu \
            --mount-type=sshfs \
            --dns=1.1.1.1
        
        log "✅ Colima started successfully"
    fi
}

verify_docker() {
    log "🔍 Verifying Docker setup..."
    
    if ! docker version &> /dev/null; then
        error "Docker is not working properly"
    fi
    
    if ! docker-compose version &> /dev/null; then
        error "Docker Compose is not working properly"
    fi
    
    log "✅ Docker and Docker Compose are working"
    
    # Show Docker info
    echo
    info "Docker Context: $(docker context show)"
    info "Docker Version: $(docker version --format '{{.Client.Version}}')"
    info "Docker Compose Version: $(docker-compose version --short)"
}

pull_required_images() {
    log "📥 Pulling required Docker images..."
    
    # Pull Typesense image
    docker pull typesense/typesense:0.25.0
    
    # Pull Node.js image for building
    docker pull node:18-alpine
    
    log "✅ Required images pulled successfully"
}

setup_development_environment() {
    log "🛠️  Setting up development environment..."
    
    # Create necessary directories
    mkdir -p logs
    mkdir -p typesense-dev-data
    
    # Set proper permissions for Colima
    chmod 755 logs
    chmod 755 typesense-dev-data
    
    log "✅ Development environment setup complete"
}

test_docker_setup() {
    log "🧪 Testing Docker setup with Typesense..."
    
    # Test if we can run a simple container
    if docker run --rm hello-world &> /dev/null; then
        log "✅ Basic Docker functionality works"
    else
        error "Basic Docker functionality is not working"
    fi
    
    # Test Typesense container
    log "🧪 Testing Typesense container..."
    
    # Start Typesense in background
    docker run -d \
        --name typesense-test \
        -p 8108:8108 \
        typesense/typesense:0.25.0 \
        --data-dir /data \
        --api-key=dev-api-key-change-in-production \
        --enable-cors \
        --log-level=info
    
    # Wait for startup
    sleep 5
    
    # Test health endpoint
    if curl -f http://localhost:8108/health &> /dev/null; then
        log "✅ Typesense container is working"
    else
        warn "Typesense health check failed, but container may still be starting"
    fi
    
    # Cleanup test container
    docker stop typesense-test &> /dev/null || true
    docker rm typesense-test &> /dev/null || true
    
    log "✅ Docker setup test completed"
}

show_next_steps() {
    echo
    log "🎉 Colima setup completed successfully!"
    echo
    info "Next steps:"
    echo "1. Install Node.js dependencies: npm install"
    echo "2. Start development environment: npm run docker:dev"
    echo "3. Or start services individually:"
    echo "   - Start Typesense: docker run -p 8108:8108 typesense/typesense:0.25.0 --data-dir /data --api-key=dev-api-key-change-in-production --enable-cors"
    echo "   - Start API: npm run api"
    echo "   - Start frontend: npm run frontend"
    echo
    info "Useful Colima commands:"
    echo "  colima status     - Check if Colima is running"
    echo "  colima stop       - Stop Colima"
    echo "  colima restart    - Restart Colima"
    echo "  colima delete     - Delete Colima VM"
    echo "  colima ssh        - SSH into Colima VM"
    echo
}

main() {
    log "🚀 Setting up Colima for FS-Search development..."
    echo
    
    check_homebrew
    check_existing_docker
    install_colima
    install_docker_cli
    install_docker_compose
    start_colima
    verify_docker
    pull_required_images
    setup_development_environment
    test_docker_setup
    show_next_steps
}

# Handle command line arguments
case "${1:-setup}" in
    "setup")
        main
        ;;
    "start")
        start_colima
        verify_docker
        ;;
    "stop")
        log "🛑 Stopping Colima..."
        colima stop
        log "✅ Colima stopped"
        ;;
    "restart")
        log "🔄 Restarting Colima..."
        colima restart
        verify_docker
        ;;
    "status")
        colima status
        verify_docker
        ;;
    "test")
        verify_docker
        test_docker_setup
        ;;
    "help"|"-h"|"--help")
        echo "Colima Setup Script for FS-Search"
        echo
        echo "Usage: $0 [command]"
        echo
        echo "Commands:"
        echo "  setup     - Full setup (default)"
        echo "  start     - Start Colima"
        echo "  stop      - Stop Colima"
        echo "  restart   - Restart Colima"
        echo "  status    - Show Colima status"
        echo "  test      - Test Docker functionality"
        echo "  help      - Show this help"
        ;;
    *)
        error "Unknown command: $1. Use 'help' for usage information."
        ;;
esac