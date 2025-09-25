# 🚀 **Setting Up Karakuri LM 8x7B Instruct on AWS SageMaker**

## **📋 Overview**
Karakuri LM is deployed through **AWS SageMaker** (not Bedrock). This guide follows the official AWS Marketplace instructions for the `KARAKURI LM 8x7b instruct v0.1.1` model.

---

## **🔑 Step 1: Prerequisites**

### **1. AWS CLI Setup**
```bash
# Install AWS CLI v2 (if not already installed)
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure AWS CLI
aws configure
```

### **2. Region Setup**
```bash
# Set region to Tokyo (required for Karakuri)
export AWS_REGION=ap-northeast-1
export AWS_DEFAULT_REGION=ap-northeast-1
```

### **3. Create IAM Role (if needed)**
```bash
# List existing SageMaker roles
aws iam list-roles \
 --query 'Roles[?AssumeRolePolicyDocument.Statement[?Principal.Service==`sagemaker.amazonaws.com`]].{Arn:Arn,RoleName:RoleName}'

# Create new role if none exists
aws iam create-role \
 --role-name SageMaker-Karakuri-Role \
 --assume-role-policy-document '{
   "Version": "2012-10-17",
   "Statement": [
     {
       "Effect": "Allow",
       "Principal": {
         "Service": "sagemaker.amazonaws.com"
       },
       "Action": "sts:AssumeRole"
     }
   ]
 }'

# Attach required policy
aws iam attach-role-policy \
 --role-name SageMaker-Karakuri-Role \
 --policy-arn arn:aws:iam::aws:policy/AmazonSageMakerFullAccess

# Get role ARN
aws iam get-role --role-name SageMaker-Karakuri-Role --query 'Role.Arn'
```

---

## **⚙️ Step 2: Deploy Karakuri Model**

### **1. Set Variables**
```bash
# Model package ARN (from AWS Marketplace)
model_package=arn:aws:sagemaker:ap-northeast-1:977537786026:model-package/karakuri-lm-8x7b-instruct-v01--6fc27dec3a3b3096a4b04681dfd1daac

# Your SageMaker execution role ARN (replace with actual ARN)
execution_role_arn=arn:aws:iam::YOUR_ACCOUNT_ID:role/SageMaker-Karakuri-Role

# Instance type (choose based on your needs)
instance_type=ml.g6.48xlarge

# Custom names (optional - change if needed)
model_name=Karakuri-LM-8x7b-Instruct-1
endpoint_config_name=Karakuri-EndpointConfig-1
endpoint_name=Karakuri-Endpoint-1
```

### **2. Create SageMaker Model**
```bash
aws sagemaker create-model \
 --model-name ${model_name} \
 --execution-role-arn ${execution_role_arn} \
 --primary-container ModelPackageName=${model_package} \
 --enable-network-isolation \
 --region ap-northeast-1
```

### **3. Create Endpoint Configuration**
```bash
aws sagemaker create-endpoint-config \
 --endpoint-config-name ${endpoint_config_name} \
 --production-variants VariantName=variant-1,ModelName=${model_name},InstanceType=${instance_type},InitialInstanceCount=1,ModelDataDownloadTimeoutInSeconds=3600 \
 --region ap-northeast-1
```

### **4. Create Endpoint**
```bash
aws sagemaker create-endpoint \
 --endpoint-name ${endpoint_name} \
 --endpoint-config-name ${endpoint_config_name} \
 --region ap-northeast-1
```

### **5. Check Endpoint Status**
```bash
# Wait 3-5 minutes, then check status
aws sagemaker describe-endpoint \
 --endpoint-name ${endpoint_name} \
 --region ap-northeast-1 \
 --query 'EndpointStatus'
```

**Wait until status shows "InService"**

---

## **🧪 Step 3: Test Karakuri Endpoint**

### **1. Download Sample Input**
```bash
# Download sample input file
curl -o sample-input.json "https://awsmp-logos.s3.amazonaws.com/realTime+Sample+input+Data+Link"
```

### **2. Create Test Input**
If the sample download doesn't work, create your own test input:
```json
{
  "inputs": "こんにちは、自己紹介をお願いします。",
  "parameters": {
    "max_new_tokens": 100,
    "temperature": 0.7,
    "do_sample": true
  }
}
```

### **3. Test Inference**
```bash
# Set content type and input file
content_type=application/json
input_data=fileb://sample-input.json

# Run inference
aws sagemaker-runtime invoke-endpoint \
 --endpoint-name ${endpoint_name} \
 --cli-binary-format raw-in-base64-out \
 --body "${input_data}" \
 --content-type ${content_type} \
 --region ap-northeast-1 \
 result.out

# View results
cat result.out
```

---

## **🔧 Step 4: Integrate with Your Mastra System**

### **1. Update Environment Variables**
Add to your `server.env`:
```env
# Karakuri SageMaker Configuration
KARAKURI_ENDPOINT_NAME=Karakuri-Endpoint-1
KARAKURI_REGION=ap-northeast-1
KARAKURI_MODEL_TYPE=sagemaker
KARAKURI_CONTENT_TYPE=application/json
```

### **2. Create SageMaker Integration**
Create `src/integrations/karakuri-sagemaker.ts`:
```typescript
import { SageMakerRuntimeClient, InvokeEndpointCommand } from "@aws-sdk/client-sagemaker-runtime";

export class KarakuriSageMakerIntegration {
  private client: SageMakerRuntimeClient;
  private endpointName: string;
  private region: string;

  constructor() {
    this.region = process.env.KARAKURI_REGION || "ap-northeast-1";
    this.endpointName = process.env.KARAKURI_ENDPOINT_NAME || "Karakuri-Endpoint-1";

    this.client = new SageMakerRuntimeClient({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      }
    });
  }

  async invoke(prompt: string, options: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
  } = {}) {
    const payload = {
      inputs: prompt,
      parameters: {
        max_new_tokens: options.maxTokens || 100,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 0.9,
        do_sample: true,
      }
    };

    const command = new InvokeEndpointCommand({
      EndpointName: this.endpointName,
      ContentType: "application/json",
      Body: JSON.stringify(payload),
    });

    try {
      const response = await this.client.send(command);
      const result = JSON.parse(new TextDecoder().decode(response.Body));
      return result.generated_text || result.outputs || result;
    } catch (error) {
      console.error("Karakuri SageMaker error:", error);
      throw error;
    }
  }

  async testConnection() {
    try {
      const response = await this.invoke("こんにちは、テストです。");
      console.log("✅ Karakuri SageMaker connection successful");
      console.log("Response:", response);
      return true;
    } catch (error) {
      console.error("❌ Karakuri SageMaker connection failed:", error);
      return false;
    }
  }
}

export const karakuriSageMaker = new KarakuriSageMakerIntegration();
```

### **3. Update Agent Configuration**
Modify `src/mastra/agents/sanden/customer-identification.ts`:
```typescript
import { karakuriSageMaker } from "../../../integrations/karakuri-sagemaker.js";

// Replace bedrock import and model
// Remove: import { bedrock } from "@ai-sdk/amazon-bedrock";

// Create custom Karakuri model wrapper
const karakuriModel = {
  invoke: async (messages: any[]) => {
    const prompt = messages.map(m => m.content).join("\n");
    const response = await karakuriSageMaker.invoke(prompt, {
      maxTokens: 1000,
      temperature: 0.1,
    });
    return { content: response };
  }
};

// Update model configuration
model: karakuriModel,
```

---

## **🧪 Step 5: Test Integration**

### **1. Create Test Script**
Create `test-karakuri-sagemaker.js`:
```javascript
import { config } from 'dotenv';
import { join } from 'path';
import { karakuriSageMaker } from './src/integrations/karakuri-sagemaker.js';

// Load environment
config({ path: join(process.cwd(), 'server.env') });

async function testKarakuriSageMaker() {
  console.log('🧪 Testing Karakuri on AWS SageMaker...\n');

  try {
    console.log('🔄 Testing connection...');
    const connected = await karakuriSageMaker.testConnection();

    if (!connected) {
      console.log('❌ Connection test failed');
      return;
    }

    console.log('\n🔄 Testing Japanese business context...');
    const businessResponse = await karakuriSageMaker.invoke(
      "あなたはサンデン・リテールシステムの修理受付AIです。CUST001の顧客情報を確認してください。",
      { maxTokens: 200, temperature: 0.1 }
    );

    console.log('✅ Business Context Response:');
    console.log('─'.repeat(50));
    console.log(businessResponse);
    console.log('─'.repeat(50));

    console.log('\n🎯 Karakuri SageMaker integration successful!');

  } catch (error) {
    console.error('❌ Karakuri test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check endpoint status: aws sagemaker describe-endpoint --endpoint-name YOUR_ENDPOINT');
    console.log('2. Verify region: ap-northeast-1');
    console.log('3. Check IAM permissions');
    console.log('4. Ensure endpoint is InService status');
  }
}

testKarakuriSageMaker();
```

### **2. Run Test**
```bash
node test-karakuri-sagemaker.js
```

---

## **💰 Cost Management**

### **Pricing Information**
- **Software Cost**: Based on hourly usage while endpoint is running
- **Infrastructure Cost**: Additional EC2 instance costs
- **Supported Instance Types**:
  - `ml.g5.48xlarge` - Lower cost option
  - `ml.g6.48xlarge` - Recommended (GPU optimized)
  - `ml.p4d.24xlarge` - High performance
  - `ml.p4de.24xlarge` - Highest performance
  - `ml.p5.48xlarge` - Latest generation

### **Cost Optimization**
```bash
# Stop endpoint when not in use
aws sagemaker update-endpoint \
 --endpoint-name ${endpoint_name} \
 --endpoint-config-name ${endpoint_config_name} \
 --desired-instance-count 0

# Delete endpoint completely
aws sagemaker delete-endpoint --endpoint-name ${endpoint_name}
```

---

## **🧹 Step 6: Cleanup (When Done)**

### **Delete Resources**
```bash
# Delete endpoint
aws sagemaker delete-endpoint --endpoint-name ${endpoint_name}

# Delete endpoint config
aws sagemaker delete-endpoint-config --endpoint-config-name ${endpoint_config_name}

# Delete model
aws sagemaker delete-model --model-name ${model_name}
```

---

## **📊 Model Specifications**

| **Specification** | **Details** |
|-------------------|-------------|
| **Model** | KARAKURI LM 8x7b instruct v0.1.1 |
| **Provider** | SB Intuitions |
| **Region** | Asia Pacific (Tokyo) |
| **Architecture** | 8x7B parameter model |
| **Context Window** | ~4096 tokens |
| **Languages** | Japanese (primary), English |
| **Use Case** | Instruction following, Japanese business applications |
| **Deployment** | SageMaker Real-time Endpoint |

---

## **🚀 Quick Setup Script**

### **Create Automated Setup**
Create `setup-karakuri-sagemaker.sh`:
```bash
#!/bin/bash

# Karakuri SageMaker Setup Script
# Usage: ./setup-karakuri-sagemaker.sh <execution-role-arn> [instance-type]

set -e

EXECUTION_ROLE_ARN=$1
INSTANCE_TYPE=${2:-ml.g6.48xlarge}
REGION=ap-northeast-1

MODEL_PACKAGE=arn:aws:sagemaker:ap-northeast-1:977537786026:model-package/karakuri-lm-8x7b-instruct-v01--6fc27dec3a3b3096a4b04681dfd1daac
MODEL_NAME=Karakuri-LM-8x7b-Instruct-$(date +%s)
ENDPOINT_CONFIG_NAME=Karakuri-EndpointConfig-$(date +%s)
ENDPOINT_NAME=Karakuri-Endpoint-$(date +%s)

echo "🚀 Setting up Karakuri LM 8x7B Instruct on SageMaker"
echo "Region: $REGION"
echo "Instance Type: $INSTANCE_TYPE"
echo "Execution Role: $EXECUTION_ROLE_ARN"
echo ""

echo "1️⃣ Creating model..."
aws sagemaker create-model \
 --model-name ${MODEL_NAME} \
 --execution-role-arn ${EXECUTION_ROLE_ARN} \
 --primary-container ModelPackageName=${MODEL_PACKAGE} \
 --enable-network-isolation \
 --region ${REGION}

echo "2️⃣ Creating endpoint configuration..."
aws sagemaker create-endpoint-config \
 --endpoint-config-name ${ENDPOINT_CONFIG_NAME} \
 --production-variants VariantName=variant-1,ModelName=${MODEL_NAME},InstanceType=${INSTANCE_TYPE},InitialInstanceCount=1,ModelDataDownloadTimeoutInSeconds=3600 \
 --region ${REGION}

echo "3️⃣ Creating endpoint..."
aws sagemaker create-endpoint \
 --endpoint-name ${ENDPOINT_NAME} \
 --endpoint-config-name ${ENDPOINT_CONFIG_NAME} \
 --region ${REGION}

echo "⏳ Waiting for endpoint to be ready (this may take 5-10 minutes)..."

# Wait for endpoint to be ready
while true; do
  STATUS=$(aws sagemaker describe-endpoint --endpoint-name ${ENDPOINT_NAME} --region ${REGION} --query 'EndpointStatus' --output text)
  echo "Endpoint status: $STATUS"

  if [ "$STATUS" = "InService" ]; then
    break
  elif [ "$STATUS" = "Failed" ] || [ "$STATUS" = "RollingBack" ]; then
    echo "❌ Endpoint creation failed with status: $STATUS"
    exit 1
  fi

  sleep 30
done

echo "✅ Karakuri endpoint ready!"
echo ""
echo "📋 Configuration Details:"
echo "Model Name: ${MODEL_NAME}"
echo "Endpoint Config: ${ENDPOINT_CONFIG_NAME}"
echo "Endpoint Name: ${ENDPOINT_NAME}"
echo ""
echo "💰 Don't forget to delete resources when done to avoid charges!"
```

### **Make Executable and Run**
```bash
chmod +x setup-karakuri-sagemaker.sh
./setup-karakuri-sagemaker.sh arn:aws:iam::YOUR_ACCOUNT_ID:role/SageMaker-Karakuri-Role
```

---

## **🎯 Next Steps**

1. **Deploy endpoint** using the automated script
2. **Test connection** with the test script
3. **Update your agents** to use Karakuri SageMaker
4. **Run GENIAC evaluation** to measure performance
5. **Monitor costs** and optimize instance usage

**Karakuri is now ready for your Japanese business applications!** 🇯🇵🤖

---

## **📞 Support Resources**

- **AWS SageMaker Documentation**: https://docs.aws.amazon.com/sagemaker/
- **SB Intuitions Karakuri**: https://www.sbintuitions.co.jp/karakuri
- **AWS Marketplace Support**: Contact AWS for deployment issues

**Ready to deploy Karakuri on SageMaker!** 🚀
