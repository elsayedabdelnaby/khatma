// ============================================================
// 📋 ايه هو الملف ده؟
// ============================================================
// بيقرأ ملف firebase-service-account.json
// وبيطبعه كـ string سطر واحد (عشان نحطه في SAM parameter)
//
// الاستخدام:
//   node scripts/get-firebase-param.js
// ============================================================

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'firebase-service-account.json');

if (!fs.existsSync(filePath)) {
  console.error('ERROR: firebase-service-account.json not found!');
  console.error('Please download it from Firebase Console → Project Settings → Service Accounts');
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const minified = JSON.stringify(JSON.parse(content));
console.log(minified);
