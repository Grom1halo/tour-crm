const { Pool } = require('pg');
const pool = new Pool({ host:'localhost', port:5432, database:'tour_crm', user:'postgres', password: process.env.PG_PASSWORD || '' });

// Company id → article (from old system screenshot + logical codes)
const companyArticles = {
  137: 'AT',    // A TIME
  143: 'AJ',    // ADVENTURE JETSKI
  144: 'AP',    // ANDAMANDA
  176: 'BDR',   // BADARO JOIN CATAMARAN
  177: 'HW',    // BANANA BEACH (HW in old system)
  142: 'BR',    // BANGKEAW RAFTING
  161: 'BBXG',  // BANGLA BOXING
  173: 'BP',    // BIRD PARK
  160: 'BLP',   // BLUE PHOENIX
  136: 'BTC',   // BTC
  157: 'CARN',  // CARNIVAL
  164: 'COR',   // CORAL
  146: 'DD',    // D-DAY
  167: 'DIV',   // DIVING
  170: 'ECP',   // ELEPHANT CARE PARK
  178: 'EOB',   // ELEPHANT ON THE BEACH
  156: 'FAN',   // FANTASEA
  149: 'GR',    // GOLDEN REGION
  172: 'HC',    // HYPE CATAMARAN
  2:   'ITC',   // Island Tours Co
  147: 'JSC',   // JETSKI CLUB
  150: 'JPA',   // JP ANDAMAN
  145: 'KS',    // KINGSTAR
  141: 'LL',    // LANLALIN
  139: 'LA',    // LOVE ANDAMAN
  151: 'NIK',   // NIKORN
  171: 'PALM',  // PALM BEACH
  165: 'PBX',   // PATONG BOXING
  179: 'PTR',   // PATRIK
  140: 'PHP',   // PHENPETH
  152: 'PHC',   // PHUCHADA
  1:   'PA',    // Phuket Adventures
  175: 'PHM',   // PHUKET HONEYMOON
  153: 'PNT',   // PNT
  154: 'PPC',   // PP CRUISER
  163: 'PPN',   // PP NTC
  162: 'PRS',   // PRASERT
  148: 'RR',    // RAYA RESORT
  3:   'SE',    // Sea Explorer
  138: 'SS',    // SEA STAR
  158: 'SNIRAM',// SIAM NIRAMIT
  155: 'SIMON', // SIMON
  166: 'SMT',   // SMILE TOUR
  168: 'SUL',   // SULEMAN
  169: 'SYC',   // SUPER YACHT CLUB
  159: 'WUC',   // WAKE UP CLUB
  174: 'YHY',   // YONA (HYPE YACHT)
};

async function run() {
  try {
    // 1. Add tour_prices.article column if missing
    await pool.query(`ALTER TABLE tour_prices ADD COLUMN IF NOT EXISTS article VARCHAR(100) DEFAULT ''`);
    console.log('✓ tour_prices.article column ready');

    // 2. Set company articles
    let coOk = 0;
    for (const [id, article] of Object.entries(companyArticles)) {
      const r = await pool.query('UPDATE companies SET article=$1 WHERE id=$2 RETURNING name', [article, id]);
      if (r.rows.length) { console.log(`  ${article.padEnd(8)} ← ${r.rows[0].name}`); coOk++; }
    }
    console.log(`✓ ${coOk} company articles set\n`);

    // 3. Fill tour_prices.article = {company.article}-{tour.article}
    //    where both articles exist
    const result = await pool.query(`
      UPDATE tour_prices tp
      SET article = c.article || '-' || t.article
      FROM companies c, tours t
      WHERE tp.company_id = c.id
        AND tp.tour_id = t.id
        AND c.article != ''
        AND t.article != ''
      RETURNING tp.id, c.article as co, t.article as tour
    `);
    console.log(`✓ ${result.rows.length} tour_prices.article linked`);
    console.log('Samples:');
    result.rows.slice(0, 10).forEach(r => console.log(`  ${r.co}-${r.tour}`));

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

run();
