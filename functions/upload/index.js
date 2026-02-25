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
const { v4: uuid } = require('uuid');

const s3Client = new S3Client({});

exports.handler = async (event) => {
  const queryParams = event.queryStringParameters || {};
  const filename = queryParams.filename || `image_${uuid()}.jpg`;
  const contentType = queryParams.contentType || 'image/jpeg';

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
