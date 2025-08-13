#!/bin/bash

# FS-Search Deployment Script
set -e

# Configuration
NAMESPACE="fs-search"
REGISTRY="${DOCKER_REGISTRY:-localhost:5000}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
ENVIRONMENT="${ENVIRONMENT:-development}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is not installed or not in PATH"
    fi
    
    # Check docker
    if ! command -v docker &> /dev/null; then
        error "docker is not installed or not in PATH"
    fi
    
    # Check cluster connectivity
    if ! kubectl cluster-info &> /dev/null; then
        error "Cannot connect to Kubernetes cluster"
    fi
    
    log "Prerequisites check passed"
}

build_and_push() {
    log "Building and pushing Docker image..."
    
    # Build the image
    docker build -t ${REGISTRY}/fs-search:${IMAGE_TAG} .
    
    # Push to registry
    if [[ "$REGISTRY" != "localhost:5000" ]]; then
        docker push ${REGISTRY}/fs-search:${IMAGE_TAG}
        log "Image pushed to ${REGISTRY}/fs-search:${IMAGE_TAG}"
    else
        log "Using local registry, skipping push"
    fi
}

create_namespace() {
    log "Creating namespace..."
    kubectl apply -f k8s/namespace.yaml
}

setup_secrets() {
    log "Setting up secrets..."
    
    # Check if secrets exist
    if kubectl get secret typesense-secret -n $NAMESPACE &> /dev/null; then
        warn "typesense-secret already exists, skipping creation"
    else
        kubectl apply -f k8s/typesense-secret.yaml
    fi
    
    if kubectl get secret aws-secret -n $NAMESPACE &> /dev/null; then
        warn "aws-secret already exists, skipping creation"
    else
        kubectl apply -f k8s/aws-secret.yaml
    fi
}

deploy_typesense() {
    log "Deploying Typesense..."
    
    # Apply configuration
    kubectl apply -f k8s/typesense-configmap.yaml
    kubectl apply -f k8s/typesense-pvc.yaml
    
    # Deploy Typesense
    kubectl apply -f k8s/typesense-statefulset.yaml
    kubectl apply -f k8s/typesense-service.yaml
    
    # Wait for Typesense to be ready
    log "Waiting for Typesense to be ready..."
    kubectl wait --for=condition=ready pod -l app=typesense -n $NAMESPACE --timeout=300s
}

deploy_application() {
    log "Deploying application..."
    
    # Update image in deployment
    sed -i.bak "s|image: fs-search:latest|image: ${REGISTRY}/fs-search:${IMAGE_TAG}|g" k8s/app-deployment.yaml
    
    # Apply deployment
    kubectl apply -f k8s/app-deployment.yaml
    
    # Restore original file
    mv k8s/app-deployment.yaml.bak k8s/app-deployment.yaml
    
    # Wait for application to be ready
    log "Waiting for application to be ready..."
    kubectl wait --for=condition=available deployment/fs-search-api -n $NAMESPACE --timeout=300s
}

setup_ingress() {
    if [[ "$ENVIRONMENT" == "production" || "$ENVIRONMENT" == "staging" ]]; then
        log "Setting up ingress..."
        kubectl apply -f k8s/ingress.yaml
    else
        log "Skipping ingress setup for $ENVIRONMENT environment"
    fi
}

run_initial_setup() {
    log "Running initial data seeding..."
    
    # Get a pod to run the seeding command
    POD_NAME=$(kubectl get pods -n $NAMESPACE -l app=fs-search-api -o jsonpath='{.items[0].metadata.name}')
    
    if [[ -n "$POD_NAME" ]]; then
        kubectl exec -n $NAMESPACE $POD_NAME -- npm run seed
        log "Initial data seeding completed"
    else
        warn "No application pods found, skipping data seeding"
    fi
}

verify_deployment() {
    log "Verifying deployment..."
    
    # Check pod status
    kubectl get pods -n $NAMESPACE
    
    # Check services
    kubectl get svc -n $NAMESPACE
    
    # Test health endpoints
    log "Testing health endpoints..."
    
    # Port forward and test (background process)
    kubectl port-forward svc/fs-search-api-service 8080:80 -n $NAMESPACE &
    PORT_FORWARD_PID=$!
    
    sleep 5
    
    if curl -f http://localhost:8080/api/health &> /dev/null; then
        log "Application health check passed"
    else
        warn "Application health check failed"
    fi
    
    # Clean up port forward
    kill $PORT_FORWARD_PID 2>/dev/null || true
}

cleanup() {
    log "Cleaning up..."
    # Kill any background processes
    jobs -p | xargs -r kill 2>/dev/null || true
}

main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --registry)
                REGISTRY="$2"
                shift 2
                ;;
            --tag)
                IMAGE_TAG="$2"
                shift 2
                ;;
            --environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --skip-seed)
                SKIP_SEED=true
                shift
                ;;
            -h|--help)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --registry <registry>    Docker registry (default: localhost:5000)"
                echo "  --tag <tag>             Image tag (default: latest)"
                echo "  --environment <env>     Environment (default: development)"
                echo "  --skip-build           Skip Docker build and push"
                echo "  --skip-seed            Skip initial data seeding"
                echo "  -h, --help             Show this help message"
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                ;;
        esac
    done
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    log "Starting deployment to $ENVIRONMENT environment..."
    log "Registry: $REGISTRY"
    log "Image tag: $IMAGE_TAG"
    
    # Run deployment steps
    check_prerequisites
    
    if [[ "$SKIP_BUILD" != "true" ]]; then
        build_and_push
    fi
    
    create_namespace
    setup_secrets
    deploy_typesense
    deploy_application
    setup_ingress
    
    if [[ "$SKIP_SEED" != "true" ]]; then
        run_initial_setup
    fi
    
    verify_deployment
    
    log "Deployment completed successfully!"
    log "Access the application at:"
    
    if [[ "$ENVIRONMENT" == "production" || "$ENVIRONMENT" == "staging" ]]; then
        log "  External: https://fs-search.local/api/health"
    fi
    
    log "  Port forward: kubectl port-forward svc/fs-search-api-service 8080:80 -n $NAMESPACE"
    log "  Then visit: http://localhost:8080/api/health"
}

# Run main function
main "$@"