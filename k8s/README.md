# Kubernetes Deployment Guide

This directory contains Kubernetes manifests for deploying the FS-Search application with self-hosted Typesense.

## Prerequisites

- Kubernetes cluster (1.19+)
- kubectl configured to connect to your cluster
- NGINX Ingress Controller (optional, for external access)
- Storage class configured for persistent volumes

## Quick Deployment

1. **Create namespace and secrets:**
```bash
# Apply namespace
kubectl apply -f namespace.yaml

# Update secrets with your values
kubectl apply -f typesense-secret.yaml
kubectl apply -f aws-secret.yaml
```

2. **Deploy Typesense:**
```bash
# Apply storage and configuration
kubectl apply -f typesense-pvc.yaml
kubectl apply -f typesense-configmap.yaml

# Deploy Typesense StatefulSet and services
kubectl apply -f typesense-statefulset.yaml
kubectl apply -f typesense-service.yaml
```

3. **Deploy application:**
```bash
# Build and push your application image first
docker build -t your-registry/fs-search:latest .
docker push your-registry/fs-search:latest

# Update image in app-deployment.yaml, then apply
kubectl apply -f app-deployment.yaml
```

4. **Setup ingress (optional):**
```bash
kubectl apply -f ingress.yaml
```

## Configuration

### Secrets Configuration

**Typesense Secret** (`typesense-secret.yaml`):
```yaml
stringData:
  TYPESENSE_API_KEY: "your-secure-api-key-here"
```

**AWS Secret** (`aws-secret.yaml`) - for real-time sync:
```yaml
stringData:
  AWS_ACCESS_KEY_ID: "AKIA..."
  AWS_SECRET_ACCESS_KEY: "..."
  SQS_QUEUE_URL: "https://sqs.us-west-2.amazonaws.com/123456789012/fs-search-updates"
  SNS_TOPIC_ARN: "arn:aws:sns:us-west-2:123456789012:fs-search-updates"
```

### ConfigMap Settings

Update `typesense-configmap.yaml` for your environment:
- `TYPESENSE_LOG_LEVEL`: INFO, DEBUG, ERROR
- `TYPESENSE_COLLECTION`: Default collection name
- Storage and performance settings

### Resource Sizing

**Typesense Resources:**
- Requests: 512Mi memory, 250m CPU
- Limits: 2Gi memory, 1000m CPU
- Storage: 10Gi (adjust based on data volume)

**Application Resources:**
- Requests: 256Mi memory, 100m CPU
- Limits: 512Mi memory, 500m CPU

## High Availability Setup

For production HA deployment:

1. **Scale Typesense to 3 replicas:**
```yaml
# In typesense-statefulset.yaml
spec:
  replicas: 3
```

2. **Configure cluster nodes:**
The StatefulSet automatically configures multi-node clustering via the `TYPESENSE_NODES` environment variable.

3. **Use pod anti-affinity:**
```yaml
# Add to StatefulSet spec.template.spec
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 100
      podAffinityTerm:
        labelSelector:
          matchExpressions:
          - key: app
            operator: In
            values:
            - typesense
        topologyKey: kubernetes.io/hostname
```

## Monitoring and Health Checks

### Health Endpoints

- **Typesense**: `http://typesense-service:8108/health`
- **Application**: `http://fs-search-api-service/api/health`

### Probes Configuration

All deployments include:
- **Liveness Probe**: Restarts unhealthy pods
- **Readiness Probe**: Controls traffic routing
- **Startup Probe**: Handles slow startup scenarios

### Monitoring

Add monitoring with Prometheus:
```yaml
# Add annotations to services
metadata:
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "8108"
    prometheus.io/path: "/metrics"
```

## Storage Considerations

### Storage Classes

Update `typesense-pvc.yaml` with appropriate storage class:
- **GKE**: `gce-pd-ssd`
- **EKS**: `gp3`
- **AKS**: `managed-premium`

### Backup Strategy

```bash
# Create backup job
kubectl create job --from=cronjob/typesense-backup typesense-backup-manual

# Restore from backup
kubectl apply -f backup-restore-job.yaml
```

## Scaling

### Horizontal Scaling

```bash
# Scale application pods
kubectl scale deployment fs-search-api --replicas=5

# Scale Typesense (for HA setup)
kubectl scale statefulset typesense --replicas=3
```

### Vertical Scaling

Update resource limits in deployment manifests and apply:
```bash
kubectl apply -f typesense-statefulset.yaml
kubectl apply -f app-deployment.yaml
```

## Troubleshooting

### Check pod status:
```bash
kubectl get pods -n fs-search
kubectl describe pod <pod-name> -n fs-search
```

### View logs:
```bash
kubectl logs -f deployment/fs-search-api -n fs-search
kubectl logs -f statefulset/typesense -n fs-search
```

### Check services:
```bash
kubectl get svc -n fs-search
kubectl port-forward svc/typesense-service 8108:8108 -n fs-search
```

### Debug networking:
```bash
# Test internal connectivity
kubectl run debug --image=curlimages/curl -it --rm -- sh
curl http://typesense-service.fs-search.svc.cluster.local:8108/health
```

## Security Considerations

1. **API Keys**: Use strong, unique API keys in secrets
2. **Network Policies**: Implement pod-to-pod communication restrictions
3. **RBAC**: Configure appropriate service account permissions
4. **TLS**: Enable TLS for external access via ingress
5. **Pod Security**: Use pod security standards (restricted)

## Performance Tuning

1. **Node Affinity**: Place Typesense pods on high-performance nodes
2. **Resource Limits**: Monitor and adjust based on usage patterns
3. **Storage**: Use SSD storage for better search performance
4. **Network**: Consider dedicated node pools for search workloads