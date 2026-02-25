# 🚀 Step 2: First Deploy - First Deployment to AWS

> Here we'll build the project and deploy it to AWS for the first time

---

## ⚠️ Before You Start - Make sure:
- [ ] Node.js is installed (`node --version`)
- [ ] AWS CLI is installed and configured (`aws sts get-caller-identity`)
- [ ] SAM CLI is installed (`sam --version`)

---

## Step 1: Install Dependencies

```powershell
# Navigate to the project directory
cd C:\laragon\www\karamany\khatma

# Install the packages
npm install
```

### 📋 What happened?
- npm read the `package.json` file
- Downloaded all required packages into the `node_modules/` directory
- These packages include:
  - `firebase-admin`: To communicate with Firebase (Auth + FCM)
  - `uuid`: To generate unique IDs for each khatma/banner/etc.
  - `@aws-sdk/client-dynamodb`: AWS adds this automatically in Lambda

---

## Step 2: Build the Project

```powershell
sam build
```

### 📋 What happened?
- SAM read the `template.yaml` file
- Bundled the code + dependencies
- Placed them in the `.aws-sam/build/` directory
- Prepared everything for deployment

Expected output:
```
Build Succeeded
```

---

## Step 3: First Deploy 🚀

```powershell
sam deploy --guided
```

### 📋 What is `--guided`?
- Used only for the first time — it asks you questions to determine your settings
- Afterwards, it saves the settings in `samconfig.toml`

### Questions it will ask and the answers:

```
Setting default arguments for 'sam deploy'
=========================================

Stack Name [sam-app]: khatma-backend-dev
AWS Region [us-east-1]: us-east-1
Parameter Environment [dev]: dev

Confirm changes before deploy [y/N]: y
Allow SAM CLI IAM role creation [Y/n]: Y
Disable rollback [y/N]: N

HealthCheckFunction has no authentication. Is this okay? [y/N]: y
UserFunction has no authentication. Is this okay? [y/N]: y

Save arguments to configuration file [Y/n]: Y
SAM configuration file [samconfig.toml]: samconfig.toml
SAM configuration environment [default]: dev
```

### 📋 What happens during deployment?
1. SAM converts the template to a CloudFormation template
2. Uploads the code to S3
3. Creates all resources:
   - API Gateway
   - 2 Lambda Functions (Health + User)
   - 9 DynamoDB Tables
   - 4 SQS Queues
4. Provides you with the URLs

### Expected Output:
```
CloudFormation outputs from deployed stack
-------------------------------------------------
Key                 HealthCheckUrl
Description         Health check URL
Value               https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/Prod/health

Key                 ApiUrl
Description         API Gateway endpoint URL
Value               https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/Prod/
```

---

## Step 4: Testing 🎉

### Test the Health Check:
Open the URL in your browser:
```
https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/Prod/health
```

Expected output:
```json
{
  "success": true,
  "data": {
    "status": "OK",
    "timestamp": "2026-02-18T10:00:00.000Z",
    "environment": "dev",
    "version": "1.0.0",
    "service": "khatma-backend"
  }
}
```

### Test User Sync (from PowerShell):
```powershell
# Replace the URL with your actual URL
$API_URL = "https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/Prod"

# Test sync user
Invoke-RestMethod -Uri "$API_URL/auth/sync" -Method POST -ContentType "application/json" -Body '{"userId": "test_user_1", "email": "test@email.com", "displayName": "Test User", "language": "ar"}'
```

You should get back the user data 🎉

---

## Step 5: View Resources on AWS Console

### View Lambda Functions:
1. Go to: https://console.aws.amazon.com/lambda
2. You'll find the Functions that were created

### View DynamoDB Tables:
1. Go to: https://console.aws.amazon.com/dynamodb
2. Click "Tables"
3. You'll find 9 tables (all starting with khatma-)

### View API Gateway:
1. Go to: https://console.aws.amazon.com/apigateway
2. You'll find your API

---

## ⚠️ Common Issues and Solutions:

### Issue: "Unable to upload artifact"
```
Solution: Make sure AWS CLI is properly configured
aws sts get-caller-identity
```

### Issue: "Template format error"
```
Solution: Make sure the template.yaml file has no errors
sam validate
```

### Issue: "Timeout"
```
Solution: Try again — the first time sometimes takes a while
sam deploy --no-confirm-changeset
```

---

## ✅ Congratulations! 🎉

Your first Lambda is running on AWS!

## ➡️ Next Step: Step 3 - Firebase Authorizer (Securing the APIs)
