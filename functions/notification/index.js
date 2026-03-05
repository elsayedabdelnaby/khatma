// ============================================================
// ⚡ Lambda #5: Notifications
// ============================================================
//
//   GET  /notifications              → قائمة إشعاراتي
//   POST /notifications/{id}/read    → تعليم إشعار كمقروء
//   POST /notifications/read-all     → تعليم الكل كمقروء
//   PUT  /settings/reminder          → إعداد التذكير اليومي
// ============================================================

const { success, error } = require('../../shared/response');
const {
  dynamodb, QueryCommand, UpdateCommand, PutCommand, GetCommand
} = require('../../shared/dynamodb');

exports.handler = async (event) => {
  const method = event.httpMethod;
  const path = event.path;
  const userId = event.requestContext?.authorizer?.userId;

  if (!userId) {
    return error(401, 'UNAUTHORIZED', 'Authentication required');
  }

  try {
    if (method === 'GET' && path === '/notifications') {
      return await listNotifications(event, userId);
    }

    if (method === 'POST' && path === '/notifications/read-all') {
      return await markAllRead(event, userId);
    }

    if (method === 'POST' && path.match(/^\/notifications\/[^/]+\/read$/)) {
      return await markRead(event, userId);
    }

    if (method === 'PUT' && path === '/settings/reminder') {
      return await updateReminder(event, userId);
    }

    if (method === 'GET' && path === '/settings/reminder') {
      return await getReminder(event, userId);
    }

    return error(404, 'NOT_FOUND', `Route not found: ${method} ${path}`);
  } catch (err) {
    console.error('Unhandled error:', err);
    return error(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
};

// ============================================================
// 📌 GET /notifications
// ============================================================
async function listNotifications(event, userId) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: process.env.NOTIFICATIONS_TABLE,
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
    ScanIndexForward: false, // الأحدث الأول
    Limit: 50,
  }));

  const notifications = result.Items || [];
  const unreadCount = notifications.filter(n => !n.isRead).length;

  return success({ notifications, unreadCount });
}

// ============================================================
// 📌 POST /notifications/{notificationId}/read
// ============================================================
async function markRead(event, userId) {
  const parts = event.path.split('/');
  const createdAt = decodeURIComponent(event.pathParameters?.notificationId || parts[2]);

  await dynamodb.send(new UpdateCommand({
    TableName: process.env.NOTIFICATIONS_TABLE,
    Key: { userId, createdAt },
    UpdateExpression: 'SET isRead = :true',
    ExpressionAttributeValues: { ':true': true },
  }));

  return success(null, 200, 'Notification marked as read');
}

// ============================================================
// 📌 POST /notifications/read-all
// ============================================================
async function markAllRead(event, userId) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: process.env.NOTIFICATIONS_TABLE,
    KeyConditionExpression: 'userId = :uid',
    FilterExpression: 'isRead = :false',
    ExpressionAttributeValues: { ':uid': userId, ':false': false },
  }));

  const unread = result.Items || [];
  let markedCount = 0;

  for (const notif of unread) {
    await dynamodb.send(new UpdateCommand({
      TableName: process.env.NOTIFICATIONS_TABLE,
      Key: { userId, createdAt: notif.createdAt },
      UpdateExpression: 'SET isRead = :true',
      ExpressionAttributeValues: { ':true': true },
    }));
    markedCount++;
  }

  return success({ markedCount });
}

// ============================================================
// 📌 PUT /settings/reminder - إعداد التذكير اليومي
// ============================================================
async function updateReminder(event, userId) {
  const body = JSON.parse(event.body || '{}');

  const reminderData = {
    userId,
    reminderTime: body.reminderTime || '08:00',
    timezone: body.timezone || 'Asia/Riyadh',
    isEnabled: body.isEnabled !== undefined ? body.isEnabled : true,
    updatedAt: new Date().toISOString(),
  };

  await dynamodb.send(new PutCommand({
    TableName: process.env.USER_REMINDERS_TABLE,
    Item: reminderData,
  }));

  return success(reminderData);
}

// ============================================================
// 📌 GET /settings/reminder
// ============================================================
async function getReminder(event, userId) {
  const result = await dynamodb.send(new GetCommand({
    TableName: process.env.USER_REMINDERS_TABLE,
    Key: { userId },
  }));

  return success(result.Item || {
    userId,
    reminderTime: '08:00',
    timezone: 'Asia/Riyadh',
    isEnabled: false,
  });
}
