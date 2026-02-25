// ============================================================
// ⚡ Lambda #3: Khatma Management (قلب المشروع)
// ============================================================
//
// 📋 الـ Lambda دي بتتعامل مع:
//   POST /khatmas                              → إنشاء ختمة جديدة
//   GET  /khatmas                              → قائمة الختمات
//   GET  /khatmas/{khatmaId}                   → تفاصيل ختمة
//   POST /khatmas/{khatmaId}/parts/reserve     → حجز أجزاء
//   POST /khatmas/{khatmaId}/parts/complete    → تسجيل إتمام أجزاء
//   POST /khatmas/{khatmaId}/parts/add-extra   → إضافة جزء إضافي
// ============================================================

const { success, error } = require('../../shared/response');
const {
  dynamodb, GetCommand, PutCommand, QueryCommand,
  UpdateCommand, BatchWriteCommand
} = require('../../shared/dynamodb');
const { v4: uuid } = require('uuid');

// ============================================================
// 📋 أسماء أجزاء القرآن الـ 30
// ============================================================
const PART_NAMES = {
  1: 'الجزء الأول', 2: 'الجزء الثاني', 3: 'الجزء الثالث',
  4: 'الجزء الرابع', 5: 'الجزء الخامس', 6: 'الجزء السادس',
  7: 'الجزء السابع', 8: 'الجزء الثامن', 9: 'الجزء التاسع',
  10: 'الجزء العاشر', 11: 'الجزء الحادي عشر', 12: 'الجزء الثاني عشر',
  13: 'الجزء الثالث عشر', 14: 'الجزء الرابع عشر', 15: 'الجزء الخامس عشر',
  16: 'الجزء السادس عشر', 17: 'الجزء السابع عشر', 18: 'الجزء الثامن عشر',
  19: 'الجزء التاسع عشر', 20: 'الجزء العشرون', 21: 'الجزء الحادي والعشرون',
  22: 'الجزء الثاني والعشرون', 23: 'الجزء الثالث والعشرون',
  24: 'الجزء الرابع والعشرون', 25: 'الجزء الخامس والعشرون',
  26: 'الجزء السادس والعشرون', 27: 'الجزء السابع والعشرون',
  28: 'الجزء الثامن والعشرون', 29: 'الجزء التاسع والعشرون',
  30: 'الجزء الثلاثون',
};

exports.handler = async (event) => {
  const method = event.httpMethod;
  const path = event.path;
  const userId = event.requestContext?.authorizer?.userId;

  if (!userId) {
    return error(401, 'UNAUTHORIZED', 'Authentication required');
  }

  try {
    // POST /khatmas
    if (method === 'POST' && path === '/khatmas') {
      return await createKhatma(event, userId);
    }

    // GET /khatmas
    if (method === 'GET' && path === '/khatmas') {
      return await listKhatmas(event, userId);
    }

    // GET /khatmas/{khatmaId}
    if (method === 'GET' && path.match(/^\/khatmas\/[^/]+$/)) {
      return await getKhatmaDetails(event, userId);
    }

    // POST /khatmas/{khatmaId}/parts/reserve
    if (method === 'POST' && path.endsWith('/parts/reserve')) {
      return await reserveParts(event, userId);
    }

    // POST /khatmas/{khatmaId}/parts/complete
    if (method === 'POST' && path.endsWith('/parts/complete')) {
      return await completeParts(event, userId);
    }

    // POST /khatmas/{khatmaId}/parts/add-extra
    if (method === 'POST' && path.endsWith('/parts/add-extra')) {
      return await reserveParts(event, userId);
    }

    return error(404, 'NOT_FOUND', `Route not found: ${method} ${path}`);
  } catch (err) {
    console.error('Unhandled error:', err);
    return error(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
};

// ============================================================
// 📌 POST /khatmas - إنشاء ختمة جديدة
// ============================================================
// بينشئ ختمة + 30 جزء (كلهم available)
//
// 📋 ايه اللي بيحصل؟
//   1. بيتأكد من البيانات (name, intention, type)
//   2. بينشئ record في Khatmas Table
//   3. بينشئ 30 record في KhatmaParts Table (كل جزء status: available)
//   4. بيرجع بيانات الختمة + link المشاركة
// ============================================================
async function createKhatma(event, userId) {
  const body = JSON.parse(event.body || '{}');

  // Validation
  if (!body.name || !body.name.trim()) {
    return error(400, 'VALIDATION_ERROR', 'Khatma name is required');
  }
  if (!body.intention || !body.intention.trim()) {
    return error(400, 'VALIDATION_ERROR', 'Intention is required');
  }

  const validTypes = ['private', 'by_invitation', 'public'];
  const khatmaType = body.type || 'public';
  if (!validTypes.includes(khatmaType)) {
    return error(400, 'VALIDATION_ERROR', `Type must be one of: ${validTypes.join(', ')}`);
  }

  const now = new Date().toISOString();
  const khatmaId = `kh_${uuid()}`;

  // ============================================================
  // 📋 شرح: إنشاء الختمة
  // ============================================================
  const khatmaData = {
    khatmaId,
    userId,
    name: body.name.trim(),
    intention: body.intention.trim(),
    type: khatmaType,
    khatmaTypeId: body.khatmaTypeId || '',
    status: 'active',
    totalParts: 30,
    completedParts: 0,
    shareLink: `https://app.khatma.com/join/${khatmaId}`,
    createdAt: now,
    updatedAt: now,
  };

  await dynamodb.send(new PutCommand({
    TableName: process.env.KHATMAS_TABLE,
    Item: khatmaData,
  }));

  // ============================================================
  // 📋 شرح: إنشاء 30 جزء
  //
  // BatchWriteCommand: بيكتب 25 record مرة واحدة (أسرع)
  // القرآن 30 جزء → محتاجين batch واحد (25) + batch تاني (5)
  // ============================================================
  const parts = [];
  for (let i = 1; i <= 30; i++) {
    parts.push({
      PutRequest: {
        Item: {
          khatmaId,
          partNumber: i,
          partName: PART_NAMES[i],
          userId: '',
          userName: '',
          status: 'available',
          reservedAt: '',
          completedAt: '',
        },
      },
    });
  }

  // DynamoDB BatchWrite max = 25 items per call
  const batch1 = parts.slice(0, 25);
  const batch2 = parts.slice(25);

  await dynamodb.send(new BatchWriteCommand({
    RequestItems: { [process.env.KHATMA_PARTS_TABLE]: batch1 },
  }));

  if (batch2.length > 0) {
    await dynamodb.send(new BatchWriteCommand({
      RequestItems: { [process.env.KHATMA_PARTS_TABLE]: batch2 },
    }));
  }

  return success(khatmaData, 201);
}

// ============================================================
// 📌 GET /khatmas - قائمة الختمات
// ============================================================
// Query Parameters:
//   type=public  → ختمات عامة نشطة
//   type=mine    → ختماتي (اللي أنا عملتها)
//   type=invited → ختمات أنا مدعو فيها
// ============================================================
async function listKhatmas(event, userId) {
  const queryParams = event.queryStringParameters || {};
  const listType = queryParams.type || 'public';

  let khatmas = [];

  if (listType === 'mine') {
    // ============================================================
    // 📋 شرح: ختماتي
    // بنستخدم GSI: userId-createdAt-index
    // بنجيب كل الختمات اللي أنا عملتها
    // ============================================================
    const result = await dynamodb.send(new QueryCommand({
      TableName: process.env.KHATMAS_TABLE,
      IndexName: 'userId-createdAt-index',
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
      ScanIndexForward: false, // الأحدث الأول
    }));
    khatmas = result.Items || [];

  } else if (listType === 'public') {
    // ============================================================
    // 📋 شرح: ختمات عامة
    // بنستخدم GSI: type-status-index
    // بنجيب كل الختمات العامة النشطة
    // ============================================================
    const result = await dynamodb.send(new QueryCommand({
      TableName: process.env.KHATMAS_TABLE,
      IndexName: 'type-status-index',
      KeyConditionExpression: '#type = :type AND #status = :status',
      ExpressionAttributeNames: { '#type': 'type', '#status': 'status' },
      ExpressionAttributeValues: { ':type': 'public', ':status': 'active' },
      ScanIndexForward: false,
    }));
    khatmas = result.Items || [];

  } else if (listType === 'invited') {
    // ============================================================
    // 📋 شرح: ختمات مدعو فيها
    // 1. نجيب الأجزاء اللي أنا حجزتها (من Parts Table)
    // 2. نجيب تفاصيل الختمات بتاعتهم
    // ============================================================
    const partsResult = await dynamodb.send(new QueryCommand({
      TableName: process.env.KHATMA_PARTS_TABLE,
      IndexName: 'userId-index',
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
    }));

    const myParts = partsResult.Items || [];
    const khatmaIds = [...new Set(myParts.map(p => p.khatmaId))];

    for (const kid of khatmaIds) {
      const khatma = await dynamodb.send(new GetCommand({
        TableName: process.env.KHATMAS_TABLE,
        Key: { khatmaId: kid },
      }));
      if (khatma.Item && khatma.Item.userId !== userId) {
        khatma.Item.myParts = myParts
          .filter(p => p.khatmaId === kid)
          .map(p => ({ partNumber: p.partNumber, status: p.status }));
        khatmas.push(khatma.Item);
      }
    }
  }

  // لكل ختمة - نجيب عدد الأجزاء المتاحة والمكتملة
  for (const khatma of khatmas) {
    const partsResult = await dynamodb.send(new QueryCommand({
      TableName: process.env.KHATMA_PARTS_TABLE,
      KeyConditionExpression: 'khatmaId = :kid',
      ExpressionAttributeValues: { ':kid': khatma.khatmaId },
    }));

    const parts = partsResult.Items || [];
    khatma.availableParts = parts.filter(p => p.status === 'available').length;
    khatma.completedParts = parts.filter(p => p.status === 'completed').length;
    khatma.reservedParts = parts.filter(p => p.status === 'reserved').length;

    if (!khatma.myParts) {
      khatma.myParts = parts
        .filter(p => p.userId === userId)
        .map(p => ({ partNumber: p.partNumber, status: p.status }));
    }
  }

  return success({ khatmas });
}

// ============================================================
// 📌 GET /khatmas/{khatmaId} - تفاصيل ختمة
// ============================================================
async function getKhatmaDetails(event, userId) {
  const khatmaId = event.pathParameters?.khatmaId
    || event.path.split('/').pop();

  // جلب الختمة
  const khatmaResult = await dynamodb.send(new GetCommand({
    TableName: process.env.KHATMAS_TABLE,
    Key: { khatmaId },
  }));

  if (!khatmaResult.Item) {
    return error(404, 'NOT_FOUND', 'Khatma not found');
  }

  const khatma = khatmaResult.Item;

  // ============================================================
  // 📋 شرح: Authorization Check
  // لو الختمة private → بس الـ owner يشوفها
  // لو by_invitation → الـ owner + المدعوين
  // لو public → أي حد
  // ============================================================
  if (khatma.type === 'private' && khatma.userId !== userId) {
    return error(403, 'FORBIDDEN', 'This khatma is private');
  }

  // جلب كل الأجزاء (30 جزء)
  const partsResult = await dynamodb.send(new QueryCommand({
    TableName: process.env.KHATMA_PARTS_TABLE,
    KeyConditionExpression: 'khatmaId = :kid',
    ExpressionAttributeValues: { ':kid': khatmaId },
    ScanIndexForward: true, // مرتب من 1 لـ 30
  }));

  const parts = partsResult.Items || [];

  // تجميع المشاركين
  const participantsMap = {};
  for (const part of parts) {
    if (part.userId) {
      if (!participantsMap[part.userId]) {
        participantsMap[part.userId] = {
          userId: part.userId,
          displayName: part.userName || 'Unknown',
          parts: [],
        };
      }
      participantsMap[part.userId].parts.push({
        partNumber: part.partNumber,
        partName: part.partName || PART_NAMES[part.partNumber],
        status: part.status,
      });
    }
  }

  return success({
    ...khatma,
    completedParts: parts.filter(p => p.status === 'completed').length,
    availableParts: parts.filter(p => p.status === 'available').length,
    parts: parts.map(p => ({
      partNumber: p.partNumber,
      partName: p.partName || PART_NAMES[p.partNumber],
      status: p.status,
      userName: p.userName || null,
      userId: p.userId || null,
    })),
    participants: Object.values(participantsMap),
  });
}

// ============================================================
// 📌 POST /khatmas/{khatmaId}/parts/reserve - حجز أجزاء
// ============================================================
// Body: { "partNumbers": [3, 7, 15] }
//
// 📋 ايه اللي بيحصل؟
//   1. لكل جزء → Conditional Update: لو status = available → غيره لـ reserved
//   2. لو الجزء اتحجز بالفعل → يضيفه في الـ failed list
//   3. ده بيحمي من Race Condition (لو 2 حجزوا نفس الجزء)
// ============================================================
async function reserveParts(event, userId) {
  const khatmaId = event.pathParameters?.khatmaId
    || event.path.split('/')[2];
  const body = JSON.parse(event.body || '{}');
  const partNumbers = body.partNumbers || [];

  if (!partNumbers.length) {
    return error(400, 'VALIDATION_ERROR', 'partNumbers array is required');
  }

  // جلب اسم المستخدم للعرض
  const userResult = await dynamodb.send(new GetCommand({
    TableName: process.env.USERS_TABLE,
    Key: { userId },
  }));
  const userName = userResult.Item?.displayName || 'Unknown';

  const now = new Date().toISOString();
  const reserved = [];
  const failed = [];

  for (const partNumber of partNumbers) {
    try {
      // ============================================================
      // 📋 شرح: Conditional Update
      //
      // "غير الـ status لـ reserved بس لو الـ status الحالي = available"
      //
      // لو اثنين حاولوا يحجزوا نفس الجزء في نفس اللحظة:
      // - الأول ينجح (status available → reserved) ✅
      // - الثاني يفشل (status مش available بقى) ❌
      //
      // ده اسمه "Optimistic Locking" - حماية بدون Lock
      // ============================================================
      await dynamodb.send(new UpdateCommand({
        TableName: process.env.KHATMA_PARTS_TABLE,
        Key: { khatmaId, partNumber },
        UpdateExpression: 'SET #status = :reserved, userId = :uid, userName = :uname, reservedAt = :now',
        ConditionExpression: '#status = :available',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':reserved': 'reserved',
          ':available': 'available',
          ':uid': userId,
          ':uname': userName,
          ':now': now,
        },
      }));
      reserved.push(partNumber);
    } catch (err) {
      if (err.name === 'ConditionalCheckFailedException') {
        failed.push(partNumber);
      } else {
        throw err;
      }
    }
  }

  if (reserved.length === 0) {
    return error(409, 'PART_NOT_AVAILABLE', 'All requested parts are no longer available', );
  }

  const statusCode = failed.length > 0 ? 207 : 200;
  return success({ reserved, failed }, statusCode);
}

// ============================================================
// 📌 POST /khatmas/{khatmaId}/parts/complete - إتمام أجزاء
// ============================================================
// Body: { "partNumbers": [3] }
// ============================================================
async function completeParts(event, userId) {
  const khatmaId = event.pathParameters?.khatmaId
    || event.path.split('/')[2];
  const body = JSON.parse(event.body || '{}');
  const partNumbers = body.partNumbers || [];

  if (!partNumbers.length) {
    return error(400, 'VALIDATION_ERROR', 'partNumbers array is required');
  }

  const now = new Date().toISOString();
  const completed = [];
  const failed = [];

  for (const partNumber of partNumbers) {
    try {
      // ============================================================
      // 📋 شرح: Conditional Update
      // "غير الـ status لـ completed بس لو أنت اللي حاجزه"
      // محدش يقدر يكمل جزء حد تاني
      // ============================================================
      await dynamodb.send(new UpdateCommand({
        TableName: process.env.KHATMA_PARTS_TABLE,
        Key: { khatmaId, partNumber },
        UpdateExpression: 'SET #status = :completed, completedAt = :now',
        ConditionExpression: '#status = :reserved AND userId = :uid',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':completed': 'completed',
          ':reserved': 'reserved',
          ':uid': userId,
          ':now': now,
        },
      }));
      completed.push(partNumber);
    } catch (err) {
      if (err.name === 'ConditionalCheckFailedException') {
        failed.push(partNumber);
      } else {
        throw err;
      }
    }
  }

  // ============================================================
  // 📋 شرح: هل الختمة اكتملت؟
  // نشوف كام جزء مكتمل - لو 30 → الختمة خلصت! 🎉
  // ============================================================
  let khatmaCompleted = false;
  if (completed.length > 0) {
    const partsResult = await dynamodb.send(new QueryCommand({
      TableName: process.env.KHATMA_PARTS_TABLE,
      KeyConditionExpression: 'khatmaId = :kid',
      ExpressionAttributeValues: { ':kid': khatmaId },
    }));

    const allParts = partsResult.Items || [];
    const completedCount = allParts.filter(p => p.status === 'completed').length;

    // تحديث عدد الأجزاء المكتملة في الختمة
    const updateData = {
      ':count': completedCount,
      ':now': now,
    };
    let updateExpr = 'SET completedParts = :count, updatedAt = :now';

    if (completedCount >= 30) {
      khatmaCompleted = true;
      updateExpr += ', #status = :completed';
      updateData[':completed'] = 'completed';
    }

    const exprNames = { '#status': 'status' };

    await dynamodb.send(new UpdateCommand({
      TableName: process.env.KHATMAS_TABLE,
      Key: { khatmaId },
      UpdateExpression: updateExpr,
      ExpressionAttributeValues: updateData,
      ExpressionAttributeNames: exprNames,
    }));
  }

  return success({
    completed,
    failed,
    khatmaCompleted,
    message: khatmaCompleted ? 'Khatma completed! 🎉' : undefined,
  });
}
