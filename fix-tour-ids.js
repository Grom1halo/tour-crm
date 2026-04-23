const fs = require('fs');
const { Pool } = require('pg');
const pool = new Pool({ host: 'localhost', port: 5432, user: 'postgres', password: '348004', database: 'tour_crm' });

function parseRow(src, pos) {
  const values = [];
  let i = pos;
  while (i < src.length) {
    while (i < src.length && src[i] === ' ') i++;
    if (src[i] === ')') { i++; break; }
    if (src[i] === ',') { i++; continue; }
    if (src.slice(i, i+4) === 'NULL') {
      values.push(null); i += 4;
    } else if (src[i] === "'") {
      let val = ''; i++;
      while (i < src.length) {
        if (src[i] === '\\') {
          i++; val += src[i] || ''; i++;
        } else if (src[i] === "'" && src[i+1] === "'") {
          val += "'"; i += 2;
        } else if (src[i] === "'") {
          i++; break;
        } else {
          val += src[i++];
        }
      }
      values.push(val);
    } else {
      let val = '';
      while (i < src.length && src[i] !== ',' && src[i] !== ')') val += src[i++];
      values.push(val === 'NULL' ? null : val);
    }
  }
  return { values, endPos: i };
}

async function main() {
  console.log('Reading files...');
  const rawMain = fs.readFileSync('C:/Users/1/Downloads/ci19820_voucher2.sql', 'utf8');
  const rawVouchers = fs.readFileSync('C:/Users/1/Downloads/vouchers_only.sql', 'utf8');

  // Parse company_tours: old_id -> tour_name
  console.log('Parsing company_tours...');
  const ctInsertIdx = rawMain.indexOf('INSERT INTO `company_tours`');
  const ctColStart = rawMain.indexOf('(', ctInsertIdx) + 1;
  const ctColEnd = rawMain.indexOf(')', ctColStart);
  const ctCols = rawMain.slice(ctColStart, ctColEnd).split(',').map(c => c.trim().replace(/`/g, ''));
  const idIdx = ctCols.indexOf('id');
  const nameIdx = ctCols.indexOf('tour_name');

  const oldIdToName = {};
  let pos = rawMain.indexOf('(', rawMain.indexOf('VALUES', ctColEnd));
  let count = 0;
  while (pos < rawMain.length && rawMain[pos] === '(') {
    pos++;
    const { values, endPos } = parseRow(rawMain, pos);
    pos = endPos;
    if (values.length > 0) {
      oldIdToName[values[idIdx]] = values[nameIdx];
      count++;
    }
    while (pos < rawMain.length && (rawMain[pos] === ',' || rawMain[pos] === '\n' || rawMain[pos] === '\r' || rawMain[pos] === ' ')) pos++;
    if (rawMain[pos] === ';') break;
  }
  console.log(`Parsed ${count} company_tours`);

  // Parse vouchers: voucher_number -> company_tour_id
  // Use regex to find rows: (id, 'voucher_number', company_tour_id_or_null, ...)
  console.log('Extracting voucher -> tour mappings...');
  const vMap = {}; // voucher_number -> company_tour_id
  // Pattern: (number, 'string', number_or_NULL,
  const re = /\(\d+,\s*'([^']+)',\s*(\d+),/g;
  let m;
  while ((m = re.exec(rawVouchers)) !== null) {
    vMap[m[1]] = m[2]; // voucher_number -> company_tour_id
  }
  console.log(`Found ${Object.keys(vMap).length} vouchers with company_tour_id`);

  // Get PG tours: name -> id
  const { rows: pgTours } = await pool.query('SELECT id, name FROM tours');
  const nameToId = {};
  pgTours.forEach(t => { nameToId[t.name.toLowerCase().trim()] = t.id; });

  // Build final mapping: voucher_number -> PG tour_id
  let matched = 0, notFound = 0;
  const updates = [];
  for (const [vnum, ctId] of Object.entries(vMap)) {
    const tourName = oldIdToName[ctId];
    if (!tourName) { notFound++; continue; }
    const pgId = nameToId[tourName.toLowerCase().trim()];
    if (pgId) {
      updates.push([pgId, vnum]);
      matched++;
    } else {
      notFound++;
    }
  }
  console.log(`Matched: ${matched}, not found: ${notFound}`);

  // Batch update
  let updated = 0;
  for (const [tourId, vnum] of updates) {
    const r = await pool.query('UPDATE vouchers SET tour_id = $1 WHERE voucher_number = $2', [tourId, vnum]);
    if (r.rowCount > 0) updated++;
    if (updated % 500 === 0 && updated > 0) console.log(`Updated ${updated}...`);
  }
  console.log(`Done! Updated ${updated} vouchers`);
  pool.end();
}

main().catch(e => { console.error(e.message); pool.end(); });
