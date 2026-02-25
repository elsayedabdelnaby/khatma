# 🔧 Step 0: Install Required Tools

> Before starting anything, you need to install the required tools on your machine

---

## ✅ Checklist

- [ ] Node.js v18+
- [ ] AWS CLI
- [ ] AWS SAM CLI
- [ ] Git
- [ ] VS Code Extensions

---

## 1. Install Node.js (v18 or later)

### What is Node.js?
> Node.js is a JavaScript runtime environment outside the browser.
> All Lambda Functions will be written in JavaScript/Node.js

### Installation Steps:
1. Go to: https://nodejs.org
2. Download the **LTS Version** (stable version)
3. Install it (Next → Next → Finish)

### Verify Installation:
```powershell
node --version
# Expected output: v18.x.x or higher

npm --version
# Expected output: 9.x.x or higher
```

---

## 2. Install AWS CLI

### What is AWS CLI?
> A command-line tool for interacting with AWS from your machine

### Installation Steps:
1. Go to: https://aws.amazon.com/cli/
2. Download "AWS CLI MSI installer for Windows (64-bit)"
3. Install it (Next → Next → Finish)

### Verify Installation:
```powershell
aws --version
# Expected output: aws-cli/2.x.x
```

---

## 3. Install AWS SAM CLI

### What is SAM CLI?
> A tool for easily building and deploying Lambda Functions

### Installation Steps:
1. Go to: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html
2. Download "AWS SAM CLI 64-bit" for Windows
3. Install it (Next → Next → Finish)

### Verify Installation:
```powershell
sam --version
# Expected output: SAM CLI, version 1.x.x
```

---

## 4. Install Git

### What is Git?
> A version control system — it tracks the history of every change

### Installation Steps:
1. Go to: https://git-scm.com/download/win
2. Download and install (use default settings)

### Verify Installation:
```powershell
git --version
# Expected output: git version 2.x.x
```

---

## 5. VS Code Extensions

### Required Extensions:
1. **AWS Toolkit** - For interacting with AWS from VS Code
2. **Markdown Preview Mermaid Support** - For rendering diagrams (already installed ✅)

---

## ✅ I'm Ready!

Once you finish installing everything, run this command to verify:

```powershell
echo "=== Checking Tools ===" ; node --version ; npm --version ; aws --version ; sam --version ; git --version ; echo "=== All Done! ==="
```

You should see versions for each tool without any errors.

---

## ➡️ Next Step: Step 1 - Create AWS & Firebase Accounts
