#!/bin/bash

# LocalStack initialization script for AWS resources
# This script runs when LocalStack is ready

echo "Initializing LocalStack AWS resources..."

# Wait for LocalStack to be ready
echo "Waiting for LocalStack to be ready..."
until awslocal --endpoint-url=http://localhost:4566 sts get-caller-identity > /dev/null 2>&1; do
  echo "LocalStack not ready yet, waiting..."
  sleep 2
done

echo "LocalStack is ready, creating resources..."

# Create SQS queues
echo "Creating SQS queues..."

# Create Dead Letter Queue first
awslocal sqs create-queue \
  --queue-name search-sync-dlq \
  --attributes VisibilityTimeoutSeconds=30,MessageRetentionPeriod=1209600

DLQ_URL=$(awslocal sqs get-queue-url --queue-name search-sync-dlq --query 'QueueUrl' --output text)
DLQ_ARN=$(awslocal sqs get-queue-attributes --queue-url $DLQ_URL --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)

echo "Dead Letter Queue created: $DLQ_ARN"

# Create main queue with DLQ configuration
awslocal sqs create-queue \
  --queue-name search-sync-queue \
  --attributes '{
    "VisibilityTimeoutSeconds": "30",
    "MessageRetentionPeriod": "1209600",
    "RedrivePolicy": "{\"deadLetterTargetArn\":\"'$DLQ_ARN'\",\"maxReceiveCount\":3}"
  }'

QUEUE_URL=$(awslocal sqs get-queue-url --queue-name search-sync-queue --query 'QueueUrl' --output text)
QUEUE_ARN=$(awslocal sqs get-queue-attributes --queue-url $QUEUE_URL --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)

echo "Main queue created: $QUEUE_ARN"

# Create SNS topic
echo "Creating SNS topic..."
awslocal sns create-topic --name search-events

TOPIC_ARN=$(awslocal sns list-topics --query 'Topics[?contains(TopicArn, `search-events`)].TopicArn' --output text)
echo "SNS topic created: $TOPIC_ARN"

# Subscribe SQS queue to SNS topic for fan-out
echo "Subscribing SQS queue to SNS topic..."
awslocal sns subscribe \
  --topic-arn $TOPIC_ARN \
  --protocol sqs \
  --notification-endpoint $QUEUE_ARN

# Set queue policy to allow SNS to send messages
awslocal sqs set-queue-attributes \
  --queue-url $QUEUE_URL \
  --attributes '{
    "Policy": "{
      \"Version\": \"2012-10-17\",
      \"Statement\": [
        {
          \"Effect\": \"Allow\",
          \"Principal\": \"*\",
          \"Action\": \"sqs:SendMessage\",
          \"Resource\": \"'$QUEUE_ARN'\",
          \"Condition\": {
            \"ArnEquals\": {
              \"aws:SourceArn\": \"'$TOPIC_ARN'\"
            }
          }
        }
      ]
    }"
  }'

echo "SQS-SNS integration configured"

# Create some test messages (optional)
echo "Creating test messages..."
awslocal sqs send-message \
  --queue-url $QUEUE_URL \
  --message-body '{
    "op": "upsert",
    "index": "claims", 
    "idField": "id",
    "documents": [
      {
        "id": "test-001",
        "claim_id": "TEST-001",
        "customer_name": "Test Customer",
        "status": "OPEN",
        "amount": 1000.00,
        "created_at": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
      }
    ]
  }' \
  --message-attributes '{
    "MessageType": {
      "StringValue": "DocumentSync",
      "DataType": "String"
    },
    "Source": {
      "StringValue": "TestScript",
      "DataType": "String"
    }
  }'

echo "Test message sent to queue"

# List created resources
echo "=== Created Resources ==="
echo "SQS Queues:"
awslocal sqs list-queues

echo ""
echo "SNS Topics:"
awslocal sns list-topics

echo ""
echo "LocalStack initialization completed successfully!"

# Save resource ARNs to a file for easy reference
cat > /tmp/localstack/aws-resources.json << EOF
{
  "sqs": {
    "queue_url": "$QUEUE_URL",
    "queue_arn": "$QUEUE_ARN",
    "dlq_url": "$DLQ_URL",
    "dlq_arn": "$DLQ_ARN"
  },
  "sns": {
    "topic_arn": "$TOPIC_ARN"
  }
}
EOF

echo "Resource details saved to /tmp/localstack/aws-resources.json"
