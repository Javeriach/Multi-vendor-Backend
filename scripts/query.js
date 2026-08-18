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
  const sql = process.argv[2];
  const res = await client.query(sql);
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
})().catch((err) => {
  console.error('QUERY_ERROR', err.message);
  process.exit(1);
});
