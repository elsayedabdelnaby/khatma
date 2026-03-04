// ============================================================
// ⚡ Lambda #1: Health Check
// ============================================================
//
// 📋 ايه هي الـ Lambda Function؟
//   - كود بيشتغل على AWS بدون سيرفر
//   - بتشتغل لما حد يبعت request (مثلاً من الموبايل)
//   - بتاخد الـ request → تعمل حاجة → ترجع response
//
// 📋 ايه هو الـ Handler؟
//   - الـ handler هي الدالة اللي AWS بتشغلها
//   - بتاخد parameter اسمه "event" فيه كل بيانات الـ request
//   - بترجع object فيه الـ response
//
// 📋 ايه هو الـ event؟
//   {
//     httpMethod: "GET",              // نوع الطلب
//     path: "/health",               // المسار
//     headers: { ... },              // الـ headers
//     body: "..." ,                  // البيانات المرسلة (لو POST)
//     queryStringParameters: { ... } // الـ query parameters
//   }
//
// 📋 الـ Lambda دي بتعمل ايه؟
//   - بس بترجع "OK" - عشان نتأكد إن الـ API شغال
//   - زي لما تسأل حد "أنت كويس؟" ويقولك "أيوه كويس"
//
// 📋 إزاي بتتجرب؟
//   - في المتصفح: افتح الـ URL اللي هيطلع بعد الـ deploy
//   - أو: sam local invoke HealthCheckFunction
// ============================================================

const { success } = require('../../shared/response');

/**
 * Health Check Handler
 *
 * GET /health
 * → Returns: { success: true, data: { status: "OK", ... } }
 */
exports.handler = async (event) => {
  const path = (event.path || event.rawPath || '').replace(/^\/Prod/, '') || '/';

  // Root path: short welcome (avoids "Missing Authentication Token" when visiting base URL)
  if (path === '/' || path === '') {
    return success({
      message: 'Khatma API',
      health: '/Prod/health',
      docs: 'Use /Prod/health for health check. Admin and app endpoints require Firebase auth.',
    });
  }

  // /health: full health check
  const healthData = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.ENVIRONMENT || 'unknown',
    version: '1.0.0',
    service: 'khatma-backend',
  };
  return success(healthData);
};

