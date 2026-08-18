/** One-off test-seeding helper: promotes a user to admin directly in the DB.
 * There is no API path to do this (correctly — role escalation must never be
 * self-service), so bootstrapping the first admin always requires direct DB
 * access in any real deployment too. */
const { Client } = require('pg');

(async () => {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'eshop_marketplace',
  });
  await client.connect();
  const email = process.argv[2];
  const res = await client.query(
    `UPDATE users SET role = 'admin' WHERE email = $1 RETURNING id, email, role`,
    [email],
  );
  console.log(res.rows);
  await client.end();
})();
