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
//   GET  /khatmas/{khatmaId}/participants      → قائمة المشاركين (المالك فقط)
//   POST /khatmas/{khatmaId}/participants/remind → تذكير مشارك
//   POST /khatmas/{khatmaId}/participants/remove → إزالة مشارك
//   GET  /parts/{partNumber}/available-khatmas  → ختمات عامة متاح فيها هذا الجزء
// ============================================================

const { success, error } = require('../../shared/response');
const {
  dynamodb, GetCommand, PutCommand, QueryCommand,
  UpdateCommand, BatchWriteCommand, ScanCommand, DeleteCommand,
} = require('../../shared/dynamodb');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { v4: uuid } = require('uuid');

const sqs = new SQSClient({});

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
      return await addExtraParts(event, userId);
    }

    // GET /khatmas/{khatmaId}/participants
    if (method === 'GET' && path.endsWith('/participants')) {
      return await listParticipants(event, userId);
    }

    // POST /khatmas/{khatmaId}/participants/remind
    if (method === 'POST' && path.endsWith('/participants/remind')) {
      return await remindParticipant(event, userId);
    }

    // POST /khatmas/{khatmaId}/participants/remove
    if (method === 'POST' && path.endsWith('/participants/remove')) {
      return await removeParticipant(event, userId);
    }

    // GET /parts/{partNumber}/available-khatmas
    if (method === 'GET' && path.match(/^\/parts\/\d+\/available-khatmas$/)) {
      return await listAvailableKhatmasByPart(event, userId);
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
          status: 'available',
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
//   type=public|mine|invited   → مصدر القائمة (default: public)
//   status=active|completed|all → فلتر حالة الختمة (default: all for mine/invited, active for public)
//   page=1                     → رقم الصفحة (default: 1)
//   limit=20                   → حجم الصفحة (default: 20, max: 100)
// ============================================================
function deriveParticipantProgress(parts) {
  if (!parts.length) return 'not_started';
  const hasReserved = parts.some((p) => p.status === 'reserved');
  const allCompleted = parts.every((p) => p.status === 'completed');
  if (allCompleted) return 'done';
  if (hasReserved || parts.some((p) => p.status === 'completed')) return 'reading';
  return 'not_started';
}

function participantActions(progress, isOwner, isManageable) {
  const canManage = isManageable && !isOwner && (progress === 'not_started' || progress === 'reading');
  return {
    canRemind: canManage,
    canRemove: canManage,
  };
}

async function loadKhatmaForOwner(khatmaId, userId) {
  const khatmaResult = await dynamodb.send(new GetCommand({
    TableName: process.env.KHATMAS_TABLE,
    Key: { khatmaId },
  }));

  if (!khatmaResult.Item) {
    return { error: error(404, 'NOT_FOUND', 'Khatma not found') };
  }

  if (khatmaResult.Item.userId !== userId) {
    return { error: error(403, 'FORBIDDEN', 'Only the khatma owner can manage participants') };
  }

  return { khatma: khatmaResult.Item };
}

async function loadKhatmaParts(khatmaId) {
  const partsResult = await dynamodb.send(new QueryCommand({
    TableName: process.env.KHATMA_PARTS_TABLE,
    KeyConditionExpression: 'khatmaId = :kid',
    ExpressionAttributeValues: { ':kid': khatmaId },
    ScanIndexForward: true,
  }));
  return partsResult.Items || [];
}

async function loadKhatmaInvitations(khatmaId) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: process.env.KHATMA_INVITATIONS_TABLE,
    KeyConditionExpression: 'khatmaId = :kid',
    ExpressionAttributeValues: { ':kid': khatmaId },
  }));
  return result.Items || [];
}

async function findUserByEmail(email) {
  const result = await dynamodb.send(new ScanCommand({
    TableName: process.env.USERS_TABLE,
    FilterExpression: 'email = :email',
    ExpressionAttributeValues: { ':email': email.toLowerCase() },
    Limit: 1,
  }));
  return result.Items?.[0] || null;
}

async function buildParticipantsList(khatma, parts, invitations, options = {}) {
  const { includeManageFlags = false, ownerUserId } = options;
  const participantsMap = {};

  for (const part of parts) {
    if (!part.userId) continue;
    if (!participantsMap[part.userId]) {
      participantsMap[part.userId] = {
        userId: part.userId,
        email: null,
        displayName: part.userName || 'Unknown',
        photoUrl: null,
        source: 'joined',
        invitationStatus: null,
        parts: [],
      };
    }
    participantsMap[part.userId].parts.push({
      partNumber: part.partNumber,
      partName: part.partName || PART_NAMES[part.partNumber],
      status: part.status,
    });
  }

  for (const inv of invitations) {
    if (inv.status === 'declined') continue;
    const email = (inv.email || '').toLowerCase();
    if (!email) continue;

    const uid = inv.invitedUserId || null;
    if (uid && participantsMap[uid]) {
      participantsMap[uid].invitationStatus = inv.status;
      if (!participantsMap[uid].email) participantsMap[uid].email = email;
      continue;
    }

    const existingByEmail = Object.values(participantsMap).find(
      (p) => p.email && p.email.toLowerCase() === email
    );
    if (existingByEmail) {
      existingByEmail.invitationStatus = inv.status;
      continue;
    }

    const key = uid || `email:${email}`;
    if (!participantsMap[key]) {
      participantsMap[key] = {
        userId: uid,
        email,
        displayName: email,
        photoUrl: null,
        source: uid ? 'joined' : 'invitation',
        invitationStatus: inv.status,
        parts: [],
      };
    }
  }

  const participants = [];
  for (const entry of Object.values(participantsMap)) {
    if (entry.userId) {
      const userResult = await dynamodb.send(new GetCommand({
        TableName: process.env.USERS_TABLE,
        Key: { userId: entry.userId },
      }));
      if (userResult.Item) {
        entry.email = userResult.Item.email || entry.email;
        entry.displayName = userResult.Item.displayName || entry.displayName;
        entry.photoUrl = userResult.Item.photoUrl || null;
      }
    }

    const progress = deriveParticipantProgress(entry.parts);
    const isOwner = entry.userId === ownerUserId;
    const item = {
      userId: entry.userId,
      email: entry.email,
      displayName: entry.displayName,
      photoUrl: entry.photoUrl,
      source: entry.source,
      invitationStatus: entry.invitationStatus,
      progress,
      partsCount: entry.parts.length,
      completedPartsCount: entry.parts.filter((p) => p.status === 'completed').length,
      reservedPartsCount: entry.parts.filter((p) => p.status === 'reserved').length,
      parts: entry.parts,
      isOwner,
    };

    if (includeManageFlags) {
      Object.assign(item, participantActions(progress, isOwner, true));
    }

    participants.push(item);
  }

  participants.sort((a, b) => {
    if (a.isOwner) return -1;
    if (b.isOwner) return 1;
    return a.displayName.localeCompare(b.displayName);
  });

  return participants;
}

async function queuePushNotification({ fcmToken, title, body, data }) {
  if (!fcmToken || !process.env.NOTIFICATIONS_QUEUE_URL) return false;

  await sqs.send(new SendMessageCommand({
    QueueUrl: process.env.NOTIFICATIONS_QUEUE_URL,
    MessageBody: JSON.stringify({ fcmToken, title, body, data }),
  }));
  return true;
}

async function createInAppNotification(targetUserId, khatma, message) {
  const now = new Date().toISOString();
  await dynamodb.send(new PutCommand({
    TableName: process.env.NOTIFICATIONS_TABLE,
    Item: {
      userId: targetUserId,
      createdAt: now,
      type: 'reminder',
      title: `Reminder: ${khatma.name}`,
      body: message,
      isRead: false,
      actionType: 'open_khatma',
      actionId: khatma.khatmaId,
    },
  }));
}

function parsePagination(queryParams) {
  const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit, 10) || 20));
  return { page, limit };
}

function applyPagination(items, page, limit) {
  const total = items.length;
  const start = (page - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    pagination: {
      page,
      limit,
      total,
      hasMore: start + limit < total,
    },
  };
}

function deriveProgress(khatma) {
  if (khatma.status === 'completed' || (khatma.completedParts || 0) >= 30) {
    return 'completed';
  }
  if ((khatma.reservedParts || 0) > 0 || (khatma.completedParts || 0) > 0) {
    return 'in_progress';
  }
  return 'not_started';
}

async function enrichKhatmaWithParts(khatma, userId) {
  const partsResult = await dynamodb.send(new QueryCommand({
    TableName: process.env.KHATMA_PARTS_TABLE,
    KeyConditionExpression: 'khatmaId = :kid',
    ExpressionAttributeValues: { ':kid': khatma.khatmaId },
  }));

  const parts = partsResult.Items || [];
  khatma.availableParts = parts.filter((p) => p.status === 'available').length;
  khatma.completedParts = parts.filter((p) => p.status === 'completed').length;
  khatma.reservedParts = parts.filter((p) => p.status === 'reserved').length;

  if (!khatma.myParts) {
    khatma.myParts = parts
      .filter((p) => p.userId === userId)
      .map((p) => ({ partNumber: p.partNumber, status: p.status }));
  }

  khatma.progress = deriveProgress(khatma);
  return khatma;
}

async function listKhatmas(event, userId) {
  const queryParams = event.queryStringParameters || {};
  const listType = queryParams.type || 'public';
  const statusFilter = (queryParams.status || (listType === 'public' ? 'active' : 'all')).toLowerCase();
  const { page, limit } = parsePagination(queryParams);

  const validStatuses = ['active', 'completed', 'all'];
  if (!validStatuses.includes(statusFilter)) {
    return error(400, 'VALIDATION_ERROR', 'status must be one of: active, completed, all');
  }

  let khatmas = [];

  if (listType === 'mine') {
    const queryInput = {
      TableName: process.env.KHATMAS_TABLE,
      IndexName: 'userId-createdAt-index',
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
      ScanIndexForward: false,
    };

    // Filter by khatma status when requested (active = in_progress + not_started)
    if (statusFilter !== 'all') {
      queryInput.FilterExpression = '#status = :status';
      queryInput.ExpressionAttributeNames = { '#status': 'status' };
      queryInput.ExpressionAttributeValues[':status'] = statusFilter;
    }

    const result = await dynamodb.send(new QueryCommand(queryInput));
    khatmas = result.Items || [];

  } else if (listType === 'public') {
    const publicStatus = statusFilter === 'all' ? 'active' : statusFilter;
    const result = await dynamodb.send(new QueryCommand({
      TableName: process.env.KHATMAS_TABLE,
      IndexName: 'type-status-index',
      KeyConditionExpression: '#type = :type AND #status = :status',
      ExpressionAttributeNames: { '#type': 'type', '#status': 'status' },
      ExpressionAttributeValues: { ':type': 'public', ':status': publicStatus },
      ScanIndexForward: false,
    }));
    khatmas = result.Items || [];

  } else if (listType === 'invited') {
    const partsResult = await dynamodb.send(new QueryCommand({
      TableName: process.env.KHATMA_PARTS_TABLE,
      IndexName: 'userId-index',
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
    }));

    const myParts = partsResult.Items || [];
    const khatmaIds = [...new Set(myParts.map((p) => p.khatmaId))];

    for (const kid of khatmaIds) {
      const khatma = await dynamodb.send(new GetCommand({
        TableName: process.env.KHATMAS_TABLE,
        Key: { khatmaId: kid },
      }));
      if (khatma.Item && khatma.Item.userId !== userId) {
        if (statusFilter !== 'all' && khatma.Item.status !== statusFilter) {
          continue;
        }
        khatma.Item.myParts = myParts
          .filter((p) => p.khatmaId === kid)
          .map((p) => ({ partNumber: p.partNumber, status: p.status }));
        khatmas.push(khatma.Item);
      }
    }
  } else {
    return error(400, 'VALIDATION_ERROR', 'type must be one of: public, mine, invited');
  }

  // Paginate before enriching parts (cheaper)
  const { items: pageItems, pagination } = applyPagination(khatmas, page, limit);

  for (const khatma of pageItems) {
    await enrichKhatmaWithParts(khatma, userId);
  }

  return success({ khatmas: pageItems, pagination });
}

// ============================================================
// 📌 GET /parts/{partNumber}/available-khatmas
// ============================================================
// Returns public active khatmas where the given part is still available.
// Query: page, limit
// ============================================================
async function listAvailableKhatmasByPart(event, userId) {
  const rawPart = event.pathParameters?.partNumber
    || (event.path.match(/^\/parts\/(\d+)\/available-khatmas$/) || [])[1];
  const partNumber = parseInt(rawPart, 10);

  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 30) {
    return error(400, 'VALIDATION_ERROR', 'partNumber must be an integer between 1 and 30');
  }

  const queryParams = event.queryStringParameters || {};
  const { page, limit } = parsePagination(queryParams);

  // Query all part records where this juz is still available
  const partsResult = await dynamodb.send(new QueryCommand({
    TableName: process.env.KHATMA_PARTS_TABLE,
    IndexName: 'partNumber-status-index',
    KeyConditionExpression: 'partNumber = :pn AND #status = :available',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':pn': partNumber,
      ':available': 'available',
    },
  }));

  const partRows = partsResult.Items || [];
  const khatmaIds = [...new Set(partRows.map((p) => p.khatmaId))];

  const khatmas = [];
  for (const kid of khatmaIds) {
    const khatmaResult = await dynamodb.send(new GetCommand({
      TableName: process.env.KHATMAS_TABLE,
      Key: { khatmaId: kid },
    }));
    const khatma = khatmaResult.Item;
    // Only joinable public active khatmas
    if (khatma && khatma.type === 'public' && khatma.status === 'active') {
      khatmas.push(khatma);
    }
  }

  khatmas.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  const { items: pageItems, pagination } = applyPagination(khatmas, page, limit);

  for (const khatma of pageItems) {
    await enrichKhatmaWithParts(khatma, userId);
  }

  return success({
    partNumber,
    partName: PART_NAMES[partNumber],
    khatmas: pageItems,
    pagination,
  });
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
  const invitations = await loadKhatmaInvitations(khatmaId);
  const participants = await buildParticipantsList(khatma, parts, invitations, {
    ownerUserId: khatma.userId,
  });

  return success({
    ...khatma,
    completedParts: parts.filter(p => p.status === 'completed').length,
    availableParts: parts.filter(p => p.status === 'available').length,
    reservedParts: parts.filter(p => p.status === 'reserved').length,
    parts: parts.map(p => ({
      partNumber: p.partNumber,
      partName: p.partName || PART_NAMES[p.partNumber],
      status: p.status,
      userName: p.userName || null,
      userId: p.userId || null,
    })),
    participants,
  });
}

// ============================================================
// 📌 GET /khatmas/{khatmaId}/participants - قائمة المشاركين
// ============================================================
async function listParticipants(event, userId) {
  const khatmaId = event.pathParameters?.khatmaId
    || event.path.split('/')[2];

  const { khatma, error: ownerError } = await loadKhatmaForOwner(khatmaId, userId);
  if (ownerError) return ownerError;

  const parts = await loadKhatmaParts(khatmaId);
  const invitations = await loadKhatmaInvitations(khatmaId);
  const participants = await buildParticipantsList(khatma, parts, invitations, {
    includeManageFlags: true,
    ownerUserId: khatma.userId,
  });

  return success({
    khatmaId,
    khatmaName: khatma.name,
    participants,
    summary: {
      total: participants.length,
      done: participants.filter((p) => p.progress === 'done').length,
      reading: participants.filter((p) => p.progress === 'reading').length,
      notStarted: participants.filter((p) => p.progress === 'not_started').length,
    },
  });
}

// ============================================================
// 📌 POST /khatmas/{khatmaId}/participants/remind
// Body: { "userId": "..." } OR { "email": "..." }
// ============================================================
async function remindParticipant(event, userId) {
  const khatmaId = event.pathParameters?.khatmaId
    || event.path.split('/')[2];
  const body = JSON.parse(event.body || '{}');
  const targetUserId = body.userId;
  const targetEmail = body.email?.trim().toLowerCase();

  if (!targetUserId && !targetEmail) {
    return error(400, 'VALIDATION_ERROR', 'userId or email is required');
  }

  const { khatma, error: ownerError } = await loadKhatmaForOwner(khatmaId, userId);
  if (ownerError) return ownerError;

  let participantUser = null;
  if (targetUserId) {
    if (targetUserId === khatma.userId) {
      return error(400, 'VALIDATION_ERROR', 'Cannot remind the khatma owner');
    }
    const userResult = await dynamodb.send(new GetCommand({
      TableName: process.env.USERS_TABLE,
      Key: { userId: targetUserId },
    }));
    participantUser = userResult.Item;
    if (!participantUser) {
      return error(404, 'NOT_FOUND', 'Participant not found');
    }
  } else {
    participantUser = await findUserByEmail(targetEmail);
  }

  const parts = await loadKhatmaParts(khatmaId);
  const invitations = await loadKhatmaInvitations(khatmaId);
  const participants = await buildParticipantsList(khatma, parts, invitations, {
    includeManageFlags: true,
    ownerUserId: khatma.userId,
  });

  const participant = participants.find((p) => {
    if (targetUserId) return p.userId === targetUserId;
    return p.email && p.email.toLowerCase() === targetEmail;
  });

  if (!participant) {
    return error(404, 'NOT_FOUND', 'Participant not found in this khatma');
  }

  if (!participant.canRemind) {
    return error(400, 'VALIDATION_ERROR', 'Reminder is only available for not_started or reading participants');
  }

  const message = participant.progress === 'not_started'
    ? `You have been invited to join "${khatma.name}". Open the app to accept and select your parts.`
    : `Your reading portion in "${khatma.name}" is still waiting for you.`;

  let pushQueued = false;
  if (participantUser?.userId) {
    await createInAppNotification(participantUser.userId, khatma, message);
    pushQueued = await queuePushNotification({
      fcmToken: participantUser.fcmToken,
      title: `Reminder: ${khatma.name}`,
      body: message,
      data: { type: 'reminder', khatmaId, actionType: 'open_khatma' },
    });
  }

  return success({
    reminded: true,
    pushQueued,
    participant: {
      userId: participant.userId,
      email: participant.email,
      progress: participant.progress,
    },
    message: participantUser
      ? (pushQueued ? 'Reminder sent' : 'In-app notification saved (no push token)')
      : 'Participant has not joined the app yet — reminder recorded when they sign up',
  });
}

// ============================================================
// 📌 POST /khatmas/{khatmaId}/participants/remove
// Body: { "userId": "..." } OR { "email": "..." }
// ============================================================
async function removeParticipant(event, userId) {
  const khatmaId = event.pathParameters?.khatmaId
    || event.path.split('/')[2];
  const body = JSON.parse(event.body || '{}');
  const targetUserId = body.userId;
  const targetEmail = body.email?.trim().toLowerCase();

  if (!targetUserId && !targetEmail) {
    return error(400, 'VALIDATION_ERROR', 'userId or email is required');
  }

  const { khatma, error: ownerError } = await loadKhatmaForOwner(khatmaId, userId);
  if (ownerError) return ownerError;

  if (targetUserId && targetUserId === khatma.userId) {
    return error(400, 'VALIDATION_ERROR', 'Cannot remove the khatma owner');
  }

  const parts = await loadKhatmaParts(khatmaId);
  const invitations = await loadKhatmaInvitations(khatmaId);
  const participants = await buildParticipantsList(khatma, parts, invitations, {
    includeManageFlags: true,
    ownerUserId: khatma.userId,
  });

  const participant = participants.find((p) => {
    if (targetUserId) return p.userId === targetUserId;
    return p.email && p.email.toLowerCase() === targetEmail;
  });

  if (!participant) {
    return error(404, 'NOT_FOUND', 'Participant not found in this khatma');
  }

  if (!participant.canRemove) {
    return error(400, 'VALIDATION_ERROR', 'Only not_started or reading participants can be removed');
  }

  const now = new Date().toISOString();
  let freedParts = 0;

  if (participant.userId) {
    const userParts = parts.filter((p) => p.userId === participant.userId);
    for (const part of userParts) {
      await dynamodb.send(new UpdateCommand({
        TableName: process.env.KHATMA_PARTS_TABLE,
        Key: { khatmaId, partNumber: part.partNumber },
        UpdateExpression: 'SET #status = :available REMOVE userId, userName, reservedAt, completedAt',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':available': 'available' },
      }));
      freedParts++;
    }

    const updatedParts = await loadKhatmaParts(khatmaId);
    const completedCount = updatedParts.filter((p) => p.status === 'completed').length;
    await dynamodb.send(new UpdateCommand({
      TableName: process.env.KHATMAS_TABLE,
      Key: { khatmaId },
      UpdateExpression: 'SET completedParts = :count, #status = :active, updatedAt = :now',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':count': completedCount,
        ':active': 'active',
        ':now': now,
      },
    }));
  }

  const emailToRemove = (participant.email || targetEmail || '').toLowerCase();
  if (emailToRemove) {
    try {
      await dynamodb.send(new DeleteCommand({
        TableName: process.env.KHATMA_INVITATIONS_TABLE,
        Key: { khatmaId, email: emailToRemove },
      }));
    } catch (err) {
      // invitation may not exist
    }
  }

  return success({
    removed: true,
    freedParts,
    participant: {
      userId: participant.userId,
      email: participant.email,
      progress: participant.progress,
    },
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

// ============================================================
// 📌 POST /khatmas/{khatmaId}/parts/add-extra - إضافة أجزاء إضافية
// ============================================================
// Same as reserve but only allowed after user has completed all
// their current reserved parts in this khatma (no reserved left).
// ============================================================
async function addExtraParts(event, userId) {
  const khatmaId = event.pathParameters?.khatmaId
    || event.path.split('/')[2];

  // Check that user has no parts still reserved (all must be completed first)
  const partsResult = await dynamodb.send(new QueryCommand({
    TableName: process.env.KHATMA_PARTS_TABLE,
    IndexName: 'userId-index',
    KeyConditionExpression: 'userId = :uid',
    FilterExpression: 'khatmaId = :kid AND #status = :reserved',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':uid': userId,
      ':kid': khatmaId,
      ':reserved': 'reserved',
    },
  }));

  const stillReserved = partsResult.Items || [];
  if (stillReserved.length > 0) {
    const partNums = stillReserved.map((p) => p.partNumber).sort((a, b) => a - b);
    return error(
      400,
      'COMPLETE_PARTS_FIRST',
      `Complete your reserved parts before adding extra parts. Reserved: ${partNums.join(', ')}`
    );
  }

  return await reserveParts(event, userId);
}

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
