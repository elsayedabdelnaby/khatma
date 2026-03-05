// ============================================================
// ⚡ Lambda: Notification Worker (SQS Consumer)
// ============================================================
// Triggered by NotificationsQueue. Sends Firebase FCM push
// notifications. Uses ReportBatchItemFailures so only failed
// messages are retried (and eventually go to DLQ after 3 attempts).
// ============================================================

const { admin, initFirebase } = require('../../shared/firebase');

exports.handler = async (event) => {
  await initFirebase();

  const batchItemFailures = [];

  for (const record of event.Records || []) {
    try {
      const msg = JSON.parse(record.body);
      const { fcmToken, title, body, data } = msg;

      if (!fcmToken) {
        console.warn('Missing fcmToken, skipping message:', record.messageId);
        continue;
      }

      await admin.messaging().send({
        token: fcmToken,
        notification: {
          title: title || 'Khatma',
          body: body || '',
        },
        data: data && typeof data === 'object' ? Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)])
        ) : {},
      });
    } catch (err) {
      console.error('Failed to send notification:', record.messageId, err);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
