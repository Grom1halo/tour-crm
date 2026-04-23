const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const pool = new Pool({ host:'localhost', port:5432, user:'postgres', password:'pg_super_348004', database:'tour_crm' });

const users = [
  { username:'test_admin',      password:'Test_admin1',      role:'admin',      full_name:'Test Admin' },
  { username:'test_manager',    password:'Test_manager1',    role:'manager',    full_name:'Test Manager' },
  { username:'test_editor',     password:'Test_editor1',     role:'editor',     full_name:'Test Editor' },
  { username:'test_hotline',    password:'Test_hotline1',    role:'hotline',    full_name:'Test Hotline' },
  { username:'test_accountant', password:'Test_accountant1', role:'accountant', full_name:'Test Accountant' },
];

(async () => {
  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    await pool.query(
      `INSERT INTO users (username, password_hash, role, roles, full_name)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (username) DO UPDATE SET password_hash=$2, role=$3, roles=$4`,
      [u.username, hash, u.role, [u.role], u.full_name]
    );
    console.log('✓', u.username.padEnd(20), u.password);
  }
  await pool.end();
})();
