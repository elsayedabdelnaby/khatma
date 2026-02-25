// ============================================================
// ⚡ Lambda #6: App Config
// ============================================================
//
//   GET /config → بيانات التطبيق (أنواع الختمات + بانرات)
//
// 📋 ليه Lambda لوحدها؟
//   - بتتنادي مرة عند فتح الأبليكيشن
//   - بترجع كل الإعدادات الثابتة (أنواع ختمات + بانرات)
//   - ممكن نضيف caching بعدين عشان تكون أسرع
// ============================================================

const { success, error } = require('../../shared/response');
const { dynamodb } = require('../../shared/dynamodb');
const { ScanCommand } = require('@aws-sdk/lib-dynamodb');

exports.handler = async (event) => {
  const method = event.httpMethod;
  const path = event.path;

  try {
    if (method === 'GET' && path === '/config') {
      return await getConfig(event);
    }

    return error(404, 'NOT_FOUND', `Route not found: ${method} ${path}`);
  } catch (err) {
    console.error('Unhandled error:', err);
    return error(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
};

async function getConfig(event) {
  // جلب أنواع الختمات النشطة
  const typesResult = await dynamodb.send(new ScanCommand({
    TableName: process.env.KHATMA_TYPES_TABLE,
    FilterExpression: 'isActive = :active',
    ExpressionAttributeValues: { ':active': true },
  }));

  const khatmaTypes = (typesResult.Items || [])
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  // جلب البانرات النشطة
  const bannersResult = await dynamodb.send(new ScanCommand({
    TableName: process.env.BANNERS_TABLE,
    FilterExpression: 'isActive = :active',
    ExpressionAttributeValues: { ':active': true },
  }));

  const banners = (bannersResult.Items || [])
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  return success({ khatmaTypes, banners });
}
