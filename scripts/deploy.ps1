# ============================================================
# 🚀 Deploy Script
# ============================================================
# بيرفع Firebase Key لـ SSM ثم يعمل build و deploy
#
# الاستخدام:
#   .\scripts\deploy.ps1
# ============================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Khatma Backend - Deploy Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: رفع Firebase Service Account لـ SSM Parameter Store
Write-Host "[1/3] Uploading Firebase Key to SSM..." -ForegroundColor Yellow
$firebaseJson = node scripts/get-firebase-param.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to read Firebase Service Account!" -ForegroundColor Red
    exit 1
}

aws ssm put-parameter --name "/khatma/firebase-service-account" --type "SecureString" --value $firebaseJson --overwrite | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to upload to SSM!" -ForegroundColor Red
    exit 1
}
Write-Host "  Firebase Key uploaded to SSM securely" -ForegroundColor Green

# Step 2: Build
Write-Host "[2/3] Building..." -ForegroundColor Yellow
sam build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  Build succeeded!" -ForegroundColor Green

# Step 3: Deploy
Write-Host "[3/3] Deploying to AWS..." -ForegroundColor Yellow
sam deploy --config-env dev

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Deploy failed!" -ForegroundColor Red
    exit 1
}

# Step 4: Upload Admin Dashboard to S3
Write-Host "[4/4] Uploading Admin Dashboard to S3..." -ForegroundColor Yellow

$stackOutputs = aws cloudformation describe-stacks --stack-name khatma-backend-dev --query "Stacks[0].Outputs" --output json | ConvertFrom-Json
$dashboardBucket = ($stackOutputs | Where-Object { $_.OutputKey -eq "AdminDashboardUrl" })
$apiUrl = ($stackOutputs | Where-Object { $_.OutputKey -eq "ApiUrl" })

$accountId = (aws sts get-caller-identity --query Account --output text)
$bucketName = "khatma-admin-app-dev-$accountId"

aws s3 sync admin-dashboard/ "s3://$bucketName" --delete
if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: Admin Dashboard upload failed (bucket may not exist yet)" -ForegroundColor Yellow
} else {
    Write-Host "  Admin Dashboard uploaded!" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Deploy Successful!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

if ($apiUrl) {
    Write-Host "  API URL: $($apiUrl.OutputValue)" -ForegroundColor Cyan
}
if ($dashboardBucket) {
    Write-Host "  Admin Dashboard: $($dashboardBucket.OutputValue)" -ForegroundColor Cyan
}
