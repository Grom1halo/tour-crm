#!/usr/bin/env node
'use strict';

const fs = require('fs');

const DUMP_FILE = process.argv[2] || 'D:/Downloads/localhost.sql';
const OUT_FILE  = 'vouchers_import.sql';

// ── helpers ──────────────────────────────────────────────────────────────────
const f   = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const s   = v => (v === null || v === undefined) ? '' : String(v).trim();
const int = v => { const n = parseInt(v); return isNaN(n) ? 0 : n; };
const esc = v => v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;

function deriveTourType(v) {
  if (int(v.tur_flot_flag)   === 1) return 'tourflot';
  if (int(v.individual_tour) === 1) return 'individual';
  return 'group';
}
function derivePaymentStatus(v) {
  if (int(v.voucher_paid) === 1)  return 'paid';
  if (f(v.price_deposit)  > 0)   return 'partial';
  return 'unpaid';
}

// ── parseDump (inline copy) ───────────────────────────────────────────────────
function parseScalar(v) { if (v === 'NULL' || v === '') return null; return v; }

function parseValueRows(block) {
  const rows = []; let i = 0; const len = block.length;
  while (i < len) {
    while (i < len && block[i] !== '(') i++;
    if (i >= len) break; i++;
    const values = []; let current = '', inString = false, strChar = '';
    while (i < len) {
      const ch = block[i];
      if (inString) {
        if (ch === '\\' && i+1 < len) {
          const nx = block[i+1];
          if      (nx==="'")  { current+="'";  i+=2; continue; }
          else if (nx==='"')  { current+='"';  i+=2; continue; }
          else if (nx==='\\') { current+='\\'; i+=2; continue; }
          else if (nx==='n')  { current+='\n'; i+=2; continue; }
          else if (nx==='r')  { current+='\r'; i+=2; continue; }
          else if (nx==='t')  { current+='\t'; i+=2; continue; }
          else { current+=ch; i++; continue; }
        }
        if (ch === strChar) { inString=false; i++; continue; }
        current+=ch; i++; continue;
      }
      if (ch==="'" || ch==='"') { inString=true; strChar=ch; i++; continue; }
      if (ch===',') { values.push(parseScalar(current.trim())); current=''; i++; continue; }
      if (ch===')') { values.push(parseScalar(current.trim())); rows.push(values); i++; break; }
      current+=ch; i++;
    }
  }
  return rows;
}

function parseDump(filePath, tables) {
  const content = fs.readFileSync(filePath, 'utf8');
  const result  = {}; for (const t of tables) result[t] = [];
  const tableColsMap = {};
  const createRe = /CREATE TABLE(?: IF NOT EXISTS)? `(\w+)` \(([\s\S]*?)\) ENGINE/g;
  let cm;
  while ((cm = createRe.exec(content)) !== null) {
    const tname = cm[1]; if (!tables.includes(tname)) continue;
    tableColsMap[tname] = [...cm[2].matchAll(/^\s+`(\w+)`/gm)].map(m => m[1]);
  }
  const insertRe = /INSERT INTO `(\w+)` (?:\(([^)]+)\) )?VALUES\s*([\s\S]*?);(?:\n|$)/g;
  let match;
  while ((match = insertRe.exec(content)) !== null) {
    const tableName = match[1]; if (!tables.includes(tableName)) continue;
    const cols = match[2] ? match[2].split(',').map(c=>c.trim().replace(/`/g,'')) : (tableColsMap[tableName]||[]);
    if (!cols.length) continue;
    const valuesBlock = match[3];
    for (const rowValues of parseValueRows(valuesBlock)) {
      if (rowValues.length !== cols.length) continue;
      const obj = {}; cols.forEach((c,i) => { obj[c] = rowValues[i]; });
      result[tableName].push(obj);
    }
  }
  return result;
}

// ── main ─────────────────────────────────────────────────────────────────────
console.log('Parsing dump...');
const { users, companies, company_tours, vouchers } = parseDump(DUMP_FILE, ['users','companies','company_tours','vouchers']);
console.log(`users:${users.length}  companies:${companies.length}  tours:${company_tours.length}  vouchers:${vouchers.length}`);

// Build lookup maps by name (key=lowercase)
const companyByName = new Map(companies.map(c => [s(c.name).toLowerCase(), s(c.name)]));
const tourByName    = new Map(company_tours.map(t => [s(t.tour_name||t.name).toLowerCase(), s(t.tour_name||t.name)]));
const userByEmail   = new Map(users.map(u => {
  const uname = s(u.email).split('@')[0] || s(u.name).toLowerCase().replace(/\s+/g,'_') || `user_${u.id}`;
  return [String(u.id), { uname, fullName: s(u.name)||uname }];
}));

const lines = [];
lines.push('-- Tour CRM: import vouchers from MySQL dump');
lines.push('-- Run: psql -U tour_user -d tour_crm -f vouchers_import.sql');
lines.push('-- Only inserts NEW vouchers (ON CONFLICT DO NOTHING on voucher_number)');
lines.push('');
lines.push('BEGIN;');
lines.push('ALTER TABLE vouchers DISABLE TRIGGER trigger_update_voucher_totals;');
lines.push('');

let count = 0;

for (const v of vouchers) {
  const vnum = s(v.voucher_number);
  if (!vnum) continue;

  const tourType      = deriveTourType(v);
  const paymentStatus = derivePaymentStatus(v);

  const isIndividual = int(v.individual_tour) === 1;
  const aSale = f(isIndividual ? v.price_individual     : v.price_adult);
  const aNet  = f(isIndividual ? v.price_nett_individual : v.price_nett_adult);
  const cSale = f(v.price_child);   const cNet  = f(v.price_nett_child);
  const tSale = f(v.price_transfer); const tNet  = f(v.price_nett_transfer);
  const oSale = f(v.price_other);   const oNet  = f(v.price_nett_other);
  const adults = int(v.client_count_adults); const children = int(v.client_count_child);
  const infants = int(v.client_count_infant);
  const totNet  = adults*aNet  + children*cNet  + (adults+children)*tNet  + oNet;
  const totSale = adults*aSale + children*cSale + (adults+children)*tSale + oSale;
  const paid    = f(v.price_deposit);
  const cash    = totSale - paid;
  const agtPct  = totSale > 0 ? parseFloat((f(v.agent_commission)/totSale*100).toFixed(2)) : 0;

  let remarks = s(v.voucher_remarks);
  if (int(v.voucher_important||0)===1) remarks = '[ВАЖНО] ' + remarks;
  if (s(v.voucher_cancellations)) remarks += ' | Отмена: ' + s(v.voucher_cancellations);
  remarks = remarks.trim() || null;

  let tourDate = null, tourTime = null;
  if (v.client_datetime_trip) {
    const dt = new Date(v.client_datetime_trip);
    if (!isNaN(dt)) { tourDate = dt.toISOString().split('T')[0]; tourTime = dt.toTimeString().split(' ')[0]; }
  }
  if (!tourDate) tourDate = v.created_at ? new Date(v.created_at).toISOString().split('T')[0] : '2020-01-01';

  const cname  = s(v.client_name) || 'Unknown';
  const phone  = s(v.client_phone);
  const aname  = s(v.agent_name);
  const hotel  = s(v.hotel_name) || null;
  const room   = s(v.hotel_room_number) || null;

  const mgrInfo = userByEmail.get(String(v.voucher_created_user_id));
  const mgrUname    = mgrInfo ? esc(mgrInfo.uname)    : 'NULL';
  const mgrFullName = mgrInfo ? esc(mgrInfo.fullName)  : 'NULL';

  const companyNameEsc = companyByName.has(s(companies.find(c=>String(c.id)===String(v.company_id))?.name).toLowerCase())
    ? esc(s(companies.find(c=>String(c.id)===String(v.company_id))?.name))
    : 'NULL';
  const tourNameEsc = (() => {
    const ct = company_tours.find(t=>String(t.id)===String(v.company_tour_id));
    return ct ? esc(s(ct.tour_name||ct.name)) : 'NULL';
  })();

  // Subquery for manager
  const mgrSql = mgrUname !== 'NULL'
    ? `(SELECT id FROM users WHERE username=${mgrUname} LIMIT 1)`
    : 'NULL';

  // Subquery for client
  let clientSql;
  if (phone) {
    clientSql = `(SELECT id FROM (
      INSERT INTO clients (name,phone,manager_id)
      VALUES (${esc(cname)},${esc(phone)},${mgrSql})
      ON CONFLICT (phone,manager_id) DO UPDATE SET name=EXCLUDED.name
      RETURNING id) _c)`;
    // Simplified: use a DO block approach instead
  }

  // Subquery for agent
  const agentSql = aname
    ? `(SELECT id FROM agents WHERE LOWER(name)=LOWER(${esc(aname)}) LIMIT 1)`
    : 'NULL';

  const companySql = companyNameEsc !== 'NULL'
    ? `(SELECT id FROM companies WHERE LOWER(name)=LOWER(${companyNameEsc}) LIMIT 1)`
    : 'NULL';

  const tourSql = tourNameEsc !== 'NULL'
    ? `(SELECT id FROM tours WHERE LOWER(name)=LOWER(${tourNameEsc}) LIMIT 1)`
    : 'NULL';

  const isDeleted = v.deleted_at !== null;
  const createdAt = v.created_at ? esc(new Date(v.created_at).toISOString()) : 'NOW()';
  const updatedAt = v.updated_at ? esc(new Date(v.updated_at).toISOString()) : 'NOW()';
  const deletedAt = v.deleted_at ? esc(new Date(v.deleted_at).toISOString()) : 'NULL';

  // Upsert client into temp var using a DO block per voucher is too complex.
  // Instead: inline INSERT ... ON CONFLICT as a CTE
  lines.push(`-- #${vnum}  ${cname}`);

  if (phone) {
    lines.push(`INSERT INTO clients (name,phone,manager_id)`);
    lines.push(`VALUES (${esc(cname)},${esc(phone)},${mgrSql})`);
    lines.push(`ON CONFLICT (phone,manager_id) DO UPDATE SET name=EXCLUDED.name;`);
  }
  if (aname) {
    lines.push(`INSERT INTO agents (name,commission_percentage,is_active) VALUES (${esc(aname)},0,true) ON CONFLICT DO NOTHING;`);
  }

  const clientSql2 = phone
    ? `(SELECT id FROM clients WHERE phone=${esc(phone)} AND (manager_id=${mgrSql} OR manager_id IS NULL) LIMIT 1)`
    : 'NULL';

  lines.push(`INSERT INTO vouchers (voucher_number,tour_type,manager_id,client_id,company_id,tour_id,agent_id,`);
  lines.push(`  tour_date,tour_time,hotel_name,room_number,adults,children,infants,`);
  lines.push(`  adult_net,child_net,infant_net,transfer_net,other_net,`);
  lines.push(`  adult_sale,child_sale,infant_sale,transfer_sale,other_sale,`);
  lines.push(`  total_net,total_sale,paid_to_agency,cash_on_tour,payment_status,`);
  lines.push(`  agent_commission_percentage,remarks,is_important,is_deleted,deleted_at,created_at,updated_at)`);
  lines.push(`VALUES (`);
  lines.push(`  ${esc(vnum)},${esc(tourType)},${mgrSql},${clientSql2},${companySql},${tourSql},${agentSql},`);
  lines.push(`  ${esc(tourDate)},${tourTime ? esc(tourTime) : 'NULL'},${esc(hotel)},${esc(room)},${adults},${children},${infants},`);
  lines.push(`  ${aNet},${cNet},0,${tNet},${oNet},`);
  lines.push(`  ${aSale},${cSale},0,${tSale},${oSale},`);
  lines.push(`  ${totNet},${totSale},${paid},${cash},${esc(paymentStatus)},`);
  lines.push(`  ${agtPct},${esc(remarks)},${isDeleted ? 'false' : int(v.voucher_important||0)===1 ? 'true':'false'},${isDeleted},${deletedAt},${createdAt},${updatedAt})`);
  lines.push(`ON CONFLICT (voucher_number) DO NOTHING;`);
  lines.push('');
  count++;
}

lines.push('ALTER TABLE vouchers ENABLE TRIGGER trigger_update_voucher_totals;');
lines.push('COMMIT;');
lines.push(`-- Total: ${count} vouchers processed`);

fs.writeFileSync(OUT_FILE, lines.join('\n'), 'utf8');
console.log(`Done! Written to ${OUT_FILE} (${count} vouchers, ${Math.round(fs.statSync(OUT_FILE).size/1024)}KB)`);
