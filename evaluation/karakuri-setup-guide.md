# Karakuri LM 8x7b Instruct Setup Guide

## 🚨 Permission Issue Detected

The current AWS user (`BedrockAPIKey-zmax`) doesn't have SageMaker permissions. Here are **3 solutions**:

---

## Solution 1: Use AWS Console (Recommended for Beginners)

### Step-by-Step AWS Console Setup:

1. **Go to AWS SageMaker Console**:
   - Open https://console.aws.amazon.com/sagemaker/
   - Select "Asia Pacific (Tokyo)" region

2. **Subscribe to Karakuri Model**:
   - Go to AWS Marketplace: https://aws.amazon.com/marketplace
   - Search for "KARAKURI LM 8x7b instruct"
   - Click "Continue to Subscribe"
   - Accept terms and subscribe

3. **Deploy the Model**:
   - After subscribing, click "Continue to Configuration"
   - Select "SageMaker console" launch method
   - Click "View in Amazon SageMaker"
   - Choose "Create endpoint"
   - Select instance type: `ml.g6.48xlarge` (recommended)
   - Create endpoint (takes 5-10 minutes)

---

## Solution 2: Create IAM User with SageMaker Permissions

### Create New IAM User:

```bash
# Create IAM user
aws iam create-user --user-name SageMakerUser

# Create access key
aws iam create-access-key --user-name SageMakerUser

# Attach SageMaker policies
aws iam attach-user-policy --user-name SageMakerUser --policy-arn arn:aws:iam::aws:policy/AmazonSageMakerFullAccess
aws iam attach-user-policy --user-name SageMakerUser --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess

# Configure AWS CLI with new user credentials
aws configure --profile karakuri
# Enter the access key and secret key from create-access-key
```

### Deploy with New User:

```bash
# Use the new profile
export AWS_PROFILE=karakuri

# Set variables
export MODEL_PACKAGE="arn:aws:sagemaker:ap-northeast-1:977537786026:model-package/karakuri-lm-8x7b-instruct-v01--6fc27dec3a3b3096a4b04681dfd1daac"
export REGION="ap-northeast-1"
export INSTANCE_TYPE="ml.g6.48xlarge"
export MODEL_NAME="Model-KARAKURI-LM-8x7b-instruct-$(date +%s)"
export ENDPOINT_CONFIG_NAME="EndpointConfig-KARAKURI-LM-8x7b-instruct-$(date +%s)"
export ENDPOINT_NAME="Endpoint-KARAKURI-LM-8x7b-instruct-$(date +%s)"

# Get SageMaker execution role
aws iam list-roles --query 'Roles[?AssumeRolePolicyDocument.Statement[?Principal.Service==`sagemaker.amazonaws.com`]].{Arn:Arn,RoleName:RoleName}' --output table
export EXECUTION_ROLE_ARN="arn:aws:iam::788125169579:role/service-role/AmazonSagemaker-ExecutionRole-20250924P121023"

# Create model
aws sagemaker create-model \
  --model-name "$MODEL_NAME" \
  --execution-role-arn "$EXECUTION_ROLE_ARN" \
  --primary-container ModelPackageName="$MODEL_PACKAGE" \
  --enable-network-isolation \
  --region "$REGION"

# Create endpoint config
aws sagemaker create-endpoint-config \
  --endpoint-config-name "$ENDPOINT_CONFIG_NAME" \
  --production-variants VariantName=variant-1,ModelName="$MODEL_NAME",InstanceType="$INSTANCE_TYPE",InitialInstanceCount=1,ModelDataDownloadTimeoutInSeconds=3600 \
  --region "$REGION"

# Create endpoint
aws sagemaker create-endpoint \
  --endpoint-name "$ENDPOINT_NAME" \
  --endpoint-config-name "$ENDPOINT_CONFIG_NAME" \
  --region "$REGION"

# Wait for endpoint to be ready (5-10 minutes)
aws sagemaker describe-endpoint --endpoint-name "$ENDPOINT_NAME" --region "$REGION" --query 'EndpointStatus'
```

---

## Solution 3: Use Existing Admin/Root Account

If you have access to an AWS account with admin permissions:

1. Switch to admin credentials:
   ```bash
   aws configure --profile admin
   export AWS_PROFILE=admin
   ```

2. Run the deployment commands from Solution 2.

---

## 📋 Model Specifications

- **Model**: Karakuri LM 8x7b Instruct
- **Version**: v0.1.1
- **Region**: Asia Pacific (Tokyo)
- **Instance Type**: ml.g6.48xlarge (recommended)
- **Pricing**: ~$5-10/hour depending on region and instance
- **Use Case**: Japanese language tasks, instruction following

---

## 🧪 Testing the Model

Once deployed, create a test file:

```json
// test-input.json
{
  "inputs": "こんにちは、自己紹介をお願いします。",
  "parameters": {
    "max_new_tokens": 100,
    "temperature": 0.7,
    "do_sample": true
  }
}
```

Test inference:
```bash
aws sagemaker-runtime invoke-endpoint \
  --endpoint-name "$ENDPOINT_NAME" \
  --body fileb://test-input.json \
  --content-type application/json \
  --region "$REGION" \
  output.json

cat output.json
```

---

## 🔗 Integration with Sanden System

Once Karakuri is deployed, integrate it into your Sanden repair system by updating the LLM configuration in your codebase.

Would you like me to help you with any of these approaches, or do you have access to an AWS account with SageMaker permissions?
