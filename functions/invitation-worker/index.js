// ============================================================
// ⚡ Lambda: Invitation Worker (SQS Consumer)
// ============================================================
// Triggered by InvitationsQueue. Sends Firebase FCM push
// notifications for khatma invitations. Message body expected:
//   { fcmToken, title, body, data? }
// (e.g. data: { khatmaId, invitationId, email })
// Uses ReportBatchItemFailures for partial batch failure.
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
        console.warn('Missing fcmToken for invitation, skipping:', record.messageId);
        continue;
      }

      await admin.messaging().send({
        token: fcmToken,
        notification: {
          title: title || 'Khatma invitation',
          body: body || 'You have been invited to a Khatma',
        },
        data: data && typeof data === 'object' ? Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)])
        ) : {},
      });
    } catch (err) {
      console.error('Failed to send invitation notification:', record.messageId, err);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
