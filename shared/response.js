// ============================================================
// 📋 ايه هو الملف ده؟
// ============================================================
// Helper functions عشان نرجع responses موحدة من كل Lambda
// بدل ما نكتب نفس الكود كل مرة
//
// 📖 مثال:
//   return success({ user: { name: "Ahmed" } });
//   return error(404, "NOT_FOUND", "User not found");
// ============================================================

/**
 * ✅ Success Response
 * بيرجع response ناجح للموبايل
 *
 * @param {object} data - البيانات اللي عايز ترجعها
 * @param {number} statusCode - كود الحالة (default: 200)
 * @param {string} message - رسالة اختيارية
 *
 * مثال:
 *   return success({ user: { name: "Ahmed" } });
 *   // يرجع: { success: true, data: { user: { name: "Ahmed" } } }
 */
const success = (data, statusCode = 200, message = null) => {
  const body = {
    success: true,
  };

  if (message) body.message = message;
  if (data) body.data = data;

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',           // يسمح لأي domain يكلمنا
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,Accept-Language',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: JSON.stringify(body),
  };
};

/**
 * ❌ Error Response
 * بيرجع response بخطأ للموبايل
 *
 * @param {number} statusCode - كود الخطأ (400, 401, 403, 404, 409, 500)
 * @param {string} code - كود الخطأ (مثل: NOT_FOUND, UNAUTHORIZED)
 * @param {string} message - رسالة الخطأ
 *
 * مثال:
 *   return error(404, "NOT_FOUND", "Khatma not found");
 *   // يرجع: { success: false, error: { code: "NOT_FOUND", message: "Khatma not found" } }
 */
const error = (statusCode, code, message) => {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,Accept-Language',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: JSON.stringify({
      success: false,
      error: {
        code,
        message,
      },
    }),
  };
};

// ============================================================
// 📦 Export - عشان نقدر نستخدمهم في Lambdas تانية
// ============================================================
module.exports = { success, error };

