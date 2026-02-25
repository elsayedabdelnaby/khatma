# 🔐 Step 1: Create AWS & Firebase Accounts

> Create and set up AWS and Firebase accounts

---

## Part A: Create an AWS Account

### 1. Create the Account
1. Go to: https://aws.amazon.com
2. Click "Create an AWS Account"
3. Enter your details (email + password)
4. Enter credit card information (nothing will be charged - Free Tier)
5. Select "Basic Support (Free)"

> ⚠️ AWS Free Tier gives you 12 months free on most services

### 2. Create an IAM User

#### What is an IAM User?
> Instead of using the Root account (main account), you create a sub-account with specific permissions. This is more secure.

#### Steps:
1. Go to AWS Console: https://console.aws.amazon.com
2. Search for "IAM" in the search bar
3. Click "Users" from the left menu
4. Click "Create User"
5. Name: `khatma-developer`
6. Click "Next"
7. Select "Attach policies directly"
8. Search and select:
   - `AdministratorAccess` (temporarily for development - we'll reduce it later)
9. Click "Create User"

### 3. Create Access Keys

1. Click on the User name: `khatma-developer`
2. Click "Security credentials" tab
3. Click "Create access key"
4. Select "Command Line Interface (CLI)"
5. Click "Create access key"
6. **Very important**: Copy the Access Key ID and Secret Access Key
   and save them in a secure location (they won't be shown again!)

### 4. Configure AWS CLI on Your Machine

Open PowerShell and run:
```powershell
aws configure
```

It will ask you 4 questions:
```
AWS Access Key ID: The Access Key you copied
AWS Secret Access Key: The Secret Key you copied
Default region name: us-east-1
Default output format: json
```

### 5. Test the Connection
```powershell
aws sts get-caller-identity
```

Expected output:
```json
{
    "UserId": "AIDAXXXXXXXXXXXXXXXXX",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/khatma-developer"
}
```

✅ Done! AWS is ready!

---

## Part B: Create a Firebase Project

### 1. Create the Project
1. Go to: https://console.firebase.google.com
2. Click "Create a project" (or "Add project")
3. Project name: `khatma-app`
4. Enable Google Analytics: Yes
5. Click "Create project"

### 2. Enable Authentication
1. From the left menu: Click "Authentication"
2. Click "Get started"
3. Click "Sign-in method" tab
4. Enable the following providers:

#### a. Google:
   - Click "Google"
   - Enable ✅
   - Select Support email
   - Save

#### b. Facebook:
   - Click "Facebook"
   - Enable ✅
   - You'll need the App ID and App Secret from Facebook Developers
   - Go to: https://developers.facebook.com
   - Create App → Consumer → App name
   - Settings → Basic → Copy App ID and App Secret
   - Go back to Firebase and paste them
   - Save

#### c. Apple:
   - Click "Apple"
   - Enable ✅
   - You'll need an Apple Developer Account ($99/year)
   - You can postpone this if not ready
   - Save

#### d. Phone:
   - Click "Phone"
   - Enable ✅
   - Save
   - (Firebase will handle OTP automatically)

### 3. Download Service Account Key

#### What is a Service Account Key?
> A JSON file containing secret credentials that allow the Backend (Lambda) to communicate with Firebase
> (to verify tokens + send Notifications)

#### Steps:
1. Click ⚙️ Settings (gear icon) → "Project settings"
2. Click "Service accounts" tab
3. Click "Generate new private key"
4. Click "Generate key"
5. A JSON file will be downloaded — **save it in a secure location!**
6. **⚠️ Important: This file is secret — never put it in Git!**

### 4. Enable Cloud Messaging (FCM)
1. From the left menu: Click "Cloud Messaging"
2. If not enabled → Click "Enable"
3. That's it — the Backend will use the Service Account Key to send Notifications

### 5. Information You'll Need (save these):
```
Firebase Project ID: khatma-app
Firebase Web API Key: (found in Project Settings → General)
Service Account Key File: (the JSON file you downloaded)
```

---

## Part C: Important Things to Send to the Flutter Developer

### The Flutter Developer needs:

1. **Firebase Project** - Add them as a collaborator:
   - Project Settings → Users and permissions → Add member
   - Enter their email and select "Editor"

2. **Firebase Config Files**:
   - Android: `google-services.json`
     (Project Settings → Your apps → Add Android app → Download)
   - iOS: `GoogleService-Info.plist`
     (Project Settings → Your apps → Add iOS app → Download)

3. **Facebook App ID & Secret** (if you created the Facebook app)

4. **The `flutter-developer-guide.md` file** we created in `/docs/`

---

## ✅ Checklist

- [ ] AWS Account created
- [ ] IAM User created with Access Keys
- [ ] AWS CLI configured (`aws configure`)
- [ ] AWS CLI tested (`aws sts get-caller-identity`)
- [ ] Firebase project created
- [ ] Google Auth enabled
- [ ] Facebook Auth enabled (or postponed)
- [ ] Apple Auth enabled (or postponed)
- [ ] Phone Auth enabled
- [ ] Service Account Key downloaded
- [ ] Cloud Messaging enabled
- [ ] Flutter Developer added to Firebase

---

## ➡️ Next Step: Step 2 - Create the Project and First Lambda
