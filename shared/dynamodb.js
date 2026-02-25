// ============================================================
// 📋 ايه هو الملف ده؟
// ============================================================
// بيعمل اتصال مع DynamoDB (قاعدة البيانات)
// كل Lambda بتستخدم الملف ده عشان تقرأ وتكتب في الداتابيز
//
// 📖 ايه هو DynamoDB؟
// قاعدة بيانات NoSQL من AWS - سريعة جداً + serverless
// مش بتحتاج تعمل connection pool زي MySQL
// كل مرة بتكلمها مباشرة
// ============================================================

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,         // جلب record واحد
  PutCommand,         // إضافة/تحديث record
  QueryCommand,       // بحث بالـ Key
  ScanCommand,        // جلب كل البيانات (بطيء - تجنبه)
  UpdateCommand,      // تحديث جزء من record
  DeleteCommand,      // حذف record
  BatchWriteCommand,  // كتابة كتير مرة واحدة (زي 30 جزء)
} = require('@aws-sdk/lib-dynamodb');

// ============================================================
// 🔌 إنشاء الاتصال
// ============================================================
// الاتصال بيتعمل مرة واحدة بس (مش كل request)
// ده بيخلي الأداء أسرع
// ============================================================
const client = new DynamoDBClient({});

const dynamodb = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,  // لو حاجة undefined متحطهاش في الداتابيز
  },
});

// ============================================================
// 📦 Export الدوال
// ============================================================
module.exports = {
  dynamodb,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
  BatchWriteCommand,
};

