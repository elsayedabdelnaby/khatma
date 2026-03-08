// fix-iam-permissions.js
// Grants SSM read access to all Lambda roles that need Firebase
// Run: node scripts/fix-iam-permissions.js

const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REGION = 'us-east-1';
const ACCOUNT = '085096851574';
const SSM_PARAM = '/khatma/firebase-service-account';

const ROLES = [
  'khatma-backend-dev-AuthorizerFunctionRole-1zpO7GdeGleZ',
  'khatma-backend-dev-NotificationWorkerFunctionRole-ZbLjM5WGXROe',
  'khatma-backend-dev-InvitationWorkerFunctionRole-YvjucBTRHnZ7',
];

const policy = {
  Version: '2012-10-17',
  Statement: [{
    Effect: 'Allow',
    Action: ['ssm:GetParameter', 'ssm:GetParameters'],
    Resource: `arn:aws:ssm:${REGION}:${ACCOUNT}:parameter${SSM_PARAM}`,
  }],
};

// Write policy to temp file
const tmpFile = path.join(os.tmpdir(), 'ssm-policy.json');
fs.writeFileSync(tmpFile, JSON.stringify(policy, null, 2));
console.log('Policy to attach:');
console.log(JSON.stringify(policy, null, 2));
console.log('');

let allOk = true;

for (const role of ROLES) {
  process.stdout.write(`Attaching to ${role} ... `);
  try {
    execSync(
      `aws iam put-role-policy --role-name "${role}" --policy-name SSMFirebaseAccess --policy-document "file://${tmpFile}"`,
      { encoding: 'utf8' }
    );
    console.log('✓ Done');
  } catch (err) {
    console.log('✗ FAILED');
    console.error('  Error:', err.stderr || err.message);
    allOk = false;
  }
}

fs.unlinkSync(tmpFile);
console.log('');

if (allOk) {
  console.log('========================================');
  console.log('  All permissions fixed!');
  console.log('========================================');
  console.log('');
  console.log('Now open the admin dashboard and log in:');
  console.log('https://d1gvd6wyne19ak.cloudfront.net');
} else {
  console.log('Some roles failed — check errors above.');
}