const { Pool } = require('pg');

const pool = new Pool({ host:'localhost', port:5432, database:'tour_crm', user:'postgres', password: process.env.PG_PASSWORD || '' });

// id → article
const articles = {
  375: '11ISL',
  430: 'KHAI-M',
  431: 'KHAI-A',
  376: '4POA',
  459: 'ALLEXC',
  379: 'AMPH',
  395: 'AND-T',
  396: 'AND-TT',
  6:   'ATV',
  445: 'AVT-HS',
  471: 'BB-PR',
  470: 'BB-SN',
  437: 'BX-ST',
  415: 'BX-STT',
  436: 'BX-VIP',
  414: 'BX-VIPT',
  457: 'BCHPK',
  462: 'BIRD-1',
  463: 'BIRD-2',
  419: 'CARN-D',
  421: 'CARN-DRT',
  420: 'CARN-DT',
  427: 'CARN-R',
  418: 'CARN',
  366: 'CL-1D',
  367: 'CL-STD',
  368: 'CL-VIP',
  386: 'CL-DLX',
  388: 'CL-STB',
  387: 'CL-STC',
  382: 'CL-SN',
  361: 'CITY',
  458: 'CLUBPK',
  412: 'COR-F',
  413: 'COR-H',
  434: 'DFT',
  442: 'DIV-RY',
  453: 'EL-A',
  454: 'EL-B',
  472: 'ELB',
  473: 'ELB-T',
  446: 'ELIZ',
  469: 'EDBB',
  423: 'FAN-D',
  425: 'FAN-DGT',
  444: 'FAN-DG',
  424: 'FAN-DT',
  426: 'FAN-G',
  422: 'FAN',
  432: 'FT',
  407: 'FISH',
  455: 'HONG',
  391: 'INST-S',
  392: 'INST-SS',
  406: 'JB-BB',
  1:   'JB',
  400: 'JB-SB',
  381: 'KL',
  477: 'KL-RU',
  475: 'KL-B1',
  476: 'KL-B2',
  9:   'KKN',
  385: 'KRABI',
  435: 'LPP-B',
  443: 'LPP-K',
  456: 'PALM',
  439: 'PBX-RS',
  440: 'PBX-ST',
  441: 'PBX-STT',
  364: 'PNG',
  363: 'PNG-SK',
  465: 'PNG-HY',
  380: 'PNG-SW',
  397: 'PP-K',
  428: 'PP-KMV',
  374: 'PP-2D',
  429: 'PP-BAM',
  464: 'PP-HY',
  2:   'PPI',
  408: 'PP-KBC',
  416: 'PP-RWT',
  378: 'PP-SR',
  451: 'PP-SRC',
  417: 'PP-RW',
  373: 'PP-BKM',
  377: 'PP-BRF',
  372: 'PP-KM',
  7:   'PLB',
  3:   'PYC',
  466: 'RA-CS',
  8:   'RACH',
  468: 'RA-CP',
  383: 'RAF-1',
  384: 'RAF-2',
  447: 'RAF-R1',
  448: 'RAF-R2',
  449: 'RAF-R3',
  450: 'RAF-R4',
  409: 'RAYA',
  410: 'RA-C',
  411: 'RA-CMR',
  393: 'RA-NM',
  460: 'RA-HYC',
  461: 'RA-HYT',
  474: 'RA-CF',
  371: 'RA-CM',
  438: 'RING',
  365: 'SN-CL',
  398: 'SATUN',
  399: 'SIM-R',
  394: 'SIM-CAT',
  370: 'SIM-EB',
  452: 'SIM-EBC',
  5:   'SIM',
  369: 'SIM-STD',
  403: 'SC-REG',
  404: 'SC-VIP',
  405: 'SC-T',
  362: 'SMKT',
  467: 'SSD',
  4:   'SDC',
  389: 'SUR-1D',
  390: 'SUR-2D',
  433: 'VFT',
  402: 'XXX-T',
  401: 'XXX',
};

async function run() {
  try {
    // First add the column if missing
    await pool.query(`ALTER TABLE tours ADD COLUMN IF NOT EXISTS article VARCHAR(100) DEFAULT ''`);
    console.log('Column ready');

    let ok = 0;
    for (const [id, article] of Object.entries(articles)) {
      await pool.query('UPDATE tours SET article=$1 WHERE id=$2', [article, id]);
      ok++;
    }
    console.log(`Updated ${ok} tours`);

    // Verify
    const res = await pool.query('SELECT id, name, article FROM tours WHERE article != \'\' ORDER BY name LIMIT 10');
    console.log('Sample:', res.rows.map(r => `${r.name} → ${r.article}`).join('\n'));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

run();
