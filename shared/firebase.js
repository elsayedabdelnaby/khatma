const admin = require('firebase-admin');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');

const ssmClient = new SSMClient({});
let firebaseInitialized = false;

async function initFirebase() {
  if (firebaseInitialized) return;

  const paramName = process.env.FIREBASE_SSM_PARAM || '/khatma/firebase-service-account';

  // ── Load from SSM ──────────────────────────────────────────
  const result = await ssmClient.send(new GetParameterCommand({
    Name: paramName,
    WithDecryption: true,
  }));

  const serviceAccount = JSON.parse(result.Parameter.Value);

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  firebaseInitialized = true;
  console.log('Firebase initialized successfully');
}

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