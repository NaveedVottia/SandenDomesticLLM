# 🚀 **Karakuri Setup via AWS Console (Easiest Method)**

Since CLI permissions are limited, use the **AWS Console** to deploy Karakuri:

---

## **🖥️ Step-by-Step Console Deployment**

### **1. Go to AWS Marketplace**
Navigate to: https://console.aws.amazon.com/sagemaker/
- Click on **"Model packages"** in the left sidebar
- Search for **"KARAKURI LM 8x7b instruct"**
- Click on the model

### **2. Launch with CloudFormation**
- On the model page, select **"Configure and launch"**
- Choose **"AWS CloudFormation"** as the launch method
- Select **"Create and use a new service role"** (or use existing if available)
- Click **"Launch CloudFormation Template"**

### **3. Monitor Deployment**
- Go to **CloudFormation** console: https://console.aws.amazon.com/cloudformation/
- Find stack: **Stack-KARAKURI-LM-8x7b-instruct-1**
- Wait for status: **CREATE_COMPLETE** (10-15 minutes)

### **4. Get Endpoint Details**
Once deployed, the endpoint will be:
- **Endpoint Name**: `Endpoint-KARAKURI-LM-8x7b-instruct-1`
- **Region**: `us-east-1` (US East/N. Virginia)

---

## **⚙️ Configuration for Your System**

### **Update Environment Variables**
Add to your `server.env`:
```bash
# Karakuri CloudFormation Configuration
KARAKURI_ENDPOINT_NAME=Endpoint-KARAKURI-LM-8x7b-instruct-1
KARAKURI_REGION=us-east-1
KARAKURI_MODEL_TYPE=sagemaker
KARAKURI_CONTENT_TYPE=application/json
```

### **Test Connection**
```bash
# Download sample input
curl -o sample-input.json "https://awsmp-logos.s3.amazonaws.com/realTime+Sample+input+Data+Link"

# Test endpoint
aws sagemaker-runtime invoke-endpoint \
 --endpoint-name Endpoint-KARAKURI-LM-8x7b-instruct-1 \
 --cli-binary-format raw-in-base64-out \
 --body fileb://sample-input.json \
 --content-type application/json \
 --region us-east-1 \
 result.out

# View result
cat result.out
```

---

## **💰 Cost Optimization**

The CloudFormation template will deploy with the **recommended instance type**. To use the cheapest option:

### **After Deployment, Scale Down**
```bash
# Check current configuration
aws sagemaker describe-endpoint-config --endpoint-config-name EndpointConfig-KARAKURI-LM-8x7b-instruct-1 --region us-east-1

# Update to cheapest instance (ml.g5.48xlarge)
aws sagemaker update-endpoint \
 --endpoint-name Endpoint-KARAKURI-LM-8x7b-instruct-1 \
 --endpoint-config-name EndpointConfig-KARAKURI-LM-8x7b-instruct-1-cheap \
 --region us-east-1
```

---

## **🧪 Integration Testing**

Once deployed, test with your system:

```bash
# Run the integration test
node test-karakuri-sagemaker.js

# Run GENIAC evaluation
node test-karakuri-geniac.js
```

---

## **🧹 Cleanup**

When done testing:
```bash
# Delete the CloudFormation stack
aws cloudformation delete-stack --stack-name Stack-KARAKURI-LM-8x7b-instruct-1 --region us-east-1
```

---

## **📋 Summary**

1. **Use AWS Console** → SageMaker → Model packages
2. **Find Karakuri** → Configure → CloudFormation launch
3. **Wait 10-15 minutes** for deployment
4. **Update `server.env`** with endpoint details
5. **Test integration** with your Mastra system

**This method should work with your current permissions!** 🇯🇵🤖

---

## **🎯 Expected Results**

- **Endpoint**: `Endpoint-KARAKURI-LM-8x7b-instruct-1`
- **Region**: `us-east-1`
- **Cost**: ~$5-7/hour (depending on instance)
- **Japanese Performance**: Excellent for business applications

**Deploy via console, then integrate with your system!** 🚀
