// ============================================================
// ⚡ Lambda #4: Home Page
// ============================================================
//
// 📋 الـ Lambda دي بتتعامل مع:
//   GET  /home              → بيانات الصفحة الرئيسية
//   POST /home/mark-all-done → تعليم كل الأجزاء كـ done
// ============================================================

const { success, error } = require('../../shared/response');
const {
  dynamodb, QueryCommand, UpdateCommand, GetCommand
} = require('../../shared/dynamodb');

exports.handler = async (event) => {
  const method = event.httpMethod;
  const path = event.path;
  const userId = event.requestContext?.authorizer?.userId;

  if (!userId) {
    return error(401, 'UNAUTHORIZED', 'Authentication required');
  }

  try {
    if (method === 'GET' && path === '/home') {
      return await getHome(event, userId);
    }

    if (method === 'POST' && path === '/home/mark-all-done') {
      return await markAllDone(event, userId);
    }

    return error(404, 'NOT_FOUND', `Route not found: ${method} ${path}`);
  } catch (err) {
    console.error('Unhandled error:', err);
    return error(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
};

// ============================================================
// 📌 GET /home - بيانات الصفحة الرئيسية
// ============================================================
// بيرجع:
//   1. البانرات النشطة
//   2. ملخص أجزائي (في كل الختمات)
// ============================================================
async function getHome(event, userId) {
  // ============================================================
  // 1. جلب البانرات النشطة
  // ============================================================
  const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
  const bannersData = await dynamodb.send(new ScanCommand({
    TableName: process.env.BANNERS_TABLE,
    FilterExpression: 'isActive = :active',
    ExpressionAttributeValues: { ':active': true },
  }));

  const banners = (bannersData.Items || [])
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  // ============================================================
  // 2. جلب أجزائي في كل الختمات
  // ============================================================
  const myPartsResult = await dynamodb.send(new QueryCommand({
    TableName: process.env.KHATMA_PARTS_TABLE,
    IndexName: 'userId-index',
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
  }));

  const myParts = myPartsResult.Items || [];

  // تجميع الأجزاء حسب رقم الجزء
  const chapterSummary = {};
  for (const part of myParts) {
    const num = part.partNumber;
    if (!chapterSummary[num]) {
      chapterSummary[num] = {
        partNumber: num,
        partName: part.partName || `الجزء ${num}`,
        sharedInCount: 0,
        khatmaIds: [],
        status: 'completed',
      };
    }
    chapterSummary[num].sharedInCount++;
    chapterSummary[num].khatmaIds.push(part.khatmaId);
    // لو أي جزء لسه reserved → الحالة reading
    if (part.status === 'reserved') {
      chapterSummary[num].status = 'reading';
    }
  }

  const chapters = Object.values(chapterSummary)
    .sort((a, b) => a.partNumber - b.partNumber);

  return success({
    banners,
    mySummary: {
      chapters,
      totalReading: chapters.filter(c => c.status === 'reading').length,
      totalCompleted: chapters.filter(c => c.status === 'completed').length,
    },
  });
}

// ============================================================
// 📌 POST /home/mark-all-done - تعليم كل أجزائي كـ done
// ============================================================
async function markAllDone(event, userId) {
  const myPartsResult = await dynamodb.send(new QueryCommand({
    TableName: process.env.KHATMA_PARTS_TABLE,
    IndexName: 'userId-index',
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
  }));

  const myParts = (myPartsResult.Items || [])
    .filter(p => p.status === 'reserved');

  const now = new Date().toISOString();
  let markedCount = 0;

  for (const part of myParts) {
    try {
      await dynamodb.send(new UpdateCommand({
        TableName: process.env.KHATMA_PARTS_TABLE,
        Key: { khatmaId: part.khatmaId, partNumber: part.partNumber },
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
      markedCount++;
    } catch (err) {
      if (err.name !== 'ConditionalCheckFailedException') throw err;
    }
  }

  // تحديث الختمات المتأثرة — conditional update so we never decrease completedParts
  const affectedKhatmas = [...new Set(myParts.map(p => p.khatmaId))];
  for (const khatmaId of affectedKhatmas) {
    const partsResult = await dynamodb.send(new QueryCommand({
      TableName: process.env.KHATMA_PARTS_TABLE,
      KeyConditionExpression: 'khatmaId = :kid',
      ExpressionAttributeValues: { ':kid': khatmaId },
    }));

    const completedCount = (partsResult.Items || [])
      .filter(p => p.status === 'completed').length;

    const updateData = {
      ':count': completedCount,
      ':now': now,
    };
    let updateExpr = 'SET completedParts = :count, updatedAt = :now';

    if (completedCount >= 30) {
      updateExpr += ', #status = :completed';
      updateData[':completed'] = 'completed';
    }

    try {
      await dynamodb.send(new UpdateCommand({
        TableName: process.env.KHATMAS_TABLE,
        Key: { khatmaId },
        UpdateExpression: updateExpr,
        ConditionExpression: 'completedParts < :count OR attribute_not_exists(completedParts)',
        ExpressionAttributeValues: updateData,
        ExpressionAttributeNames: { '#status': 'status' },
      }));
    } catch (err) {
      if (err.name !== 'ConditionalCheckFailedException') throw err;
    }
  }

  return success({ markedCount }, 200, 'All chapters marked as done');
}
