#!/bin/bash

# Karakuri SageMaker Setup Script
# Usage: ./setup-karakuri-sagemaker.sh <execution-role-arn> [instance-type]

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Validate arguments
if [ $# -lt 1 ]; then
    echo -e "${RED}❌ Error: Execution role ARN is required${NC}"
    echo -e "${YELLOW}Usage: $0 <execution-role-arn> [instance-type]${NC}"
    echo -e "${BLUE}Example: $0 arn:aws:iam::123456789012:role/SageMaker-Karakuri-Role ml.g6.48xlarge${NC}"
    exit 1
fi

EXECUTION_ROLE_ARN=$1
INSTANCE_TYPE=${2:-ml.g6.48xlarge}
REGION=ap-northeast-1

MODEL_PACKAGE=arn:aws:sagemaker:ap-northeast-1:977537786026:model-package/karakuri-lm-8x7b-instruct-v01--6fc27dec3a3b3096a4b04681dfd1daac
MODEL_NAME=Karakuri-LM-8x7b-Instruct-$(date +%s)
ENDPOINT_CONFIG_NAME=Karakuri-EndpointConfig-$(date +%s)
ENDPOINT_NAME=Karakuri-Endpoint-$(date +%s)

echo -e "${BLUE}🚀 Setting up Karakuri LM 8x7B Instruct on SageMaker${NC}"
echo -e "${YELLOW}Region:${NC} $REGION"
echo -e "${YELLOW}Instance Type:${NC} $INSTANCE_TYPE"
echo -e "${YELLOW}Execution Role:${NC} $EXECUTION_ROLE_ARN"
echo ""

# Check AWS CLI configuration
echo -e "${BLUE}🔍 Checking AWS CLI configuration...${NC}"
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not configured or credentials invalid${NC}"
    echo -e "${YELLOW}Run 'aws configure' to set up your credentials${NC}"
    exit 1
fi

# Check if role exists
echo -e "${BLUE}🔍 Validating execution role...${NC}"
if ! aws iam get-role --role-name $(basename "$EXECUTION_ROLE_ARN") &> /dev/null; then
    echo -e "${RED}❌ Execution role does not exist or you don't have permission to access it${NC}"
    echo -e "${YELLOW}Please verify the role ARN and your permissions${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites validated${NC}"
echo ""

echo -e "${BLUE}1️⃣ Creating SageMaker model...${NC}"
if aws sagemaker create-model \
 --model-name ${MODEL_NAME} \
 --execution-role-arn ${EXECUTION_ROLE_ARN} \
 --primary-container ModelPackageName=${MODEL_PACKAGE} \
 --enable-network-isolation \
 --region ${REGION} 2>/dev/null; then
    echo -e "${GREEN}✅ Model created successfully: ${MODEL_NAME}${NC}"
else
    echo -e "${RED}❌ Failed to create model${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}2️⃣ Creating endpoint configuration...${NC}"
if aws sagemaker create-endpoint-config \
 --endpoint-config-name ${ENDPOINT_CONFIG_NAME} \
 --production-variants VariantName=variant-1,ModelName=${MODEL_NAME},InstanceType=${INSTANCE_TYPE},InitialInstanceCount=1,ModelDataDownloadTimeoutInSeconds=3600 \
 --region ${REGION} 2>/dev/null; then
    echo -e "${GREEN}✅ Endpoint configuration created: ${ENDPOINT_CONFIG_NAME}${NC}"
else
    echo -e "${RED}❌ Failed to create endpoint configuration${NC}"
    # Cleanup model
    aws sagemaker delete-model --model-name ${MODEL_NAME} --region ${REGION} 2>/dev/null || true
    exit 1
fi

echo ""
echo -e "${BLUE}3️⃣ Creating endpoint...${NC}"
if aws sagemaker create-endpoint \
 --endpoint-name ${ENDPOINT_NAME} \
 --endpoint-config-name ${ENDPOINT_CONFIG_NAME} \
 --region ${REGION} 2>/dev/null; then
    echo -e "${GREEN}✅ Endpoint creation initiated: ${ENDPOINT_NAME}${NC}"
else
    echo -e "${RED}❌ Failed to create endpoint${NC}"
    # Cleanup
    aws sagemaker delete-endpoint-config --endpoint-config-name ${ENDPOINT_CONFIG_NAME} --region ${REGION} 2>/dev/null || true
    aws sagemaker delete-model --model-name ${MODEL_NAME} --region ${REGION} 2>/dev/null || true
    exit 1
fi

echo ""
echo -e "${YELLOW}⏳ Waiting for endpoint to be ready (this may take 5-10 minutes)...${NC}"

# Wait for endpoint to be ready
ATTEMPTS=0
MAX_ATTEMPTS=20  # 10 minutes with 30 second intervals

while [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
  STATUS=$(aws sagemaker describe-endpoint --endpoint-name ${ENDPOINT_NAME} --region ${REGION} --query 'EndpointStatus' --output text 2>/dev/null)

  if [ "$STATUS" = "InService" ]; then
    echo ""
    echo -e "${GREEN}✅ Karakuri endpoint ready!${NC}"
    break
  elif [ "$STATUS" = "Failed" ] || [ "$STATUS" = "RollingBack" ]; then
    echo ""
    echo -e "${RED}❌ Endpoint creation failed with status: $STATUS${NC}"
    echo -e "${YELLOW}Check AWS SageMaker console for detailed error messages${NC}"
    exit 1
  else
    echo -e "${BLUE}Endpoint status: $STATUS (attempt $((ATTEMPTS+1))/$MAX_ATTEMPTS)${NC}"
    sleep 30
    ((ATTEMPTS++))
  fi
done

if [ $ATTEMPTS -eq $MAX_ATTEMPTS ]; then
    echo ""
    echo -e "${RED}❌ Timeout waiting for endpoint to be ready${NC}"
    echo -e "${YELLOW}Check AWS SageMaker console for current status${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎯 Karakuri SageMaker setup completed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Configuration Details:${NC}"
echo -e "${YELLOW}Model Name:${NC} ${MODEL_NAME}"
echo -e "${YELLOW}Endpoint Config:${NC} ${ENDPOINT_CONFIG_NAME}"
echo -e "${YELLOW}Endpoint Name:${NC} ${ENDPOINT_NAME}"
echo -e "${YELLOW}Region:${NC} ${REGION}"
echo ""

# Create environment variables file
echo -e "${BLUE}📝 Creating environment configuration...${NC}"
cat > karakuri-env.sh << EOF
# Karakuri SageMaker Configuration
# Add these to your server.env file

export KARAKURI_ENDPOINT_NAME="${ENDPOINT_NAME}"
export KARAKURI_REGION="${REGION}"
export KARAKURI_MODEL_TYPE="sagemaker"
export KARAKURI_CONTENT_TYPE="application/json"
export KARAKURI_MODEL_NAME="${MODEL_NAME}"
export KARAKURI_ENDPOINT_CONFIG="${ENDPOINT_CONFIG_NAME}"
EOF

echo -e "${GREEN}✅ Environment configuration saved to karakuri-env.sh${NC}"
echo ""

echo -e "${YELLOW}⚠️  Important Notes:${NC}"
echo -e "${RED}💰 Costs are incurred while the endpoint is running${NC}"
echo -e "${YELLOW}🧹 Don't forget to run cleanup when done:${NC}"
echo -e "   aws sagemaker delete-endpoint --endpoint-name ${ENDPOINT_NAME} --region ${REGION}"
echo -e "   aws sagemaker delete-endpoint-config --endpoint-config-name ${ENDPOINT_CONFIG_NAME} --region ${REGION}"
echo -e "   aws sagemaker delete-model --model-name ${MODEL_NAME} --region ${REGION}"
echo ""

echo -e "${GREEN}🚀 Next steps:${NC}"
echo -e "1. Add the variables from karakuri-env.sh to your server.env"
echo -e "2. Create the SageMaker integration (see setup-karakuri-sagemaker.md)"
echo -e "3. Test the connection with test-karakuri-sagemaker.js"
echo -e "4. Run GENIAC evaluation for performance metrics"
echo ""

echo -e "${BLUE}🇯🇵 Karakuri is ready for Japanese business applications!${NC}"
