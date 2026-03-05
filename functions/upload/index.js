// ============================================================
// ⚡ Lambda: Presigned URL Generator
// ============================================================
// GET /admin/upload-url?type=banner&filename=ramadan.jpg
//
// بيرجع URL مؤقت (5 دقائق) للرفع المباشر على S3
// الأدمن بيرفع الصورة مباشرة من المتصفح لـ S3 (بدون ما تمر على Lambda)
// ============================================================

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { success, error } = require('../../shared/response');
const { dynamodb, GetCommand } = require('../../shared/dynamodb');
const { v4: uuid } = require('uuid');

const s3Client = new S3Client({});

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

async function verifyAdmin(userId) {
  const user = await dynamodb.send(new GetCommand({
    TableName: process.env.USERS_TABLE,
    Key: { userId },
  }));
  return user.Item?.role === 'admin';
}

exports.handler = async (event) => {
  const userId = event.requestContext?.authorizer?.userId;
  if (!userId) {
    return error(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const isAdmin = await verifyAdmin(userId);
  if (!isAdmin) {
    return error(403, 'FORBIDDEN', 'Admin access required');
  }

  const queryParams = event.queryStringParameters || {};
  const filename = queryParams.filename || `image_${uuid()}.jpg`;
  const contentType = queryParams.contentType || 'image/jpeg';

  if (!ALLOWED_TYPES.includes(contentType)) {
    return error(400, 'INVALID_TYPE', 'Only JPEG, PNG, WebP, and GIF images are allowed');
  }

  const key = `banners/${uuid()}_${filename}`;

  const command = new PutObjectCommand({
    Bucket: process.env.BANNER_IMAGES_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

  const imageUrl = `https://${process.env.BANNER_IMAGES_BUCKET}.s3.amazonaws.com/${key}`;

  return success({
    uploadUrl,
    imageUrl,
    key,
    expiresIn: 300,
  });
};
