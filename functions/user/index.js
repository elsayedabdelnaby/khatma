// ============================================================
// ⚡ Lambda #2: User Management
// ============================================================
//
// 📋 الـ Lambda دي بتتعامل مع:
//   POST /auth/sync  → مزامنة بيانات المستخدم بعد الـ Login
//   GET  /auth/me    → جلب بياناتي
//   PUT  /auth/me    → تعديل بياناتي
//   GET  /auth/stats → إحصائيات حسابي
// ============================================================

const { success, error } = require('../../shared/response');
const {
  dynamodb, GetCommand, PutCommand, UpdateCommand, QueryCommand,
} = require('../../shared/dynamodb');

// Approximate Arabic letter counts per Juz (Quran ≈ 320,015 letters / 30)
const LETTERS_PER_PART = 10667;

/**
 * 📋 الـ Handler الرئيسي
 * بيستقبل كل الـ requests وبيوزعها على الدوال المناسبة
 */
exports.handler = async (event) => {
  const method = event.httpMethod;
  const path = event.path;

  try {
    if (method === 'POST' && path === '/auth/sync') {
      return await syncUser(event);
    }

    if (method === 'GET' && path === '/auth/me') {
      return await getMe(event);
    }

    if (method === 'PUT' && path === '/auth/me') {
      return await updateMe(event);
    }

    if (method === 'GET' && path === '/auth/stats') {
      return await getStats(event);
    }

    return error(404, 'NOT_FOUND', `Route not found: ${method} ${path}`);

  } catch (err) {
    console.error('Unhandled error:', err);
    return error(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
};

// ============================================================
// 📌 POST /auth/sync - مزامنة بيانات المستخدم
// ============================================================
// بيتنادي بعد كل Login ناجح من Firebase
// بيحفظ/يحدث بيانات المستخدم في DynamoDB
//
// 📋 ليه محتاجينها؟
//   - Firebase بيحفظ بيانات أساسية بس (email, name)
//   - إحنا محتاجين نحفظ حاجات تانية (fcmToken, language, role)
//   - وعايزين البيانات في DynamoDB عشان الـ Lambdas تقدر توصلها
// ============================================================
async function syncUser(event) {
  // ============================================================
  // 📋 شرح: استخراج بيانات المستخدم
  //
  // 1. userId: بييجي من Firebase Token (الـ Authorizer هيحطه)
  //    حالياً مؤقتاً بناخده من الـ body لحد ما نعمل الـ Authorizer
  //
  // 2. body: البيانات اللي الموبايل بعتها
  //    { fcmToken, language, displayName, photoUrl }
  // ============================================================

  const body = JSON.parse(event.body || '{}');

  // ============================================================
  // 📋 شرح: استخراج الـ userId
  // الـ Authorizer بيحط الـ userId في:
  //   event.requestContext.authorizer.userId
  // ده بييجي من Firebase Token - مش ممكن يتزور
  // ============================================================
  const userId = event.requestContext?.authorizer?.userId;

  if (!userId) {
    return error(400, 'VALIDATION_ERROR', 'userId is required');
  }

  // ============================================================
  // 📋 شرح: الوقت الحالي
  // بنحفظ إمتى المستخدم عمل sync
  // ISO format: "2026-02-18T10:30:00.000Z"
  // ============================================================
  const now = new Date().toISOString();

  // ============================================================
  // 📋 شرح: نشوف المستخدم موجود ولا جديد
  // GetCommand: بيجلب record واحد من الداتابيز
  // ============================================================
  const existingUser = await dynamodb.send(new GetCommand({
    TableName: process.env.USERS_TABLE,
    Key: { userId },
  }));

  // ============================================================
  // 📋 شرح: بيانات من الـ Authorizer
  // الـ Authorizer بيمرر بيانات إضافية من الـ Firebase Token
  // ============================================================
  const authContext = event.requestContext?.authorizer || {};

  // ============================================================
  // 📋 شرح: تجهيز بيانات المستخدم
  // الأولوية: body (الموبايل) → authContext (Token) → existing (قاعدة البيانات) → default
  // ============================================================
  const userData = {
    userId,
    email: body.email || authContext.email || existingUser.Item?.email || '',
    displayName: body.displayName || authContext.displayName || existingUser.Item?.displayName || '',
    photoUrl: body.photoUrl || authContext.photoUrl || existingUser.Item?.photoUrl || '',
    authProvider: authContext.authProvider || existingUser.Item?.authProvider || '',
    fcmToken: body.fcmToken || existingUser.Item?.fcmToken || '',
    language: body.language || existingUser.Item?.language || 'ar',
    role: existingUser.Item?.role || 'user',  // الـ role مبيتغيرش من الموبايل
    countryCode: body.countryCode || existingUser.Item?.countryCode || '',
    phoneNumber: body.phoneNumber || existingUser.Item?.phoneNumber || '',
    createdAt: existingUser.Item?.createdAt || now,  // أول مرة بس
    updatedAt: now,
  };

  // ============================================================
  // 📋 شرح: PutCommand = حفظ في الداتابيز
  // لو الـ userId موجود → يحدث البيانات
  // لو مش موجود → ينشئ record جديد
  // (ده الفرق عن SQL: مفيش INSERT و UPDATE منفصلين)
  // ============================================================
  await dynamodb.send(new PutCommand({
    TableName: process.env.USERS_TABLE,
    Item: userData,
  }));

  // ============================================================
  // 📋 شرح: نرجع بيانات المستخدم للموبايل
  // مش بنرجع الـ fcmToken عشان مش محتاجه يرجع
  // ============================================================
  const { fcmToken, ...userResponse } = userData;

  return success(userResponse, existingUser.Item ? 200 : 201);
}

// ============================================================
// 📌 GET /auth/stats - إحصائيات حسابي
// ============================================================
// Returns:
//   khatmasCount       → عدد الختمات اللي عملتها
//   readingPartsCount  → عدد الأجزاء (reserved + completed)
//   readingLettersCount→ تقدير حروف القراءة لهذه الأجزاء
// ============================================================
async function getStats(event) {
  const userId = event.requestContext?.authorizer?.userId;

  if (!userId) {
    return error(401, 'UNAUTHORIZED', 'Authentication required');
  }

  // 1) Khatmas I created
  const khatmasResult = await dynamodb.send(new QueryCommand({
    TableName: process.env.KHATMAS_TABLE,
    IndexName: 'userId-createdAt-index',
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
    Select: 'COUNT',
  }));
  const khatmasCount = khatmasResult.Count || 0;

  // 2) Parts I reserved or completed (across all khatmas)
  const partsResult = await dynamodb.send(new QueryCommand({
    TableName: process.env.KHATMA_PARTS_TABLE,
    IndexName: 'userId-index',
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
  }));
  const myParts = partsResult.Items || [];
  const readingParts = myParts.filter(
    (p) => p.status === 'reserved' || p.status === 'completed'
  );
  const readingPartsCount = readingParts.length;
  const readingLettersCount = readingPartsCount * LETTERS_PER_PART;

  return success({
    khatmasCount,
    readingPartsCount,
    readingLettersCount,
  });
}

// ============================================================
// 📌 GET /auth/me - جلب بياناتي
// ============================================================
async function getMe(event) {
  const userId = event.requestContext?.authorizer?.userId;

  if (!userId) {
    return error(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const result = await dynamodb.send(new GetCommand({
    TableName: process.env.USERS_TABLE,
    Key: { userId },
  }));

  if (!result.Item) {
    return error(404, 'NOT_FOUND', 'User not found');
  }

  // مش بنرجع الـ fcmToken
  const { fcmToken, ...userResponse } = result.Item;

  return success(userResponse);
}

// ============================================================
// 📌 PUT /auth/me - تعديل بياناتي
// ============================================================
async function updateMe(event) {
  const userId = event.requestContext?.authorizer?.userId;
  const body = JSON.parse(event.body || '{}');

  if (!userId) {
    return error(401, 'UNAUTHORIZED', 'Authentication required');
  }

  // ============================================================
  // 📋 شرح: الحقول المسموح تعديلها
  // المستخدم مش يقدر يعدل الـ role أو الـ userId
  // ============================================================
  const allowedFields = ['displayName', 'language', 'photoUrl', 'fcmToken', 'countryCode', 'phoneNumber'];
  const updates = {};

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return error(400, 'VALIDATION_ERROR', 'No valid fields to update');
  }

  // ============================================================
  // 📋 شرح: UpdateCommand
  // بدل ما نقرأ الـ record كله ونكتبه تاني
  // بنحدث الحقول المطلوبة بس
  // ده أسرع وأأمن (مفيش race condition)
  // ============================================================
  const updateExpression = [];
  const expressionValues = {};
  const expressionNames = {};

  for (const [key, value] of Object.entries(updates)) {
    updateExpression.push(`#${key} = :${key}`);
    expressionValues[`:${key}`] = value;
    expressionNames[`#${key}`] = key;
  }

  // دايماً نحدث الـ updatedAt
  updateExpression.push('#updatedAt = :updatedAt');
  expressionValues[':updatedAt'] = new Date().toISOString();
  expressionNames['#updatedAt'] = 'updatedAt';

  const result = await dynamodb.send(new UpdateCommand({
    TableName: process.env.USERS_TABLE,
    Key: { userId },
    UpdateExpression: `SET ${updateExpression.join(', ')}`,
    ExpressionAttributeValues: expressionValues,
    ExpressionAttributeNames: expressionNames,
    ReturnValues: 'ALL_NEW',  // رجعلي البيانات بعد التحديث
  }));

  const { fcmToken, ...userResponse } = result.Attributes;

  return success(userResponse);
}

