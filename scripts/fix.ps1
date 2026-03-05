# ============================================================
# fix.ps1 - Fix CORS redeployment + Set Admin Role
# Run from your project root:  .\scripts\fix.ps1
# ============================================================

param(
  [string]$AdminEmail = "",
  [string]$StackName  = "khatma-backend-dev",
  [string]$Region     = "us-east-1"
)

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Khatma - CORS Fix + Admin Role Setup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# ──────────────────────────────────────────────
# 1. Get stack outputs
# ──────────────────────────────────────────────
Write-Host "[1/3] Reading stack outputs..." -ForegroundColor Yellow

$outputs = aws cloudformation describe-stacks `
  --stack-name $StackName `
  --region $Region `
  --query "Stacks[0].Outputs" `
  --output json | ConvertFrom-Json

$apiUrl = ($outputs | Where-Object { $_.OutputKey -eq "ApiUrl" }).OutputValue
if (-not $apiUrl) {
  Write-Host "ERROR: Could not find ApiUrl in stack outputs." -ForegroundColor Red
  Write-Host "Make sure the stack '$StackName' is deployed." -ForegroundColor Red
  exit 1
}

# Extract REST API ID from the URL
# URL format: https://{restApiId}.execute-api.{region}.amazonaws.com/Prod/
$restApiId = ($apiUrl -split '\.')[0] -replace 'https://', ''
Write-Host "  REST API ID : $restApiId" -ForegroundColor Green
Write-Host "  API URL     : $apiUrl" -ForegroundColor Green

# Get UsersTable name from stack
$usersTable = ($outputs | Where-Object { $_.OutputKey -eq "UsersTable" }).OutputValue
# Fallback: construct from convention
if (-not $usersTable) {
  $accountId = (aws sts get-caller-identity --query Account --output text)
  $usersTable = "khatma-users-dev"
}
Write-Host "  Users Table : $usersTable" -ForegroundColor Green

# ──────────────────────────────────────────────
# 2. Force redeploy the API Gateway Prod stage
#    This picks up the GatewayResponse CORS fixes
# ──────────────────────────────────────────────
Write-Host ""
Write-Host "[2/3] Redeploying API Gateway stage to apply CORS headers..." -ForegroundColor Yellow

$deployResult = aws apigateway create-deployment `
  --rest-api-id $restApiId `
  --stage-name Prod `
  --description "Force redeploy: apply CORS GatewayResponse headers" `
  --region $Region `
  --output json | ConvertFrom-Json

if ($LASTEXITCODE -ne 0) {
  Write-Host "ERROR: Failed to redeploy API Gateway." -ForegroundColor Red
  exit 1
}

Write-Host "  API Gateway redeployed! (deployment id: $($deployResult.id))" -ForegroundColor Green

# ──────────────────────────────────────────────
# 3. Set admin role in DynamoDB
# ──────────────────────────────────────────────
Write-Host ""
Write-Host "[3/3] Setting admin role in DynamoDB..." -ForegroundColor Yellow

# Prompt for email if not provided
if (-not $AdminEmail) {
  $AdminEmail = Read-Host "  Enter the admin user's Firebase email (e.g. admin@yourapp.com)"
}
$AdminEmail = $AdminEmail.Trim().ToLower()

if (-not $AdminEmail) {
  Write-Host "  SKIP: No email provided. You can run this script again with -AdminEmail parameter." -ForegroundColor Yellow
} else {
  # First find the userId by scanning for the email
  # (UsersTable primary key is userId, not email)
  Write-Host "  Looking up userId for '$AdminEmail'..." -ForegroundColor Gray

  $scanResult = aws dynamodb scan `
    --table-name $usersTable `
    --filter-expression "email = :email" `
    --expression-attribute-values "{`":email`":{`"S`":`"$AdminEmail`"}}" `
    --region $Region `
    --output json | ConvertFrom-Json

  if ($scanResult.Count -eq 0) {
    Write-Host ""
    Write-Host "  WARNING: No user found with email '$AdminEmail'." -ForegroundColor Yellow
    Write-Host "  The user must log into the admin dashboard at least once before you can set their role." -ForegroundColor Yellow
    Write-Host "  Steps:" -ForegroundColor Yellow
    Write-Host "    1. Open https://d1gvd6wyne19ak.cloudfront.net" -ForegroundColor White
    Write-Host "    2. Log in with '$AdminEmail'" -ForegroundColor White
    Write-Host "    3. Re-run this script: .\scripts\fix.ps1 -AdminEmail '$AdminEmail'" -ForegroundColor White
  } else {
    $userId = $scanResult.Items[0].userId.S
    Write-Host "  Found userId: $userId" -ForegroundColor Gray

    aws dynamodb update-item `
      --table-name $usersTable `
      --key "{`"userId`":{`"S`":`"$userId`"}}" `
      --update-expression "SET #role = :admin" `
      --expression-attribute-names "{`"#role`":`"role`"}" `
      --expression-attribute-values "{`":admin`":{`"S`":`"admin`"}}" `
      --region $Region | Out-Null

    if ($LASTEXITCODE -ne 0) {
      Write-Host "  ERROR: Failed to update role in DynamoDB." -ForegroundColor Red
      exit 1
    }

    Write-Host "  SUCCESS: '$AdminEmail' is now an admin!" -ForegroundColor Green
  }
}

# ──────────────────────────────────────────────
# Done
# ──────────────────────────────────────────────
Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Done!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Wait ~30 seconds for API Gateway changes to propagate" -ForegroundColor White
Write-Host "  2. Open https://d1gvd6wyne19ak.cloudfront.net" -ForegroundColor White
Write-Host "  3. Log in - CORS errors should be gone and admin panel should load" -ForegroundColor White
Write-Host ""