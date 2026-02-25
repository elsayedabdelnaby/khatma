// ============================================================
// ⚡ Lambda: Firebase Token Authorizer
// ============================================================
//
// 📋 ايه هي الـ Lambda دي؟
//   ده "حارس الباب" - بيشتغل تلقائياً قبل أي request
//   بيتحقق إن المستخدم مسجل دخول فعلاً عبر Firebase
//
// 📋 إزاي بيشتغل؟
//   1. الموبايل بيبعت request ومعاه Token في الـ Header:
//      Authorization: Bearer eyJhbGciOiJSUz...
//
//   2. API Gateway بيشغل الـ Authorizer الأول (قبل الـ Lambda الأساسية)
//
//   3. الـ Authorizer بيتحقق من الـ Token مع Firebase:
//      - لو صحيح ✅ → يسمح بالـ request ويمرر الـ userId
//      - لو غلط ❌ → يرجع 401 Unauthorized
//
//   4. الـ Lambda الأساسية (مثلاً UserFunction) بتستقبل الـ userId
//      من event.requestContext.authorizer.userId
//
// 📋 ليه مش بنتحقق في كل Lambda لوحدها؟
//   - عشان منكررش نفس الكود 8 مرات
//   - API Gateway بيعمل caching للنتيجة (أسرع)
//   - لو عايز تغير طريقة الـ Auth تغيرها في مكان واحد
// ============================================================

const { verifyToken } = require('../../shared/firebase');

exports.handler = async (event) => {
  // ============================================================
  // 📋 شرح: استخراج الـ Token
  //
  // الـ Token بييجي في الـ Header كده:
  // Authorization: Bearer eyJhbGciOiJSUz...
  //
  // فبنشيل كلمة "Bearer " وبناخد الـ Token نفسه
  // ============================================================
  const token = event.authorizationToken?.replace('Bearer ', '');

  if (!token) {
    console.error('No token provided');
    throw new Error('Unauthorized');
  }

  try {
    // ============================================================
    // 📋 شرح: التحقق من الـ Token
    //
    // verifyToken بتروح لـ Firebase وبتسأل:
    // "الـ Token ده حقيقي ولا مزور؟"
    //
    // لو حقيقي → بترجع بيانات المستخدم:
    //   { uid: "abc123", email: "user@email.com", ... }
    //
    // لو مزور أو expired → بترجع null
    // ============================================================
    const decodedToken = await verifyToken(token);

    if (!decodedToken) {
      console.error('Token verification returned null');
      throw new Error('Unauthorized');
    }

    // ============================================================
    // 📋 شرح: إنشاء Policy
    //
    // API Gateway محتاج "تصريح" (Policy) عشان يسمح بالـ request
    // بنقوله:
    //   - مين ده؟ (principalId = userId)
    //   - مسموحله يعمل ايه؟ (Allow = كل الـ APIs)
    //   - بيانات إضافية (context = userId, email)
    //
    // الـ context بتتمرر للـ Lambda الأساسية في:
    //   event.requestContext.authorizer.userId
    //   event.requestContext.authorizer.email
    // ============================================================
    return {
      principalId: decodedToken.uid,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [{
          Action: 'execute-api:Invoke',
          Effect: 'Allow',
          Resource: event.methodArn.split('/').slice(0, 2).join('/') + '/*',
        }],
      },
      context: {
        userId: decodedToken.uid,
        email: decodedToken.email || '',
        displayName: decodedToken.name || '',
        photoUrl: decodedToken.picture || '',
        authProvider: decodedToken.firebase?.sign_in_provider || '',
      },
    };
  } catch (err) {
    console.error('Authorization failed:', err.message);
    throw new Error('Unauthorized');
  }
};
