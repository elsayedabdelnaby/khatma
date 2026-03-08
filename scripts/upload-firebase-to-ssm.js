// upload-firebase-to-ssm.js
// Uploads firebase-service-account.json to SSM correctly
// Run: node scripts/upload-firebase-to-ssm.js

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Read the JSON file ──────────────────────────────────────
const filePath = path.join(__dirname, '..', 'firebase-service-account.json');

if (!fs.existsSync(filePath)) {
  console.error('ERROR: firebase-service-account.json not found!');
  process.exit(1);
}

const raw = fs.readFileSync(filePath, 'utf8');

// ── Validate it's proper JSON ───────────────────────────────
let parsed;
try {
  parsed = JSON.parse(raw);
} catch (e) {
  console.error('ERROR: firebase-service-account.json is not valid JSON:', e.message);
  process.exit(1);
}

// ── Minify to single line (required for SSM) ────────────────
const minified = JSON.stringify(parsed);

console.log('✓ File read successfully');
console.log('✓ JSON is valid');
console.log('✓ Value starts with:', minified.substring(0, 40) + '...');
console.log('');

// ── Write to a temp file (avoids ALL shell quoting issues) ──
const tmpFile = path.join(__dirname, '..', '.ssm-tmp.json');
fs.writeFileSync(tmpFile, minified, 'utf8');
console.log('✓ Temp file written');

// ── Upload to SSM using file:// reference ───────────────────
console.log('Uploading to SSM Parameter Store...');
try {
  const result = execSync(
    `aws ssm put-parameter --name "/khatma/firebase-service-account" --type "SecureString" --value "file://${tmpFile}" --overwrite`,
    { encoding: 'utf8' }
  );
  console.log('✓ Upload successful!');
  console.log(result);
} catch (err) {
  console.error('ERROR uploading to SSM:', err.message);
  fs.unlinkSync(tmpFile);
  process.exit(1);
}

// ── Clean up temp file ──────────────────────────────────────
fs.unlinkSync(tmpFile);
console.log('✓ Temp file cleaned up');

// ── Verify: read back from SSM and check it's valid JSON ────
console.log('');
console.log('Verifying SSM value...');
try {
  const verify = execSync(
    `aws ssm get-parameter --name "/khatma/firebase-service-account" --with-decryption --query "Parameter.Value" --output text`,
    { encoding: 'utf8' }
  ).trim();

  const verifyParsed = JSON.parse(verify);
  console.log('✓ SSM value is valid JSON');
  console.log('✓ project_id:', verifyParsed.project_id);
  console.log('✓ client_email:', verifyParsed.client_email);
  console.log('✓ type:', verifyParsed.type);
  console.log('');
  console.log('========================================');
  console.log('  SUCCESS! Firebase key uploaded to SSM');
  console.log('========================================');
  console.log('');
  console.log('Now try logging into the admin dashboard:');
  console.log('https://d1gvd6wyne19ak.cloudfront.net');
} catch (err) {
  console.error('ERROR: SSM value is still not valid JSON!', err.message);
  process.exit(1);
}