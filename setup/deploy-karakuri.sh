#!/bin/bash

# Karakuri LM 8x7b Instruct Deployment Script
# Run this after setting up proper AWS permissions

set -e

echo "🚀 Deploying Karakuri LM 8x7b Instruct Model"
echo "==========================================="

# Configuration
MODEL_PACKAGE="arn:aws:sagemaker:ap-northeast-1:977537786026:model-package/karakuri-lm-8x7b-instruct-v01--6fc27dec3a3b3096a4b04681dfd1daac"
REGION="ap-northeast-1"
INSTANCE_TYPE="ml.g6.48xlarge"
TIMESTAMP=$(date +%s)

MODEL_NAME="Model-KARAKURI-LM-8x7b-instruct-${TIMESTAMP}"
ENDPOINT_CONFIG_NAME="EndpointConfig-KARAKURI-LM-8x7b-instruct-${TIMESTAMP}"
ENDPOINT_NAME="Endpoint-KARAKURI-LM-8x7b-instruct-${TIMESTAMP}"

# Get execution role (you may need to set this manually)
if [ -z "$EXECUTION_ROLE_ARN" ]; then
    echo "❌ Please set EXECUTION_ROLE_ARN environment variable"
    echo "Example: export EXECUTION_ROLE_ARN='arn:aws:iam::YOUR_ACCOUNT:role/SageMakerExecutionRole'"
    exit 1
fi

echo "📋 Deployment Configuration:"
echo "  Model Package: $MODEL_PACKAGE"
echo "  Region: $REGION"
echo "  Instance Type: $INSTANCE_TYPE"
echo "  Model Name: $MODEL_NAME"
echo "  Endpoint Name: $ENDPOINT_NAME"
echo "  Execution Role: $EXECUTION_ROLE_ARN"
echo ""

# Step 1: Create Model
echo "🔧 Step 1: Creating SageMaker model..."
aws sagemaker create-model \
  --model-name "$MODEL_NAME" \
  --execution-role-arn "$EXECUTION_ROLE_ARN" \
  --primary-container ModelPackageName="$MODEL_PACKAGE" \
  --enable-network-isolation \
  --region "$REGION"

echo "✅ Model created: $MODEL_NAME"

# Step 2: Create Endpoint Configuration
echo "🔧 Step 2: Creating endpoint configuration..."
aws sagemaker create-endpoint-config \
  --endpoint-config-name "$ENDPOINT_CONFIG_NAME" \
  --production-variants VariantName=variant-1,ModelName="$MODEL_NAME",InstanceType="$INSTANCE_TYPE",InitialInstanceCount=1,ModelDataDownloadTimeoutInSeconds=3600 \
  --region "$REGION"

echo "✅ Endpoint configuration created: $ENDPOINT_CONFIG_NAME"

# Step 3: Create Endpoint
echo "🔧 Step 3: Creating endpoint (this may take 5-10 minutes)..."
aws sagemaker create-endpoint \
  --endpoint-name "$ENDPOINT_NAME" \
  --endpoint-config-name "$ENDPOINT_CONFIG_NAME" \
  --region "$REGION"

echo "✅ Endpoint creation initiated: $ENDPOINT_NAME"

# Step 4: Wait for endpoint to be ready
echo "⏳ Waiting for endpoint to be ready..."
while true; do
    STATUS=$(aws sagemaker describe-endpoint \
      --endpoint-name "$ENDPOINT_NAME" \
      --region "$REGION" \
      --query 'EndpointStatus' \
      --output text)

    echo "Current status: $STATUS"

    if [ "$STATUS" = "InService" ]; then
        break
    elif [ "$STATUS" = "Failed" ]; then
        echo "❌ Endpoint creation failed!"
        exit 1
    fi

    sleep 30
done

echo "🎉 Endpoint is ready!"
echo ""
echo "📋 Endpoint Details:"
echo "  Endpoint Name: $ENDPOINT_NAME"
echo "  Region: $REGION"
echo "  Status: InService"
echo ""

# Step 5: Test the endpoint
echo "🧪 Testing endpoint with sample input..."
aws sagemaker-runtime invoke-endpoint \
  --endpoint-name "$ENDPOINT_NAME" \
  --body fileb://karakuri-test-input.json \
  --content-type application/json \
  --region "$REGION" \
  karakuri-test-output.json

echo "📄 Test response saved to karakuri-test-output.json"
cat karakuri-test-output.json
echo ""

echo "🎯 Karakuri LM deployment completed successfully!"
echo ""
echo "💡 Next steps:"
echo "  1. Update your Sanden system configuration to use this endpoint"
echo "  2. Test with actual repair scenarios"
echo "  3. Monitor costs and performance"
echo ""
echo "🧹 To clean up resources when done:"
echo "  aws sagemaker delete-endpoint --endpoint-name $ENDPOINT_NAME --region $REGION"
echo "  aws sagemaker delete-endpoint-config --endpoint-config-name $ENDPOINT_CONFIG_NAME --region $REGION"
echo "  aws sagemaker delete-model --model-name $MODEL_NAME --region $REGION"
