/** Constructs a genuinely validly-signed Stripe webhook payload (using the
 * real STRIPE_WEBHOOK_SECRET from .env) and POSTs it to the running server —
 * lets us test the full payment-confirmation code path without needing
 * Stripe's servers to call back, since we can't receive inbound webhooks
 * from the public internet in this sandbox anyway. */
require('dotenv').config();
const crypto = require('crypto');
const http = require('http');

const sessionId = process.argv[2];
const eventType = process.argv[3] || 'checkout.session.completed';
const paymentStatus = process.argv[4] || 'paid';
const badSignature = process.argv[5] === 'bad-signature';

const payload = JSON.stringify({
  id: 'evt_test_' + crypto.randomBytes(8).toString('hex'),
  object: 'event',
  type: eventType,
  data: {
    object: {
      id: sessionId,
      object: 'checkout.session',
      payment_status: paymentStatus,
    },
  },
});

const secret = process.env.STRIPE_WEBHOOK_SECRET;
const timestamp = Math.floor(Date.now() / 1000);
const signedPayload = `${timestamp}.${payload}`;
const signature = badSignature
  ? 'deadbeef'.repeat(8)
  : crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

const req = http.request(
  {
    hostname: 'localhost',
    port: 4000,
    path: '/api/webhooks/stripe',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'Stripe-Signature': `t=${timestamp},v1=${signature}`,
    },
  },
  (res) => {
    let body = '';
    res.on('data', (chunk) => (body += chunk));
    res.on('end', () => {
      console.log('STATUS', res.statusCode);
      console.log(body);
    });
  },
);
req.write(payload);
req.end();
