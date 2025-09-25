#!/bin/bash

# Karakuri LM 8x7b Instruct Setup Script
# AWS Marketplace Model Deployment

echo "🚀 Setting up Karakuri LM 8x7b Instruct Model"
echo "=============================================="

# Set model package ARN (from AWS Marketplace)
export MODEL_PACKAGE="arn:aws:sagemaker:ap-northeast-1:977537786026:model-package/karakuri-lm-8x7b-instruct-v01--6fc27dec3a3b3096a4b04681dfd1daac"

# Set region
export REGION="ap-northeast-1"

# Set default instance type (seller recommended)
export INSTANCE_TYPE="ml.g6.48xlarge"

# Set names for resources
export MODEL_NAME="Model-KARAKURI-LM-8x7b-instruct-$(date +%s)"
export ENDPOINT_CONFIG_NAME="EndpointConfig-KARAKURI-LM-8x7b-instruct-$(date +%s)"
export ENDPOINT_NAME="Endpoint-KARAKURI-LM-8x7b-instruct-$(date +%s)"

echo "📋 Environment Variables Set:"
echo "  MODEL_PACKAGE: $MODEL_PACKAGE"
echo "  REGION: $REGION"
echo "  INSTANCE_TYPE: $INSTANCE_TYPE"
echo "  MODEL_NAME: $MODEL_NAME"
echo "  ENDPOINT_CONFIG_NAME: $ENDPOINT_CONFIG_NAME"
echo "  ENDPOINT_NAME: $ENDPOINT_NAME"
echo ""

# Check for existing SageMaker execution roles
echo "🔍 Checking for existing SageMaker execution roles..."
aws iam list-roles \
  --query 'Roles[?AssumeRolePolicyDocument.Statement[?Principal.Service==`sagemaker.amazonaws.com`]].{Arn:Arn,RoleName:RoleName}' \
  --output table \
  --region $REGION

echo ""
echo "⚠️  Please set EXECUTION_ROLE_ARN to one of the above ARNs or create a new one"
echo "   Example: export EXECUTION_ROLE_ARN=\"arn:aws:iam::788125169579:role/service-role/AmazonSageMaker-ExecutionRole-20250101T000000\""
echo ""
echo "💡 If no roles exist, you can create one with:"
echo "   aws iam create-role --role-name SageMakerExecutionRole --assume-role-policy-document '{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"sagemaker.amazonaws.com\"},\"Action\":\"sts:AssumeRole\"}]}'"
echo "   aws iam attach-role-policy --role-name SageMakerExecutionRole --policy-arn arn:aws:iam::aws:policy/AmazonSageMakerFullAccess"
