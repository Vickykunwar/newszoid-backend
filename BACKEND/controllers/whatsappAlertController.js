const crypto = require('crypto');

function normalizeWhatsAppNumber(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10) digits = `91${digits}`;
  return /^\d{11,15}$/.test(digits) ? digits : '';
}

function hasTwilioConfig() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_WA_NUMBER
  );
}

function hasMatchingSecret(request) {
  const configured = process.env.WHATSAPP_ALERT_SECRET;
  const supplied = String(request.headers?.authorization || '').replace(/^Bearer\s+/i, '');
  if (!configured || !supplied) return false;

  const expected = Buffer.from(configured);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

async function sendViaTwilio({ waNumber, message }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WA_NUMBER;
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      From: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
      To: `whatsapp:+${waNumber}`,
      Body: message,
    }),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || `Twilio returned ${response.status}`);
  }

  return { provider: 'twilio', messageId: payload.sid || '' };
}

/**
 * Private, provider-backed endpoint for a future authenticated worker.
 * It deliberately rejects public browser calls: otherwise anyone could spend
 * the project's WhatsApp balance by posting arbitrary destination numbers.
 */
async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!hasTwilioConfig() || !process.env.WHATSAPP_ALERT_SECRET) {
    return res.status(503).json({
      error: 'WhatsApp delivery is not configured.',
      code: 'WHATSAPP_NOT_CONFIGURED',
    });
  }

  if (!hasMatchingSecret(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const waNumber = normalizeWhatsAppNumber(req.body?.waNumber);
  const message = String(req.body?.message || '').trim();
  if (!waNumber || !message || message.length > 1600) {
    return res.status(400).json({ error: 'Provide a valid WhatsApp number and a message up to 1600 characters.' });
  }

  try {
    const result = await sendViaTwilio({ waNumber, message });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('[WhatsApp] Delivery failed:', error.message);
    return res.status(502).json({ error: 'WhatsApp provider rejected the message.' });
  }
}

module.exports = {
  handler,
  _internal: { normalizeWhatsAppNumber, hasTwilioConfig },
};
