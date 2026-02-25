// ============================================================
// ⚡ Lambda #7: Invitations
// ============================================================
//
//   POST /khatmas/{khatmaId}/invite        → إرسال دعوات
//   GET  /invitations                      → دعواتي الواردة
//   POST /invitations/{invitationId}/accept → قبول دعوة
//   POST /invitations/{invitationId}/decline→ رفض دعوة
// ============================================================

const { success, error } = require('../../shared/response');
const {
  dynamodb, GetCommand, PutCommand, QueryCommand, UpdateCommand
} = require('../../shared/dynamodb');
const { v4: uuid } = require('uuid');

exports.handler = async (event) => {
  const method = event.httpMethod;
  const path = event.path;
  const userId = event.requestContext?.authorizer?.userId;
  const userEmail = event.requestContext?.authorizer?.email;

  if (!userId) {
    return error(401, 'UNAUTHORIZED', 'Authentication required');
  }

  try {
    // POST /khatmas/{khatmaId}/invite
    if (method === 'POST' && path.endsWith('/invite')) {
      return await sendInvitations(event, userId);
    }

    // GET /invitations
    if (method === 'GET' && path === '/invitations') {
      return await listInvitations(event, userId, userEmail);
    }

    // POST /invitations/{id}/accept
    if (method === 'POST' && path.endsWith('/accept')) {
      return await respondToInvitation(event, userId, userEmail, 'accepted');
    }

    // POST /invitations/{id}/decline
    if (method === 'POST' && path.endsWith('/decline')) {
      return await respondToInvitation(event, userId, userEmail, 'declined');
    }

    return error(404, 'NOT_FOUND', `Route not found: ${method} ${path}`);
  } catch (err) {
    console.error('Unhandled error:', err);
    return error(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
};

// ============================================================
// 📌 POST /khatmas/{khatmaId}/invite
// ============================================================
// Body: { "emails": ["friend1@email.com", "friend2@email.com"] }
// ============================================================
async function sendInvitations(event, userId) {
  const khatmaId = event.pathParameters?.khatmaId
    || event.path.split('/')[2];
  const body = JSON.parse(event.body || '{}');
  const emails = body.emails || [];

  if (!emails.length) {
    return error(400, 'VALIDATION_ERROR', 'emails array is required');
  }

  // التأكد إن الختمة موجودة وأنا صاحبها
  const khatma = await dynamodb.send(new GetCommand({
    TableName: process.env.KHATMAS_TABLE,
    Key: { khatmaId },
  }));

  if (!khatma.Item) {
    return error(404, 'NOT_FOUND', 'Khatma not found');
  }

  if (khatma.Item.userId !== userId) {
    return error(403, 'FORBIDDEN', 'Only the khatma owner can send invitations');
  }

  const now = new Date().toISOString();
  let sentCount = 0;

  for (const email of emails) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) continue;

    try {
      await dynamodb.send(new PutCommand({
        TableName: process.env.KHATMA_INVITATIONS_TABLE,
        Item: {
          khatmaId,
          email: normalizedEmail,
          invitedBy: userId,
          status: 'pending',
          khatmaName: khatma.Item.name,
          intention: khatma.Item.intention,
          sentAt: now,
          respondedAt: '',
        },
        ConditionExpression: 'attribute_not_exists(khatmaId)',
      }));
      sentCount++;
    } catch (err) {
      if (err.name === 'ConditionalCheckFailedException') {
        // invitation already exists - skip
      } else {
        throw err;
      }
    }
  }

  return success({ sent: sentCount });
}

// ============================================================
// 📌 GET /invitations - دعواتي الواردة
// ============================================================
async function listInvitations(event, userId, userEmail) {
  // نجيب الـ email من بيانات المستخدم
  let email = userEmail;
  if (!email) {
    const user = await dynamodb.send(new GetCommand({
      TableName: process.env.USERS_TABLE,
      Key: { userId },
    }));
    email = user.Item?.email;
  }

  if (!email) {
    return success({ invitations: [] });
  }

  const result = await dynamodb.send(new QueryCommand({
    TableName: process.env.KHATMA_INVITATIONS_TABLE,
    IndexName: 'email-status-index',
    KeyConditionExpression: 'email = :email',
    ExpressionAttributeValues: { ':email': email.toLowerCase() },
    ScanIndexForward: false,
  }));

  return success({ invitations: result.Items || [] });
}

// ============================================================
// 📌 POST /invitations/{id}/accept or /decline
// ============================================================
async function respondToInvitation(event, userId, userEmail, responseStatus) {
  const body = JSON.parse(event.body || '{}');
  const khatmaId = body.khatmaId;
  const email = body.email || userEmail;

  if (!khatmaId || !email) {
    return error(400, 'VALIDATION_ERROR', 'khatmaId and email are required');
  }

  const now = new Date().toISOString();

  await dynamodb.send(new UpdateCommand({
    TableName: process.env.KHATMA_INVITATIONS_TABLE,
    Key: { khatmaId, email: email.toLowerCase() },
    UpdateExpression: 'SET #status = :status, respondedAt = :now, invitedUserId = :uid',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':status': responseStatus,
      ':now': now,
      ':uid': userId,
    },
  }));

  if (responseStatus === 'accepted') {
    return success({ khatmaId, message: 'You have joined the Khatma!' });
  }

  return success(null, 200, 'Invitation declined');
}
