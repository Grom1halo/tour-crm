/**
 * Live sync: Timeweb MySQL → local PostgreSQL
 * Runs every POLL_INTERVAL seconds via SSH tunnel
 *
 * Env vars (set in .env):
 *   SSH_HOST, SSH_USER, SSH_PASSWORD or SSH_KEY_PATH
 *   MYSQL_USER, MYSQL_PASSWORD, MYSQL_DB
 *   PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DB
 *   POLL_INTERVAL (seconds, default 60)
 *   LOCAL_MYSQL_PORT (local tunnel port, default 3307)
 */

require('dotenv').config();
const { Client: SSHClient } = require('ssh2');
const mysql = require('mysql2/promise');
const { Pool } = require('pg');
const fs = require('fs');

const SSH = {
  host:     process.env.SSH_HOST     || 'vh326.timeweb.ru',
  port:     22,
  username: process.env.SSH_USER     || 'ci19820',
  password: process.env.SSH_PASSWORD || undefined,
  privateKey: process.env.SSH_KEY_PATH ? fs.readFileSync(process.env.SSH_KEY_PATH) : undefined,
};

const MYSQL_CONFIG = {
  host:     '127.0.0.1',
  port:     parseInt(process.env.LOCAL_MYSQL_PORT || '3307'),
  user:     process.env.MYSQL_USER     || 'ci19820_voucher2',
  password: process.env.MYSQL_PASSWORD || 'NewPass2026',
  database: process.env.MYSQL_DB       || 'ci19820_voucher2',
};

const pg = new Pool({
  host:     process.env.PG_HOST     || 'localhost',
  port:     parseInt(process.env.PG_PORT || '5432'),
  user:     process.env.PG_USER     || 'postgres',
  password: process.env.PG_PASSWORD || '348004',
  database: process.env.PG_DB       || 'tour_crm',
});

const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '60') * 1000;
let lastSyncedAt = new Date(0).toISOString().slice(0, 19).replace('T', ' ');
let mysqlConn = null;
let sshTunnel = null;
let tunnelServer = null;

// ── SSH Tunnel ────────────────────────────────────────────
function openTunnel() {
  return new Promise((resolve, reject) => {
    const ssh = new SSHClient();
    const net = require('net');
    const localPort = MYSQL_CONFIG.port;

    const server = net.createServer(sock => {
      ssh.forwardOut('127.0.0.1', localPort, '127.0.0.1', 3306, (err, stream) => {
        if (err) { sock.destroy(); return; }
        sock.pipe(stream).pipe(sock);
      });
    });

    server.listen(localPort, '127.0.0.1', () => {
      console.log(`[SSH] Tunnel listening on localhost:${localPort}`);
      sshTunnel = ssh;
      tunnelServer = server;
      resolve(server);
    });

    ssh.on('ready', () => {
      console.log('[SSH] Connected to Timeweb');
    }).on('error', err => {
      console.error('[SSH] Error:', err.message);
      reject(err);
    }).connect(SSH);
  });
}

function closeTunnel() {
  if (tunnelServer) { tunnelServer.close(); tunnelServer = null; }
  if (sshTunnel)   { sshTunnel.end(); sshTunnel = null; }
}

// ── Manager mapping ───────────────────────────────────────
let managerMap = {}; // mysql_user_id → pg_user_id
async function loadManagerMap() {
  const r = await pg.query('SELECT id, manager_number FROM users WHERE manager_number IS NOT NULL AND manager_number != \'\'');
  r.rows.forEach(row => { managerMap[parseInt(row.manager_number)] = row.id; });
  console.log(`[PG] Loaded ${Object.keys(managerMap).length} manager mappings`);
}

// Company mapping: mysql_company_id → pg_company_id (offset +135)
function pgCompanyId(mysqlId) {
  if (!mysqlId) return null;
  return mysqlId + 135;
}

// ── Sync vouchers ─────────────────────────────────────────
async function syncVouchers() {
  if (!mysqlConn) return;

  console.log(`[SYNC] Checking changes since ${lastSyncedAt}...`);
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const [rows] = await mysqlConn.execute(
    `SELECT v.*, ct.tour_name, ct.company_id as ct_company_id
     FROM vouchers v
     LEFT JOIN company_tours ct ON v.company_tour_id = ct.id
     WHERE v.updated_at >= ? OR v.created_at >= ?
     ORDER BY v.updated_at ASC`,
    [lastSyncedAt, lastSyncedAt]
  );

  if (rows.length === 0) {
    console.log('[SYNC] No changes');
    lastSyncedAt = now;
    return;
  }

  console.log(`[SYNC] Processing ${rows.length} vouchers...`);
  let inserted = 0, updated = 0, errors = 0;

  for (const v of rows) {
    try {
      // Resolve client
      let clientId = null;
      if (v.client_name || v.client_phone) {
        const phone = (v.client_phone || '').trim();
        const name  = (v.client_name  || '').trim();
        const managerId = managerMap[v.voucher_created_user_id] || null;

        let cr = phone
          ? await pg.query('SELECT id FROM clients WHERE phone = $1 AND (manager_id = $2 OR manager_id IS NULL) LIMIT 1', [phone, managerId])
          : await pg.query('SELECT id FROM clients WHERE name = $1 AND manager_id = $2 LIMIT 1', [name, managerId]);

        if (cr.rows.length > 0) {
          clientId = cr.rows[0].id;
        } else {
          const ins = await pg.query(
            'INSERT INTO clients(name, phone, manager_id) VALUES($1,$2,$3) RETURNING id',
            [name || phone, phone || null, managerId]
          );
          clientId = ins.rows[0].id;
        }
      }

      // Resolve agent
      let agentId = null;
      if (v.agent_name && v.agent_name.trim()) {
        const ar = await pg.query('SELECT id FROM agents WHERE lower(name) = lower($1) LIMIT 1', [v.agent_name.trim()]);
        if (ar.rows.length > 0) agentId = ar.rows[0].id;
        else {
          const ai = await pg.query('INSERT INTO agents(name) VALUES($1) RETURNING id', [v.agent_name.trim()]);
          agentId = ai.rows[0].id;
        }
      }

      // Resolve tour
      let tourId = null;
      if (v.tour_name) {
        const tr = await pg.query('SELECT id FROM tours WHERE lower(name) = lower($1) LIMIT 1', [v.tour_name]);
        if (tr.rows.length > 0) tourId = tr.rows[0].id;
      }

      const managerId  = managerMap[v.voucher_created_user_id] || null;
      const companyId  = pgCompanyId(v.ct_company_id || v.company_id);
      const tourType   = v.individual_tour == 1 ? 'individual' : v.tur_flot_flag == 1 ? 'tourflot' : 'group';
      const payStatus  = v.voucher_paid == 1 ? 'paid' : (v.price_deposit > 0) ? 'partial' : 'unpaid';
      const remarks    = v.voucher_important == 1 ? `[ВАЖНО] ${v.voucher_remarks || ''}`.trim() : (v.voucher_remarks || null);

      // Check existing
      const ex = await pg.query('SELECT id FROM vouchers WHERE voucher_number = $1', [String(v.voucher_number)]);

      const vals = [
        String(v.voucher_number), tourType, clientId, managerId, companyId, tourId, agentId,
        v.client_datetime_trip || null, null, v.hotel_name || null, v.hotel_room_number || null,
        v.client_count_adults || 0, v.client_count_child || 0, v.client_count_infant || 0,
        v.price_adult || 0, v.price_child || 0, 0,
        v.price_nett_adult || 0, v.price_nett_child || 0, 0,
        0, 0, v.price_deposit || 0,
        payStatus, remarks, v.voucher_important == 1,
        v.deleted_at ? true : false,
        v.created_at || new Date(), v.updated_at || new Date(),
      ];

      if (ex.rows.length === 0) {
        await pg.query(`
          INSERT INTO vouchers(
            voucher_number, tour_type, client_id, manager_id, company_id, tour_id, agent_id,
            tour_date, tour_date_end, hotel_name, room_number,
            adults, children, infants,
            adult_sale, child_sale, infant_sale,
            adult_net, child_net, infant_net,
            transfer_sale, other_sale, paid_to_agency,
            payment_status, remarks, is_important, is_deleted,
            created_at, updated_at
          ) VALUES(
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
            $15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29
          )`, vals);
        inserted++;
      } else {
        await pg.query(`
          UPDATE vouchers SET
            tour_type=$2, client_id=$3, manager_id=$4, company_id=$5, tour_id=$6, agent_id=$7,
            tour_date=$8, tour_date_end=$9, hotel_name=$10, room_number=$11,
            adults=$12, children=$13, infants=$14,
            adult_sale=$15, child_sale=$16, infant_sale=$17,
            adult_net=$18, child_net=$19, infant_net=$20,
            transfer_sale=$21, other_sale=$22, paid_to_agency=$23,
            payment_status=$24, remarks=$25, is_important=$26, is_deleted=$27,
            updated_at=$29
          WHERE voucher_number=$1`, vals);
        updated++;
      }
    } catch (e) {
      console.error(`[SYNC] Error on voucher ${v.voucher_number}:`, e.message);
      errors++;
    }
  }

  lastSyncedAt = now;
  console.log(`[SYNC] Done: +${inserted} new, ~${updated} updated, ${errors} errors`);
}

// ── Main loop ─────────────────────────────────────────────
async function main() {
  console.log('[START] Tour CRM live sync starting...');

  await loadManagerMap();
  await openTunnel();

  // Wait for tunnel to be ready
  await new Promise(r => setTimeout(r, 1000));

  mysqlConn = await mysql.createConnection(MYSQL_CONFIG);
  console.log('[MySQL] Connected');

  // Set lastSyncedAt to 24h ago on first run to catch recent changes
  const d = new Date();
  d.setHours(d.getHours() - 24);
  lastSyncedAt = d.toISOString().slice(0, 19).replace('T', ' ');

  await syncVouchers();

  setInterval(async () => {
    try {
      await syncVouchers();
    } catch (e) {
      console.error('[SYNC] Error:', e.message);
      // Try reconnect MySQL
      try {
        mysqlConn = await mysql.createConnection(MYSQL_CONFIG);
      } catch {}
    }
  }, POLL_INTERVAL);
}

main().catch(e => {
  console.error('[FATAL]', e.message);
  closeTunnel();
  process.exit(1);
});

process.on('SIGINT', () => { closeTunnel(); process.exit(0); });
process.on('SIGTERM', () => { closeTunnel(); process.exit(0); });
