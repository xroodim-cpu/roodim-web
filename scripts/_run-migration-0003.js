/**
 * Apply migration 0003 (custom_domain_status + custom_domain_verified_at) to Railway DB.
 * Safe to re-run (IF NOT EXISTS).
 */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });

async function run() {
  await sql`ALTER TABLE sites ADD COLUMN IF NOT EXISTS custom_domain_status varchar(20)`;
  await sql`ALTER TABLE sites ADD COLUMN IF NOT EXISTS custom_domain_verified_at timestamp`;
  console.log('✅ Migration 0003 applied.');

  const cols = await sql`
    SELECT column_name, data_type, character_maximum_length
    FROM information_schema.columns
    WHERE table_name = 'sites' AND column_name LIKE '%domain%'
    ORDER BY ordinal_position
  `;
  console.log('Current domain-related columns on sites:');
  for (const c of cols) console.log(`  ${c.column_name.padEnd(30)} ${c.data_type}${c.character_maximum_length ? '('+c.character_maximum_length+')' : ''}`);
  await sql.end();
}
run().catch(e => { console.error(e); process.exit(1); });
