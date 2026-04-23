const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost', port: 5432,
  user: 'postgres', password: 'pg_super_348004',
  database: 'tour_crm'
});

const users = [
  { id: 1,  username: 'ko82',                   password: 'Ko82_tour25' },
  { id: 2,  username: 'Tashbaev83',              password: 'Roman_tour25' },
  { id: 3,  username: 'narat0544',               password: 'Rita_tour25' },
  { id: 4,  username: 'tatianapavlovathailand',  password: 'Hotline_24x' },
  { id: 5,  username: 'achikalova',              password: 'Hotline_25x' },
  { id: 6,  username: 'sh.design777',            password: 'Shahlo_tour25' },
  { id: 7,  username: 'Luganskaya.yuliya',       password: 'Hotline_28x' },
  { id: 8,  username: 'Masterstvo2008',          password: 'Vika_tour25' },
  { id: 9,  username: '8maru888',                password: 'Hotline_30x' },
  { id: 10, username: '89139343611',             password: 'Hotline_31x' },
  { id: 11, username: 'Alison-jur',              password: 'Hotline_32x' },
  { id: 12, username: 'tonkopr',                 password: 'Hotline_33x' },
  { id: 13, username: 'andykid81',               password: 'Andrey_tour25' },
  { id: 14, username: 'Sukunya25234',            password: 'Sukunya_tour25' },
  { id: 15, username: 'malkova1991',             password: 'Hotline_36x' },
  { id: 16, username: 'oranitkongpong',          password: 'Praw_tour25' },
  { id: 17, username: 'krovin.nik',              password: 'Nikita_tour25' },
];

(async () => {
  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, u.id]);
    console.log('✓', u.username.padEnd(26), u.password);
  }
  await pool.end();
  console.log('\nДонe!');
})();
