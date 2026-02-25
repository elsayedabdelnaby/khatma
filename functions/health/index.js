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
  // ============================================================
  // 📋 شرح الكود:
  // 1. بنجهز object فيه معلومات عن حالة النظام
  // 2. بنرجعه كـ success response
  // ============================================================

  const healthData = {
    status: 'OK',                              // النظام شغال
    timestamp: new Date().toISOString(),        // الوقت الحالي
    environment: process.env.ENVIRONMENT || 'unknown', // البيئة (dev/prod)
    version: '1.0.0',                          // نسخة الكود
    service: 'khatma-backend',                 // اسم الخدمة
  };

  // success() هي الدالة اللي عملناها في shared/response.js
  // بتحول الـ object لـ JSON وتضيف الـ headers المطلوبة
  return success(healthData);
};

