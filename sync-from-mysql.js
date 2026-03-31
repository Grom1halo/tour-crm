#!/usr/bin/env node
/**
 * ИНКРЕМЕНТАЛЬНАЯ СИНХРОНИЗАЦИЯ: MySQL (Laravel) → PostgreSQL (новый сайт)
 *
 * Тянет только новые и изменённые ваучеры с момента последней синхронизации.
 * Компании, туры и менеджеры — только ищутся в PG, НЕ создаются.
 * Клиенты и агенты создаются автоматически если ещё не существуют.
 *
 * Зависимости (уже есть от migrate-from-mysql.js):
 *   npm install mysql2 pg
 *
 * Использование:
 *   node sync-from-mysql.js              — синхронизировать новое
 *   node sync-from-mysql.js --dry-run    — показать что изменилось, не писать
 *   node sync-from-mysql.js --full       — принудительно всё пересинхронизировать
 *   node sync-from-mysql.js --since 2025-01-01  — с конкретной даты
 *
 * Переменные окружения:
 *   MYSQL_HOST / MYSQL_PORT / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DB
 *   PG_HOST / PG_PORT / PG_USER / PG_PASSWORD / PG_DB
 *
 * Прогресс сохраняется в .sync-state.json
 */

'use strict';

const mysql = require('mysql2/promise');
const { Pool } = require('pg');
const fs    = require('fs');
const path  = require('path');

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const MYSQL_CONFIG = {
  host:     process.env.MYSQL_HOST     || 'localhost',
  port:     parseInt(process.env.MYSQL_PORT || '3306'),
  user:     process.env.MYSQL_USER     || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DB       || 'ci19820_voucher2',
  charset:  'utf8mb4',
};

const PG_CONFIG = {
  host:     process.env.PG_HOST     || 'localhost',
  port:     parseInt(process.env.PG_PORT || '5432'),
  user:     process.env.PG_USER     || 'postgres',
  password: process.env.PG_PASSWORD || 'postgres',
  database: process.env.PG_DB       || 'tour_crm',
};

const STATE_FILE = path.join(__dirname, '.sync-state.json');
const DRY_RUN    = process.argv.includes('--dry-run');
const FULL_SYNC  = process.argv.includes('--full');
const SINCE_IDX  = process.argv.indexOf('--since');
const SINCE_DATE = SINCE_IDX !== -1 ? process.argv[SINCE_IDX + 1] : null;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const C = {
  green:  s => `\x1b[32m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
};

const ts  = () => new Date().toLocaleTimeString('ru-RU');
const log = msg  => console.log(`${C.dim(ts())}  ${msg}`);
const ok  = msg  => console.log(`${C.dim(ts())}  ${C.green('OK')} ${msg}`);
const wrn = msg  => console.log(`${C.dim(ts())}  ${C.yellow('!!')} ${msg}`);
const bad = msg  => console.log(`${C.dim(ts())}  ${C.red('XX')} ${msg}`);
const sec = t    => console.log(`\n${C.bold(C.cyan('== ' + t + ' =='))}`);

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return { lastSync: null, synced: 0 };
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch (e) { return { lastSync: null, synced: 0 }; }
}
function saveState(obj) { fs.writeFileSync(STATE_FILE, JSON.stringify(obj, null, 2)); }

const toFloat  = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const toStr    = v => (v || '').toString().trim();

function deriveTourType(row) {
  if (row.tur_flot_flag   === 1) return 'tourflot';
  if (row.individual_tour === 1) return 'individual';
  return 'group';
}
function derivePaymentStatus(row) {
  if (row.voucher_paid === 1)            return 'paid';
  if (toFloat(row.price_deposit) > 0)   return 'partial';
  return 'unpaid';
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  const state = loadState();

  let since;
  if (SINCE_DATE)                      since = new Date(SINCE_DATE);
  else if (FULL_SYNC || !state.lastSync) since = new Date('2000-01-01');
  else                                 since = new Date(state.lastSync);

  const sinceStr = since.toISOString().replace('T', ' ').substring(0, 19);

  console.log(C.bold('\n MySQL -> PostgreSQL  Инкрементальная синхронизация'));
  console.log(C.dim('Режим:   ' + (DRY_RUN ? 'DRY RUN (запись отключена)' : FULL_SYNC ? 'ПОЛНАЯ' : 'ИНКРЕМЕНТАЛЬНАЯ')));
  console.log(C.dim('С даты:  ' + sinceStr));
  if (state.lastSync) console.log(C.dim('Последний запуск: ' + state.lastSync + '  (синхронизировано: ' + (state.synced || 0) + ')'));
  console.log();

  sec('Подключение');
  let my, pg;
  try {
    my = await mysql.createConnection(MYSQL_CONFIG);
    ok('MySQL: ' + MYSQL_CONFIG.host + '/' + MYSQL_CONFIG.database);
  } catch (e) { bad('MySQL: ' + e.message); process.exit(1); }

  if (!DRY_RUN) {
    try {
      pg = new Pool(PG_CONFIG);
      await pg.query('SELECT 1');
      ok('PostgreSQL: ' + PG_CONFIG.host + '/' + PG_CONFIG.database);
    } catch (e) { bad('PostgreSQL: ' + e.message); process.exit(1); }
  }

  sec('Чтение из MySQL');
  const [changed] = await my.execute(
    'SELECT * FROM vouchers WHERE updated_at >= ? ORDER BY updated_at ASC',
    [sinceStr]
  );
  log('Изменённых ваучеров: ' + C.bold(String(changed.length)));

  if (changed.length === 0) {
    ok('Нет изменений. База актуальна.');
    await my.end();
    if (pg) await pg.end();
    return;
  }

  const uniq = (arr) => [...new Set(arr.filter(Boolean))];
  const companyIds = uniq(changed.map(v => v.company_id));
  const tourIds    = uniq(changed.map(v => v.company_tour_id));
  const mgrIds     = uniq(changed.map(v => v.voucher_created_user_id));
  const inList     = ids => ids.map(() => '?').join(',');

  // Читаем имена из MySQL для поиска в PG
  const [mysqlCompanies] = companyIds.length
    ? await my.execute('SELECT id, name FROM companies WHERE id IN (' + inList(companyIds) + ')', companyIds) : [[]];
  const [mysqlTours] = tourIds.length
    ? await my.execute('SELECT id, tour_name FROM company_tours WHERE id IN (' + inList(tourIds) + ')', tourIds) : [[]];
  const [mysqlUsers] = mgrIds.length
    ? await my.execute('SELECT id, name, email FROM users WHERE id IN (' + inList(mgrIds) + ')', mgrIds) : [[]];

  log('Справочники из MySQL: ' + mysqlCompanies.length + ' компаний, ' + mysqlTours.length + ' туров, ' + mysqlUsers.length + ' менеджеров');
  await my.end();

  if (DRY_RUN) {
    // При dry-run тоже подключаем PG чтобы показать какие справочники найдутся
    if (!pg) {
      try {
        pg = new Pool(PG_CONFIG);
        await pg.query('SELECT 1');
        ok('PostgreSQL: ' + PG_CONFIG.host + '/' + PG_CONFIG.database + ' (dry-run lookup)');
      } catch (e) {
        wrn('PostgreSQL недоступен, lookup справочников пропущен: ' + e.message);
        pg = null;
      }
    }

    sec('Предпросмотр (dry-run)');

    if (pg) {
      const pgc = await pg.connect();
      try {
        for (const c of mysqlCompanies) {
          const r = await pgc.query('SELECT id FROM companies WHERE LOWER(name)=LOWER($1) LIMIT 1', [toStr(c.name)]);
          if (r.rows.length) ok('Компания найдена: "' + toStr(c.name) + '" → id=' + r.rows[0].id);
          else wrn('Компания НЕ найдена: "' + toStr(c.name) + '"');
        }
        for (const t of mysqlTours) {
          const r = await pgc.query('SELECT id FROM tours WHERE LOWER(name)=LOWER($1) LIMIT 1', [toStr(t.tour_name)]);
          if (r.rows.length) ok('Тур найден: "' + toStr(t.tour_name) + '" → id=' + r.rows[0].id);
          else wrn('Тур НЕ найден: "' + toStr(t.tour_name) + '"');
        }
        for (const u of mysqlUsers) {
          const uname = toStr(u.email).split('@')[0] || ('user_' + u.id);
          let r = await pgc.query('SELECT id FROM users WHERE username=$1', [uname]);
          if (!r.rows.length) r = await pgc.query('SELECT id FROM users WHERE LOWER(full_name)=LOWER($1) LIMIT 1', [toStr(u.name)]);
          if (r.rows.length) ok('Менеджер найден: "' + toStr(u.name) + '" → id=' + r.rows[0].id);
          else wrn('Менеджер НЕ найден: "' + toStr(u.name) + '"');
        }
      } finally { pgc.release(); await pg.end(); }
    }

    log('Ваучеров к обработке: ' + changed.length + ' (первые 30):');
    for (const v of changed.slice(0, 30)) {
      const isNew  = new Date(v.created_at) >= since;
      const label  = isNew ? C.green('NEW') : C.yellow('UPD');
      console.log('  [' + label + '] #' + v.voucher_number + '  "' + toStr(v.client_name) + '"  updated=' + v.updated_at);
    }
    if (changed.length > 30) log('  ...ещё ' + (changed.length - 30));
    return;
  }

  sec('Запись в PostgreSQL');
  const pgClient = await pg.connect();
  const syncTime = new Date().toISOString();
  let inserted = 0, updated = 0, errors = 0;

  try {
    await pgClient.query('BEGIN');

    // ── Поиск менеджеров в PG (только lookup, не создаём) ─────────────────────
    const userIdMap = new Map();
    for (const u of mysqlUsers) {
      const uname = toStr(u.email).split('@')[0] || ('user_' + u.id);
      // Ищем по username (email-часть) или по полному имени
      let res = await pgClient.query('SELECT id FROM users WHERE username=$1', [uname]);
      if (!res.rows.length) {
        res = await pgClient.query('SELECT id FROM users WHERE LOWER(full_name)=LOWER($1) LIMIT 1', [toStr(u.name)]);
      }
      if (res.rows.length) {
        userIdMap.set(u.id, res.rows[0].id);
      } else {
        wrn('Менеджер не найден в PG: "' + toStr(u.name) + '" (username=' + uname + ') → manager_id=null');
      }
    }

    // ── Поиск компаний в PG (только lookup, не создаём) ──────────────────────
    const companyIdMap = new Map();
    for (const c of mysqlCompanies) {
      const cname = toStr(c.name);
      const res = await pgClient.query('SELECT id FROM companies WHERE LOWER(name)=LOWER($1) LIMIT 1', [cname]);
      if (res.rows.length) {
        companyIdMap.set(c.id, res.rows[0].id);
      } else {
        wrn('Компания не найдена в PG: "' + cname + '" → company_id=null');
      }
    }

    // ── Поиск туров в PG (только lookup, не создаём) ──────────────────────────
    const tourIdMap = new Map();
    for (const t of mysqlTours) {
      const tname = toStr(t.tour_name);
      if (!tname) continue;
      const res = await pgClient.query('SELECT id FROM tours WHERE LOWER(name)=LOWER($1) LIMIT 1', [tname]);
      if (res.rows.length) {
        tourIdMap.set(t.id, res.rows[0].id);
      } else {
        wrn('Тур не найден в PG: "' + tname + '" → tour_id=null');
      }
    }

    await pgClient.query('ALTER TABLE vouchers DISABLE TRIGGER trigger_update_voucher_totals');

    for (const v of changed) {
      try {
        // Менеджер — только поиск
        const mgr = userIdMap.get(v.voucher_created_user_id) || null;

        // Клиент (upsert при известном mgr, поиск по телефону при null)
        const phone = toStr(v.client_phone);
        const cname = toStr(v.client_name) || 'Unknown';
        let clientId = null;
        if (phone || cname !== 'Unknown') {
          if (mgr !== null) {
            const r = await pgClient.query(
              'INSERT INTO clients (name,phone,manager_id) VALUES ($1,$2,$3) ON CONFLICT (phone,manager_id) DO UPDATE SET name=EXCLUDED.name RETURNING id',
              [cname, phone || '', mgr]
            );
            clientId = r.rows[0].id;
          } else if (phone) {
            // Менеджер неизвестен — ищем клиента только по телефону
            let r = await pgClient.query('SELECT id FROM clients WHERE phone=$1 LIMIT 1', [phone]);
            if (!r.rows.length) {
              r = await pgClient.query('INSERT INTO clients (name,phone,manager_id) VALUES ($1,$2,NULL) RETURNING id', [cname, phone]);
            }
            clientId = r.rows[0].id;
          }
        }

        // Агент
        const aname = toStr(v.agent_name);
        let agentId = null;
        if (aname) {
          let r = await pgClient.query(
            'INSERT INTO agents (name,commission_percentage,is_active) VALUES ($1,0,true) ON CONFLICT DO NOTHING RETURNING id',
            [aname]
          );
          if (!r.rows.length) {
            r = await pgClient.query('SELECT id FROM agents WHERE LOWER(name)=LOWER($1)', [aname]);
          }
          agentId = r.rows[0] ? r.rows[0].id : null;
        }

        const companyId = companyIdMap.get(v.company_id) || null;
        const tourId    = tourIdMap.get(v.company_tour_id) || null;

        const isInd    = v.individual_tour === 1;
        const aSale    = toFloat(isInd ? v.price_individual     : v.price_adult);
        const aNet     = toFloat(isInd ? v.price_nett_individual : v.price_nett_adult);
        const cSale    = toFloat(v.price_child);
        const cNet     = toFloat(v.price_nett_child);
        const tSale    = toFloat(v.price_transfer);
        const tNet     = toFloat(v.price_nett_transfer);
        const oSale    = toFloat(v.price_other);
        const oNet     = toFloat(v.price_nett_other);
        const adults   = parseInt(v.client_count_adults || 0);
        const children = parseInt(v.client_count_child  || 0);
        const totNet   = adults*aNet  + children*cNet  + (adults+children)*tNet  + oNet;
        const totSale  = adults*aSale + children*cSale + (adults+children)*tSale + oSale;
        const paid     = toFloat(v.price_deposit);
        const agtPct   = totSale > 0 ? parseFloat((toFloat(v.agent_commission)/totSale*100).toFixed(2)) : 0;

        let remarks = toStr(v.voucher_remarks);
        if (v.voucher_important === 1) remarks = '[ВАЖНО] ' + remarks;
        if (toStr(v.voucher_cancellations)) remarks += ' | Отмена: ' + toStr(v.voucher_cancellations);
        remarks = remarks.trim() || null;

        let tourDate = null, tourTime = null;
        if (v.client_datetime_trip) {
          const dt = new Date(v.client_datetime_trip);
          if (!isNaN(dt.getTime())) {
            tourDate = dt.toISOString().split('T')[0];
            tourTime = dt.toTimeString().split(' ')[0];
          }
        }
        if (!tourDate) tourDate = v.created_at ? new Date(v.created_at).toISOString().split('T')[0] : '2020-01-01';

        const res = await pgClient.query(
          'INSERT INTO vouchers (voucher_number,tour_type,client_id,manager_id,company_id,tour_id,agent_id,tour_date,tour_time,hotel_name,room_number,adults,children,infants,adult_net,child_net,infant_net,transfer_net,other_net,adult_sale,child_sale,infant_sale,transfer_sale,other_sale,total_net,total_sale,paid_to_agency,cash_on_tour,payment_status,agent_commission_percentage,remarks,is_important,is_deleted,deleted_at,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,0,$14,$15,0,$16,$17,$18,$19,0,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33) ON CONFLICT (voucher_number) DO UPDATE SET tour_type=EXCLUDED.tour_type,client_id=EXCLUDED.client_id,company_id=EXCLUDED.company_id,tour_id=EXCLUDED.tour_id,agent_id=EXCLUDED.agent_id,tour_date=EXCLUDED.tour_date,tour_time=EXCLUDED.tour_time,hotel_name=EXCLUDED.hotel_name,room_number=EXCLUDED.room_number,adults=EXCLUDED.adults,children=EXCLUDED.children,adult_net=EXCLUDED.adult_net,child_net=EXCLUDED.child_net,transfer_net=EXCLUDED.transfer_net,other_net=EXCLUDED.other_net,adult_sale=EXCLUDED.adult_sale,child_sale=EXCLUDED.child_sale,transfer_sale=EXCLUDED.transfer_sale,other_sale=EXCLUDED.other_sale,total_net=EXCLUDED.total_net,total_sale=EXCLUDED.total_sale,paid_to_agency=EXCLUDED.paid_to_agency,cash_on_tour=EXCLUDED.cash_on_tour,payment_status=EXCLUDED.payment_status,agent_commission_percentage=EXCLUDED.agent_commission_percentage,remarks=EXCLUDED.remarks,is_important=EXCLUDED.is_important,is_deleted=EXCLUDED.is_deleted,deleted_at=EXCLUDED.deleted_at,updated_at=EXCLUDED.updated_at RETURNING (xmax=0) AS is_insert, id',
          [
            toStr(v.voucher_number), deriveTourType(v), clientId, mgr,
            companyId, tourId, agentId,
            tourDate, tourTime, toStr(v.hotel_name)||null, toStr(v.hotel_room_number)||null,
            adults, children,
            aNet, cNet, tNet, oNet,
            aSale, cSale, tSale, oSale,
            totNet, totSale, paid, totSale-paid,
            derivePaymentStatus(v), agtPct,
            remarks, v.voucher_important===1,
            v.deleted_at!==null, v.deleted_at||null,
            v.created_at||new Date(), v.updated_at||new Date(),
          ]
        );

        const row = res.rows[0];
        if (row.is_insert) {
          inserted++;
          ok('NEW  #' + v.voucher_number + '  ' + cname);
          if (paid > 0 && !v.deleted_at) {
            const ex = await pgClient.query(
              'SELECT id FROM payments WHERE voucher_id=$1 AND notes LIKE $2',
              [row.id, 'Мигр%']
            );
            if (!ex.rows.length) {
              await pgClient.query(
                'INSERT INTO payments (voucher_id,payment_date,amount,payment_method,notes,created_by) VALUES ($1,$2,$3,$4,$5,$6)',
                [row.id, v.created_at||new Date(), paid, toStr(v.voucher_money).toUpperCase()||'cash', 'Мигрировано', mgr]
              );
            }
          }
        } else {
          updated++;
          log('UPD  #' + v.voucher_number + '  ' + cname);
        }

      } catch (e) {
        errors++;
        bad('#' + v.voucher_number + ': ' + e.message);
      }
    }

    await pgClient.query('ALTER TABLE vouchers ENABLE TRIGGER trigger_update_voucher_totals');
    await pgClient.query('COMMIT');

    saveState({
      lastSync: syncTime,
      lastCount: changed.length,
      synced: (state.synced || 0) + inserted + updated,
      totalInserted: (state.totalInserted || 0) + inserted,
    });

    sec('Результат');
    if (inserted) console.log('  Новых:      ' + inserted);
    if (updated)  console.log('  Обновлено:  ' + updated);
    if (errors)   console.log('  Ошибок:     ' + errors);
    console.log();
    if (errors === 0) ok('Синхронизация завершена успешно');
    else wrn('Завершено с ' + errors + ' ошибками');

  } catch (e) {
    try { await pgClient.query('ROLLBACK'); } catch(e2){}
    bad('Транзакция откатана: ' + e.message);
    console.error(e);
    process.exit(1);
  } finally {
    pgClient.release();
    await pg.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
