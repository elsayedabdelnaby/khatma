// ============================================================
// 📋 ايه هو الملف ده؟
// ============================================================
// بيعمل اتصال مع Firebase عشان:
// 1. التحقق من الـ Token (هل المستخدم مسجل دخول فعلاً؟)
// 2. إرسال Push Notifications عبر FCM (هنستخدمها بعدين)
//
// 📖 إزاي بيشتغل؟
//   - بيقرأ الـ Firebase Key من SSM Parameter Store (خزنة آمنة على AWS)
//   - بيستخدمها عشان يتكلم مع Firebase كـ Admin
// ============================================================

const admin = require('firebase-admin');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');

const ssmClient = new SSMClient({});

// نحفظ الـ key بعد أول قراءة (عشان منقراش SSM كل request)
let firebaseInitialized = false;

// ============================================================
// 📋 شرح: initFirebase
//
// بتقرأ الـ Firebase Key من SSM وتعمل initialize
// بتتنادي مرة واحدة بس (أول request)
// بعدها Firebase يفضل شغال طول ما الـ Lambda شغالة
// ============================================================
async function initFirebase() {
  if (firebaseInitialized) return;

  try {
    const paramName = process.env.FIREBASE_SSM_PARAM || '/khatma/firebase-service-account';

    const result = await ssmClient.send(new GetParameterCommand({
      Name: paramName,
      WithDecryption: true,  // الـ key مشفرة في SSM - فكها
    }));

    const serviceAccount = JSON.parse(result.Parameter.Value);

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }

    firebaseInitialized = true;
  } catch (err) {
    console.error('Failed to initialize Firebase:', err.message);
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    firebaseInitialized = true;
  }
}

// ============================================================
// 📋 شرح: verifyToken
//
// بياخد الـ Firebase Token (JWT) اللي الموبايل بعته
// وبيتحقق منه مع Firebase
// ============================================================
async function verifyToken(idToken) {
  await initFirebase();

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (err) {
    console.error('Token verification failed:', err.message);
    return null;
  }
}

module.exports = { admin, verifyToken, initFirebase };
