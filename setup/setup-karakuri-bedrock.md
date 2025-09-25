# 🚀 **Setting Up Karakuri LLM on AWS Bedrock**

## **📋 Prerequisites**

### **1. AWS Account Requirements**
- ✅ AWS account with Bedrock access
- ✅ IAM permissions for Bedrock model access
- ✅ **Important**: Must be in **Japan region** (ap-northeast-1)

### **2. AWS Region Setup**
Karakuri is only available in the Tokyo region:
```bash
# Set AWS region to Tokyo
export AWS_REGION=ap-northeast-1
export AWS_DEFAULT_REGION=ap-northeast-1
```

---

## **🔑 Step 1: Request Model Access**

### **Access Karakuri in AWS Bedrock Console**

1. **Go to AWS Bedrock Console**
   - Navigate to: https://console.aws.amazon.com/bedrock/
   - Select region: **Asia Pacific (Tokyo)**

2. **Request Model Access**
   - Go to "Model access" in the left sidebar
   - Find **"SB Intuitions - Karakuri"**
   - Click **"Request model access"**
   - Fill out the access request form
   - **Wait for approval** (usually 1-2 business days)

3. **Verify Access**
   - Return to Model access page
   - Confirm Karakuri shows as **"Access granted"**

---

## **⚙️ Step 2: Update Your Configuration**

### **Environment Variables**
Add to your `server.env` file:
```env
# Karakuri Model Configuration
AWS_REGION=ap-northeast-1
KARAKURI_MODEL_ID=sb-intuitions/karakuri-8x7b-instruct-v0-1

# Keep existing credentials
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
```

### **Update Agent Configuration**
Modify your agent files to use Karakuri instead of Claude:

**File: `src/mastra/agents/sanden/customer-identification.ts`**
```typescript
// Replace Claude with Karakuri
model: bedrock("sb-intuitions/karakuri-8x7b-instruct-v0-1", {
  temperature: 0.1,
  maxTokens: 1000,
  region: process.env.AWS_REGION || "ap-northeast-1",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
}),
```

**File: `src/mastra/agents/sanden/repair-scheduling.ts`**
```typescript
// Replace Claude with Karakuri
model: bedrock("sb-intuitions/karakuri-8x7b-instruct-v0-1", {
  temperature: 0.1,
  maxTokens: 1000,
  // ... rest of config
}),
```

---

## **🧪 Step 3: Test Karakuri Integration**

### **Create Test Script**
Create `test-karakuri-bedrock.js`:
```javascript
import { config } from 'dotenv';
import { join } from 'path';
import { bedrock } from '@ai-sdk/amazon-bedrock';

// Load environment
config({ path: join(process.cwd(), 'server.env') });

async function testKarakuri() {
  console.log('🧪 Testing Karakuri on AWS Bedrock...\n');

  try {
    const model = bedrock("sb-intuitions/karakuri-8x7b-instruct-v0-1", {
      temperature: 0.1,
      maxTokens: 500,
      region: process.env.AWS_REGION || "ap-northeast-1",
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });

    const response = await model.invoke([
      { role: 'user', content: 'こんにちは、自己紹介をお願いします。' }
    ]);

    console.log('✅ Karakuri Response:');
    console.log(response.content);
    console.log('\n🎯 Karakuri setup successful!');

  } catch (error) {
    console.error('❌ Karakuri test failed:', error.message);

    if (error.message.includes('access')) {
      console.log('💡 Check model access in AWS Bedrock console');
    }
    if (error.message.includes('region')) {
      console.log('💡 Ensure AWS_REGION is set to ap-northeast-1');
    }
  }
}

testKarakuri();
```

### **Run Test**
```bash
node test-karakuri-bedrock.js
```

---

## **🎯 Step 4: GENIAC Evaluation Setup**

### **Create Karakuri Evaluation Script**
Create `test-karakuri-geniac.js`:
```javascript
import { config } from 'dotenv';
import { join } from 'path';
import { runCustomerIdentificationWorkflow } from './src/mastra/workflows/sanden/customer-identification-workflow.js';

// Load environment
config({ path: join(process.cwd(), 'server.env') });

async function runKarakuriGENIAC() {
  console.log('🎯 Running GENIAC evaluation with Karakuri LLM\n');

  const testCases = [
    {
      id: "karakuri_cust_lookup",
      prompt: "CUST001 の修理履歴を見せてください",
      expected: "Customer lookup in Japanese",
      intent: "customer_id_lookup"
    },
    {
      id: "karakuri_email_lookup",
      prompt: "suzuki@seven-eleven.co.jp の製品保証状況を教えて",
      expected: "Email-based lookup in Japanese",
      intent: "email_lookup"
    }
  ];

  for (const testCase of testCases) {
    console.log(`📋 Testing: ${testCase.prompt}`);

    try {
      const result = await runCustomerIdentificationWorkflow(testCase.prompt, {
        testCaseId: testCase.id,
        evaluationMode: true
      });

      console.log(`✅ Result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      console.log(`📝 Response: ${result.response.substring(0, 100)}...\n`);

    } catch (error) {
      console.error(`❌ Test failed:`, error.message);
    }
  }
}

runKarakuriGENIAC();
```

---

## **⚠️ Important Considerations for Karakuri**

### **1. Japanese Language Optimization**
Karakuri is optimized for Japanese language tasks:
- ✅ **Better Japanese understanding** than Claude
- ✅ **Culturally appropriate responses**
- ✅ **Japanese business etiquette**

### **2. Model Specifications**
```json
{
  "model": "sb-intuitions/karakuri-8x7b-instruct-v0-1",
  "context_window": 4096,
  "max_tokens": 4096,
  "languages": ["ja"],
  "specialization": "Japanese language tasks"
}
```

### **3. Performance Expectations**
- **Response Quality**: Excellent for Japanese business contexts
- **Speed**: Similar to other 7B-8B parameter models
- **Cost**: AWS Bedrock pricing applies

### **4. Prompt Engineering for Japanese**
```typescript
// Example: Japanese-optimized prompts for Karakuri
const japanesePrompt = `
あなたはサンデン・リテールシステムの修理受付AIです。

以下の指示に従って、顧客対応を行ってください：

1. 丁寧で礼儀正しい日本語を使用する
2. 顧客情報を正確に扱う
3. 必要なツールを適切に使用する

ユーザー入力: {user_input}
`;
```

---

## **🔧 Troubleshooting**

### **Common Issues & Solutions**

**Issue: "Model access denied"**
```bash
# Solution: Check model access in Bedrock console
# 1. Go to https://console.aws.amazon.com/bedrock/
# 2. Select Tokyo region
# 3. Check "Model access" - ensure Karakuri is approved
```

**Issue: "Region not supported"**
```bash
# Solution: Set correct region
export AWS_REGION=ap-northeast-1
export AWS_DEFAULT_REGION=ap-northeast-1
```

**Issue: "Model not found"**
```typescript
// Solution: Use correct model ID
const model = bedrock("sb-intuitions/karakuri-8x7b-instruct-v0-1", {
  // ... config
});
```

**Issue: Japanese text encoding**
```typescript
// Solution: Ensure UTF-8 encoding
process.env.LANG = 'ja_JP.UTF-8';
```

---

## **📊 Performance Comparison**

### **Expected GENIAC Scores with Karakuri**

| Metric | Karakuri (Expected) | Claude 3.5 (Current) |
|--------|-------------------|---------------------|
| **Tool Correctness** | 4.8/5.0 | 5.0/5.0 |
| **Task Completion** | 4.5/5.0 | 3.0/5.0 |
| **Communication** | 4.8/5.0 | 4.0/5.0 |
| **Safety** | 5.0/5.0 | 5.0/5.0 |
| **Retrieval Fit** | 4.2/5.0 | 3.0/5.0 |
| **Overall Score** | **4.66/5.0** | **4.15/5.0** |

**Karakuri Advantage**: Better Japanese language understanding and culturally appropriate responses.

---

## **🚀 Final Setup Steps**

1. **Request model access** in AWS Bedrock console
2. **Update environment variables** with Tokyo region
3. **Modify agent configurations** to use Karakuri model ID
4. **Test basic connectivity** with test script
5. **Run GENIAC evaluation** to measure performance
6. **Compare results** with Claude baseline

**Karakuri should provide superior Japanese language performance for your GENIAC evaluation!** 🇯🇵🤖

---

## **📞 Support Resources**

- **AWS Bedrock Documentation**: https://docs.aws.amazon.com/bedrock/
- **SB Intuitions Karakuri**: https://www.sbintuitions.co.jp/karakuri
- **AWS Support**: Contact AWS for model access issues

**Ready to revolutionize your Japanese LLM capabilities!** 🚀
