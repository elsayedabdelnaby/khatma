// ============================================================
// ⚡ Lambda #2: User Management
// ============================================================
//
// 📋 الـ Lambda دي بتتعامل مع 3 APIs:
//   POST /auth/sync  → مزامنة بيانات المستخدم بعد الـ Login
//   GET  /auth/me    → جلب بياناتي
//   PUT  /auth/me    → تعديل بياناتي
//
// 📋 إزاي بتعرف أنهي API؟
//   - من الـ event.httpMethod (GET, POST, PUT)
//   - ومن الـ event.path (/auth/sync, /auth/me)
//
// 📋 ليه Lambda واحدة لـ 3 APIs؟
//   - عشان نقلل عدد الـ Lambdas
//   - كلهم بيتعاملوا مع Users Table
//   - كود أبسط وأسهل في الصيانة
// ============================================================

const { success, error } = require('../../shared/response');
const { dynamodb, GetCommand, PutCommand, UpdateCommand } = require('../../shared/dynamodb');

/**
 * 📋 الـ Handler الرئيسي
 * بيستقبل كل الـ requests وبيوزعها على الدوال المناسبة
 */
exports.handler = async (event) => {
  // ============================================================
  // 📋 شرح: Router (موزع الطلبات)
  // بناخد الـ method والـ path من الـ event
  // وبنوجه الطلب للدالة المناسبة
  // ============================================================

  const method = event.httpMethod;    // GET, POST, PUT
  const path = event.path;           // /auth/sync, /auth/me

  try {
    // POST /auth/sync
    if (method === 'POST' && path === '/auth/sync') {
      return await syncUser(event);
    }

    // GET /auth/me
    if (method === 'GET' && path === '/auth/me') {
      return await getMe(event);
    }

    // PUT /auth/me
    if (method === 'PUT' && path === '/auth/me') {
      return await updateMe(event);
    }

    // لو الـ path مش معروف
    return error(404, 'NOT_FOUND', `Route not found: ${method} ${path}`);

  } catch (err) {
    // ============================================================
    // 📋 شرح: Error Handling
    // لو حصل أي خطأ غير متوقع - بنرجع 500
    // مهم عشان الأبليكيشن ميقعش
    // ============================================================
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

