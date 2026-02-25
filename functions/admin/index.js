// ============================================================
// ⚡ Lambda #8: Admin Panel
// ============================================================
//
// 📋 كل الـ APIs دي محمية - بس الـ Admin يقدر يستخدمها
// بنتأكد من الـ role في أول كل request
//
// Banners:
//   GET    /admin/banners          → كل البانرات
//   POST   /admin/banners          → إنشاء بانر
//   PUT    /admin/banners/{id}     → تعديل بانر
//   DELETE /admin/banners/{id}     → حذف بانر
//
// Khatma Types:
//   GET    /admin/khatma-types     → كل أنواع الختمات
//   POST   /admin/khatma-types     → إنشاء نوع
//   PUT    /admin/khatma-types/{id}→ تعديل نوع
//   DELETE /admin/khatma-types/{id}→ حذف نوع
//
// Notification Types:
//   GET    /admin/notification-types     → كل أنواع الإشعارات
//   POST   /admin/notification-types     → إنشاء نوع
//   PUT    /admin/notification-types/{id}→ تعديل نوع
// ============================================================

const { success, error } = require('../../shared/response');
const {
  dynamodb, GetCommand, PutCommand, UpdateCommand, DeleteCommand
} = require('../../shared/dynamodb');
const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuid } = require('uuid');

// ============================================================
// 📋 Admin Check Middleware
// بيتأكد إن المستخدم admin قبل ما يكمل
// ============================================================
async function verifyAdmin(userId) {
  const user = await dynamodb.send(new GetCommand({
    TableName: process.env.USERS_TABLE,
    Key: { userId },
  }));
  return user.Item?.role === 'admin';
}

exports.handler = async (event) => {
  const method = event.httpMethod;
  const path = event.path;
  const userId = event.requestContext?.authorizer?.userId;

  if (!userId) {
    return error(401, 'UNAUTHORIZED', 'Authentication required');
  }

  // ============================================================
  // 🔐 Admin Check - لازم يكون admin
  // ============================================================
  const isAdmin = await verifyAdmin(userId);
  if (!isAdmin) {
    return error(403, 'FORBIDDEN', 'Admin access required');
  }

  try {
    // ==================== BANNERS ====================
    if (path === '/admin/banners' && method === 'GET') return await listBanners();
    if (path === '/admin/banners' && method === 'POST') return await createBanner(event);
    if (path.startsWith('/admin/banners/') && method === 'PUT') return await updateBanner(event);
    if (path.startsWith('/admin/banners/') && method === 'DELETE') return await deleteBanner(event);

    // ==================== KHATMA TYPES ====================
    if (path === '/admin/khatma-types' && method === 'GET') return await listKhatmaTypes();
    if (path === '/admin/khatma-types' && method === 'POST') return await createKhatmaType(event);
    if (path.startsWith('/admin/khatma-types/') && method === 'PUT') return await updateKhatmaType(event);
    if (path.startsWith('/admin/khatma-types/') && method === 'DELETE') return await deleteKhatmaType(event);

    // ==================== NOTIFICATION TYPES ====================
    if (path === '/admin/notification-types' && method === 'GET') return await listNotifTypes();
    if (path === '/admin/notification-types' && method === 'POST') return await createNotifType(event);
    if (path.startsWith('/admin/notification-types/') && method === 'PUT') return await updateNotifType(event);

    return error(404, 'NOT_FOUND', `Route not found: ${method} ${path}`);
  } catch (err) {
    console.error('Unhandled error:', err);
    return error(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
};

// ============================================================
// 🖼️ BANNERS CRUD
// ============================================================

async function listBanners() {
  const result = await dynamodb.send(new ScanCommand({
    TableName: process.env.BANNERS_TABLE,
  }));
  const banners = (result.Items || []).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  return success({ banners });
}

async function createBanner(event) {
  const body = JSON.parse(event.body || '{}');
  const now = new Date().toISOString();

  const banner = {
    bannerId: `banner_${uuid()}`,
    title_ar: body.title_ar || '',
    title_en: body.title_en || '',
    title_ur: body.title_ur || '',
    title_hi: body.title_hi || '',
    imageUrl: body.imageUrl || '',
    linkUrl: body.linkUrl || '',
    isActive: body.isActive !== undefined ? body.isActive : true,
    sortOrder: body.sortOrder || 0,
    startDate: body.startDate || '',
    endDate: body.endDate || '',
    createdAt: now,
  };

  await dynamodb.send(new PutCommand({
    TableName: process.env.BANNERS_TABLE,
    Item: banner,
  }));

  return success(banner, 201);
}

async function updateBanner(event) {
  const bannerId = event.path.split('/').pop();
  const body = JSON.parse(event.body || '{}');

  const allowedFields = [
    'title_ar', 'title_en', 'title_ur', 'title_hi',
    'imageUrl', 'linkUrl', 'isActive', 'sortOrder', 'startDate', 'endDate'
  ];

  return await updateItem(process.env.BANNERS_TABLE, { bannerId }, body, allowedFields);
}

async function deleteBanner(event) {
  const bannerId = event.path.split('/').pop();
  await dynamodb.send(new DeleteCommand({
    TableName: process.env.BANNERS_TABLE,
    Key: { bannerId },
  }));
  return success(null, 200, 'Banner deleted');
}

// ============================================================
// 📋 KHATMA TYPES CRUD
// ============================================================

async function listKhatmaTypes() {
  const result = await dynamodb.send(new ScanCommand({
    TableName: process.env.KHATMA_TYPES_TABLE,
  }));
  const types = (result.Items || []).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  return success({ khatmaTypes: types });
}

async function createKhatmaType(event) {
  const body = JSON.parse(event.body || '{}');
  const now = new Date().toISOString();

  const khatmaType = {
    typeId: `type_${uuid()}`,
    name_ar: body.name_ar || '',
    name_en: body.name_en || '',
    name_ur: body.name_ur || '',
    name_hi: body.name_hi || '',
    description_ar: body.description_ar || '',
    description_en: body.description_en || '',
    icon: body.icon || '',
    isActive: body.isActive !== undefined ? body.isActive : true,
    sortOrder: body.sortOrder || 0,
    createdAt: now,
  };

  await dynamodb.send(new PutCommand({
    TableName: process.env.KHATMA_TYPES_TABLE,
    Item: khatmaType,
  }));

  return success(khatmaType, 201);
}

async function updateKhatmaType(event) {
  const typeId = event.path.split('/').pop();
  const body = JSON.parse(event.body || '{}');

  const allowedFields = [
    'name_ar', 'name_en', 'name_ur', 'name_hi',
    'description_ar', 'description_en', 'icon', 'isActive', 'sortOrder'
  ];

  return await updateItem(process.env.KHATMA_TYPES_TABLE, { typeId }, body, allowedFields);
}

async function deleteKhatmaType(event) {
  const typeId = event.path.split('/').pop();
  await dynamodb.send(new DeleteCommand({
    TableName: process.env.KHATMA_TYPES_TABLE,
    Key: { typeId },
  }));
  return success(null, 200, 'Khatma type deleted');
}

// ============================================================
// 🔔 NOTIFICATION TYPES CRUD
// ============================================================

async function listNotifTypes() {
  const result = await dynamodb.send(new ScanCommand({
    TableName: process.env.NOTIFICATION_TYPES_TABLE,
  }));
  return success({ notificationTypes: result.Items || [] });
}

async function createNotifType(event) {
  const body = JSON.parse(event.body || '{}');
  const now = new Date().toISOString();

  const notifType = {
    typeId: `notif_${uuid()}`,
    type: body.type || '',           // motivational, progress, completion, welcome
    subType: body.subType || '',     // farah, ramadan, shifa
    template_ar: body.template_ar || '',
    template_en: body.template_en || '',
    template_ur: body.template_ur || '',
    template_hi: body.template_hi || '',
    isActive: body.isActive !== undefined ? body.isActive : true,
    createdAt: now,
  };

  await dynamodb.send(new PutCommand({
    TableName: process.env.NOTIFICATION_TYPES_TABLE,
    Item: notifType,
  }));

  return success(notifType, 201);
}

async function updateNotifType(event) {
  const typeId = event.path.split('/').pop();
  const body = JSON.parse(event.body || '{}');

  const allowedFields = [
    'type', 'subType', 'template_ar', 'template_en',
    'template_ur', 'template_hi', 'isActive'
  ];

  return await updateItem(process.env.NOTIFICATION_TYPES_TABLE, { typeId }, body, allowedFields);
}

// ============================================================
// 🔧 Helper: Generic Update Item
// ============================================================
async function updateItem(tableName, key, body, allowedFields) {
  const updates = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return error(400, 'VALIDATION_ERROR', 'No valid fields to update');
  }

  const updateExpression = [];
  const expressionValues = {};
  const expressionNames = {};

  for (const [k, v] of Object.entries(updates)) {
    updateExpression.push(`#${k} = :${k}`);
    expressionValues[`:${k}`] = v;
    expressionNames[`#${k}`] = k;
  }

  updateExpression.push('#updatedAt = :updatedAt');
  expressionValues[':updatedAt'] = new Date().toISOString();
  expressionNames['#updatedAt'] = 'updatedAt';

  const result = await dynamodb.send(new UpdateCommand({
    TableName: tableName,
    Key: key,
    UpdateExpression: `SET ${updateExpression.join(', ')}`,
    ExpressionAttributeValues: expressionValues,
    ExpressionAttributeNames: expressionNames,
    ReturnValues: 'ALL_NEW',
  }));

  return success(result.Attributes);
}
