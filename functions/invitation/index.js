// ============================================================
// ⚡ Lambda #7: Invitations
// ============================================================
//
//   POST /khatmas/{khatmaId}/invite         → إرسال دعوات (+ إشعار للمسجّلين)
//   GET  /invitations                       → دعواتي الواردة
//   POST /invitations/accept                → قبول دعوة
//   POST /invitations/decline               → رفض دعوة واحدة (أو ختمة واحدة)
//   POST /invitations/decline-all           → رفض كل دعوات مُرسِل معيّن
// ============================================================

const { success, error } = require('../../shared/response');
const {
  dynamodb, GetCommand, PutCommand, QueryCommand, UpdateCommand, ScanCommand,
} = require('../../shared/dynamodb');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { v4: uuid } = require('uuid');

const sqs = new SQSClient({});

// ============================================================
// 📋 Localized invitation message (ar / en / ur / hi)
// ============================================================
const SUPPORTED_LANGS = ['ar', 'en', 'ur', 'hi'];

function buildInviteMessage(lang, intention) {
  const safeIntention = intention || '';
  const templates = {
    ar: {
      title: 'دعوة للمشاركة في ختمة',
      body: `تمت دعوتك للمشاركة في الختمة الخاصة بـ ${safeIntention}`,
    },
    en: {
      title: 'Khatma Invitation',
      body: `You have been invited to join the Khatma for ${safeIntention}`,
    },
    ur: {
      title: 'ختم میں شرکت کی دعوت',
      body: `آپ کو ${safeIntention} کے لیے ختم میں شامل ہونے کی دعوت دی گئی ہے`,
    },
    hi: {
      title: 'ख़त्म में शामिल होने का निमंत्रण',
      body: `आपको ${safeIntention} के लिए ख़त्म में शामिल होने के लिए आमंत्रित किया गया है`,
    },
  };
  return templates[SUPPORTED_LANGS.includes(lang) ? lang : 'ar'];
}

// ============================================================
// 📋 Find an existing user account by email (returns user Item or null)
// ============================================================
async function findUserByEmail(email) {
  const result = await dynamodb.send(new ScanCommand({
    TableName: process.env.USERS_TABLE,
    FilterExpression: 'email = :email',
    ExpressionAttributeValues: { ':email': email.toLowerCase() },
    Limit: 1,
  }));
  return result.Items?.[0] || null;
}

// ============================================================
// 📋 Save an in-app notification for the invited user
// ============================================================
async function createInviteNotification(targetUserId, khatma, invitedBy, msg) {
  await dynamodb.send(new PutCommand({
    TableName: process.env.NOTIFICATIONS_TABLE,
    Item: {
      userId: targetUserId,
      createdAt: new Date().toISOString(),
      type: 'invitation',
      title: msg.title,
      body: msg.body,
      isRead: false,
      actionType: 'invitation',
      actionId: khatma.khatmaId,
      khatmaId: khatma.khatmaId,
      invitedBy,
    },
  }));
}

// ============================================================
// 📋 Queue an FCM push (via InvitationsQueue → invitation-worker)
// ============================================================
async function queueInvitePush(fcmToken, khatma, invitedBy, msg) {
  if (!fcmToken || !process.env.INVITATIONS_QUEUE_URL) return false;

  await sqs.send(new SendMessageCommand({
    QueueUrl: process.env.INVITATIONS_QUEUE_URL,
    MessageBody: JSON.stringify({
      fcmToken,
      title: msg.title,
      body: msg.body,
      data: {
        type: 'invitation',
        khatmaId: khatma.khatmaId,
        invitedBy,
        actionType: 'invitation',
      },
    }),
  }));
  return true;
}

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

    // POST /invitations/decline-all  → رفض كل دعوات مُرسِل معيّن
    if (method === 'POST' && path.endsWith('/decline-all')) {
      return await declineAllFromInviter(event, userId, userEmail);
    }

    // POST /invitations/{id}/accept  |  /invitations/accept
    if (method === 'POST' && path.endsWith('/accept')) {
      return await respondToInvitation(event, userId, userEmail, 'accepted');
    }

    // POST /invitations/{id}/decline  |  /invitations/decline  (رفض دعوة/ختمة واحدة)
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
  let notifiedCount = 0;

  for (const email of emails) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) continue;

    // هل المستخدم عنده حساب على التطبيق؟
    let invitedUser = null;
    try {
      invitedUser = await findUserByEmail(normalizedEmail);
    } catch (lookupErr) {
      console.error('User lookup failed:', lookupErr.message);
    }

    try {
      await dynamodb.send(new PutCommand({
        TableName: process.env.KHATMA_INVITATIONS_TABLE,
        Item: {
          khatmaId,
          email: normalizedEmail,
          invitedBy: userId,
          invitedUserId: invitedUser?.userId || '',
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
        // invitation already exists - skip create, but still (re)notify below
      } else {
        throw err;
      }
    }

    // لو المستخدم مسجّل: ابعتله إشعار داخل التطبيق + Push مترجَم بلغته
    if (invitedUser) {
      const msg = buildInviteMessage(invitedUser.language, khatma.Item.intention);
      try {
        await createInviteNotification(invitedUser.userId, khatma.Item, userId, msg);
        const pushed = await queueInvitePush(invitedUser.fcmToken, khatma.Item, userId, msg);
        if (pushed) notifiedCount++;
      } catch (notifyErr) {
        console.error('Notification failed:', notifyErr.message);
      }
    }
  }

  return success({ sent: sentCount, notified: notifiedCount });
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

  const byKey = new Map();

  // (1) الدعوات المطابقة للإيميل الحالي
  if (email) {
    const byEmail = await dynamodb.send(new QueryCommand({
      TableName: process.env.KHATMA_INVITATIONS_TABLE,
      IndexName: 'email-status-index',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': email.toLowerCase() },
      ScanIndexForward: false,
    }));
    for (const item of byEmail.Items || []) {
      byKey.set(`${item.khatmaId}#${item.email}`, item);
    }
  }

  // (2) دعوات مربوطة بحساب المستخدم (لو الإيميل اختلف بعد إنشاء الحساب)
  const byUser = await dynamodb.send(new ScanCommand({
    TableName: process.env.KHATMA_INVITATIONS_TABLE,
    FilterExpression: 'invitedUserId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
  }));
  for (const item of byUser.Items || []) {
    byKey.set(`${item.khatmaId}#${item.email}`, item);
  }

  const invitations = Array.from(byKey.values())
    .sort((a, b) => (b.sentAt || '').localeCompare(a.sentAt || ''));

  return success({ invitations });
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

// ============================================================
// 📌 POST /invitations/decline-all
// ============================================================
// Body: { "invitedBy": "<inviterUserId>" }
// يرفض كل الدعوات المعلّقة القادمة من مُرسِل واحد للمستخدم الحالي
// ============================================================
async function declineAllFromInviter(event, userId, userEmail) {
  const body = JSON.parse(event.body || '{}');
  const invitedBy = body.invitedBy;

  if (!invitedBy) {
    return error(400, 'VALIDATION_ERROR', 'invitedBy is required');
  }

  // نجيب الإيميل الحالي للمستخدم
  let email = userEmail;
  if (!email) {
    const user = await dynamodb.send(new GetCommand({
      TableName: process.env.USERS_TABLE,
      Key: { userId },
    }));
    email = user.Item?.email;
  }

  // كل الدعوات المعلّقة الخاصة بيّا من نفس المُرسِل (بالإيميل أو بحساب المستخدم)
  const scan = await dynamodb.send(new ScanCommand({
    TableName: process.env.KHATMA_INVITATIONS_TABLE,
    FilterExpression: 'invitedBy = :inviter AND #status = :pending AND (email = :email OR invitedUserId = :uid)',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':inviter': invitedBy,
      ':pending': 'pending',
      ':email': (email || '').toLowerCase(),
      ':uid': userId,
    },
  }));

  const now = new Date().toISOString();
  let declined = 0;

  for (const item of scan.Items || []) {
    await dynamodb.send(new UpdateCommand({
      TableName: process.env.KHATMA_INVITATIONS_TABLE,
      Key: { khatmaId: item.khatmaId, email: item.email },
      UpdateExpression: 'SET #status = :declined, respondedAt = :now, invitedUserId = :uid',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':declined': 'declined',
        ':now': now,
        ':uid': userId,
      },
    }));
    declined++;
  }

  return success({ declined, invitedBy });
}
