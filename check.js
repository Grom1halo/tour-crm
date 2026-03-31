#!/usr/bin/env node
/**
 * Tour CRM — автоматическая проверка работоспособности
 *
 * Использование:
 *   node check.js [URL] [login] [password]
 *
 * Примеры:
 *   node check.js http://147.45.146.161 admin password123
 *   node check.js https://newdomain.com admin password123
 *
 * По умолчанию: http://147.45.146.161, admin / (из env ADMIN_PASS)
 */

const BASE_URL = process.argv[2] || 'http://147.45.146.161';
const LOGIN    = process.argv[3] || 'admin';
const PASS     = process.argv[4] || process.env.ADMIN_PASS || '';

const API = `${BASE_URL}/api`;

// ── helpers ──────────────────────────────────────────────────────────────────

let token = '';
let passed = 0, failed = 0, warned = 0;

async function req(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

const COLOR = {
  green:  s => `\x1b[32m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
};

function ok(label, detail = '') {
  passed++;
  console.log(`  ${COLOR.green('✓')} ${label}${detail ? COLOR.dim('  ' + detail) : ''}`);
}

function fail(label, detail = '') {
  failed++;
  console.log(`  ${COLOR.red('✗')} ${COLOR.red(label)}${detail ? COLOR.dim('  ' + detail) : ''}`);
}

function warn(label, detail = '') {
  warned++;
  console.log(`  ${COLOR.yellow('⚠')} ${label}${detail ? COLOR.dim('  ' + detail) : ''}`);
}

function section(title) {
  console.log(`\n${COLOR.bold(COLOR.cyan('── ' + title + ' ──'))}`);
}

async function check(label, fn) {
  try {
    const result = await fn();
    if (result === false) fail(label);
    else if (result === 'warn') warn(label);
    else ok(label, typeof result === 'string' ? result : '');
  } catch (e) {
    fail(label, e.message);
  }
}

// ── tests ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log(COLOR.bold(`\nTour CRM — проверка: ${BASE_URL}`));
  console.log(COLOR.dim(`Логин: ${LOGIN}  |  ${new Date().toLocaleString('ru-RU')}\n`));

  // 1. Связь с сервером
  section('1. Доступность сервера');

  await check('Frontend отвечает (GET /)', async () => {
    const res = await fetch(BASE_URL + '/');
    if (!res.ok && res.status !== 200) return false;
    const html = await res.text();
    if (!html.includes('<div id="root">') && !html.includes('<!DOCTYPE html')) return false;
    return `HTTP ${res.status}`;
  });

  await check('API отвечает (GET /api/auth/me → 401)', async () => {
    const r = await req('GET', '/auth/me');
    if (r.status !== 401) return false;
    return 'unauthorized как ожидается';
  });

  // 2. Авторизация
  section('2. Авторизация');

  if (!PASS) {
    warn('Пароль не задан — пропускаем авторизованные тесты', 'передайте: node check.js URL login password');
    console.log('\n' + summary());
    return;
  }

  await check('Неверный пароль → 401', async () => {
    const r = await req('POST', '/auth/login', { username: LOGIN, password: '__wrong__' });
    return r.status === 401;
  });

  await check(`Вход: ${LOGIN}`, async () => {
    const r = await req('POST', '/auth/login', { username: LOGIN, password: PASS });
    if (r.status !== 200 || !r.data?.token) return false;
    token = r.data.token;
    return `роли: ${(r.data.user?.roles || [r.data.user?.role]).join(', ')}`;
  });

  if (!token) {
    fail('Авторизация не удалась — дальнейшие тесты невозможны');
    console.log('\n' + summary());
    return;
  }

  await check('GET /auth/me → 200', async () => {
    const r = await req('GET', '/auth/me');
    return r.status === 200 && !!r.data?.id;
  });

  // 3. Справочные данные
  section('3. Справочники');

  let companyId, tourId, agentId, clientId, managerId;

  await check('Компании загружаются', async () => {
    const r = await req('GET', '/companies');
    if (r.status !== 200 || !Array.isArray(r.data)) return false;
    companyId = r.data[0]?.id;
    return `${r.data.length} записей`;
  });

  await check('Туры загружаются', async () => {
    const r = await req('GET', '/tours');
    if (r.status !== 200 || !Array.isArray(r.data)) return false;
    tourId = r.data[0]?.id;
    return `${r.data.length} записей`;
  });

  await check('Агенты загружаются', async () => {
    const r = await req('GET', '/agents');
    if (r.status !== 200 || !Array.isArray(r.data)) return false;
    agentId = r.data[0]?.id;
    return `${r.data.length} записей`;
  });

  await check('Клиенты загружаются', async () => {
    const r = await req('GET', '/clients');
    if (r.status !== 200 || !Array.isArray(r.data)) return false;
    clientId = r.data[0]?.id;
    return `${r.data.length} записей`;
  });

  await check('Менеджеры загружаются', async () => {
    const r = await req('GET', '/users/managers');
    if (r.status !== 200 || !Array.isArray(r.data)) return false;
    managerId = r.data[0]?.id;
    return `${r.data.length} записей`;
  });

  // 4. Ваучеры
  section('4. Ваучеры');

  let voucherId;

  await check('Список ваучеров (GET /vouchers)', async () => {
    const r = await req('GET', '/vouchers?limit=10');
    if (r.status !== 200) return false;
    const list = Array.isArray(r.data) ? r.data : r.data?.vouchers;
    if (!list) return false;
    voucherId = list.find(v => !v.is_deleted)?.id;
    return `${list.length} записей на странице`;
  });

  await check('Туры по компании (GET /vouchers/by-company/:id)', async () => {
    if (!companyId) return 'warn';
    const r = await req('GET', `/vouchers/by-company/${companyId}`);
    return r.status === 200 && Array.isArray(r.data);
  });

  await check('Компании по туру (GET /vouchers/by-tour/:id)', async () => {
    if (!tourId) return 'warn';
    const r = await req('GET', `/vouchers/by-tour/${tourId}`);
    return r.status === 200 && Array.isArray(r.data);
  });

  let newVoucherId;
  const today = new Date().toISOString().split('T')[0];

  await check('Создание ваучера (POST /vouchers)', async () => {
    if (!clientId || !companyId || !tourId) return 'warn';
    const r = await req('POST', '/vouchers', {
      tourType: 'group',
      clientId,
      companyId,
      tourId,
      tourDate: today,
      adults: 2, children: 0, infants: 0,
      adultNet: 100, childNet: 0, infantNet: 0, transferNet: 0, otherNet: 0,
      adultSale: 150, childSale: 0, infantSale: 0, transferSale: 0, otherSale: 0,
      agentCommissionPercentage: 0,
    });
    if (r.status !== 201 || !r.data?.id) return false;
    newVoucherId = r.data.id;
    return `ваучер #${r.data.voucher_number}`;
  });

  await check('Просмотр ваучера (GET /vouchers/:id)', async () => {
    const id = newVoucherId || voucherId;
    if (!id) return 'warn';
    const r = await req('GET', `/vouchers/${id}`);
    return r.status === 200 && r.data?.id === id;
  });

  await check('Обновление ваучера (PUT /vouchers/:id)', async () => {
    if (!newVoucherId) return 'warn';
    const r = await req('PUT', `/vouchers/${newVoucherId}`, {
      tourType: 'group', clientId, companyId, tourId, tourDate: today,
      adults: 3, children: 0, infants: 0,
      adultNet: 100, childNet: 0, infantNet: 0, transferNet: 0, otherNet: 0,
      adultSale: 160, childSale: 0, infantSale: 0, transferSale: 0, otherSale: 0,
      agentCommissionPercentage: 0,
    });
    return r.status === 200;
  });

  await check('Копирование ваучера (POST /vouchers/:id/copy)', async () => {
    const id = newVoucherId || voucherId;
    if (!id) return 'warn';
    const r = await req('POST', `/vouchers/${id}/copy`);
    if (r.status === 201) {
      // Cleanup copied voucher
      await req('DELETE', `/vouchers/${r.data.id}`);
      return `копия #${r.data.voucher_number}`;
    }
    return false;
  });

  let paymentId;
  await check('Добавление платежа (POST /payments)', async () => {
    if (!newVoucherId) return 'warn';
    const r = await req('POST', '/payments', {
      voucherId: newVoucherId, amount: 50,
      paymentMethod: 'cash', paymentDate: today, currency: 'THB',
    });
    if (r.status === 201 || r.status === 200) {
      paymentId = r.data?.id;
      return `платёж ${r.data?.amount} THB`;
    }
    return false;
  });

  await check('Удаление платежа (DELETE /payments/:id)', async () => {
    if (!paymentId) return 'warn';
    const r = await req('DELETE', `/payments/${paymentId}`);
    return r.status === 200;
  });

  await check('Удаление ваучера (DELETE /vouchers/:id)', async () => {
    if (!newVoucherId) return 'warn';
    const r = await req('DELETE', `/vouchers/${newVoucherId}`);
    return r.status === 200;
  });

  await check('Восстановление ваучера (POST /vouchers/:id/restore)', async () => {
    if (!newVoucherId) return 'warn';
    const r = await req('POST', `/vouchers/${newVoucherId}/restore`);
    if (r.status === 200) {
      // Cleanup: delete again
      await req('DELETE', `/vouchers/${newVoucherId}`);
      return true;
    }
    return false;
  });

  // 5. Отчёты
  section('5. Отчёты');

  const monthStart = new Date(); monthStart.setDate(1);
  const df = monthStart.toISOString().split('T')[0];
  const dt = today;

  await check('Итоги (GET /reports/totals)', async () => {
    const r = await req('GET', `/reports/totals?dateFrom=${df}&dateTo=${dt}`);
    return r.status === 200 && r.data?.voucher_count !== undefined;
  });

  await check('Сводный отчёт (GET /reports/summary)', async () => {
    const r = await req('GET', `/reports/summary?dateFrom=${df}&dateTo=${dt}&groupBy=manager`);
    return r.status === 200 && Array.isArray(r.data);
  });

  await check('Платежи (GET /reports/payments)', async () => {
    const r = await req('GET', `/reports/payments?dateFrom=${df}&dateTo=${dt}`);
    return r.status === 200;
  });

  await check('Детальный отчёт (GET /reports/detail)', async () => {
    const r = await req('GET', `/reports/detail?dateFrom=${df}&dateTo=${dt}`);
    return r.status === 200 && Array.isArray(r.data);
  });

  await check('Excel бухгалтерия (GET /reports/export/daily)', async () => {
    const res = await fetch(`${API}/reports/export/daily?dateFrom=${df}&dateTo=${dt}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status !== 200) return false;
    const ct = res.headers.get('content-type') || '';
    return ct.includes('spreadsheetml') || ct.includes('octet-stream')
      ? 'xlsx получен'
      : 'warn';
  });

  await check('Excel менеджер (GET /reports/export/manager)', async () => {
    const res = await fetch(`${API}/reports/export/manager?dateFrom=${df}&dateTo=${dt}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status !== 200) return false;
    const ct = res.headers.get('content-type') || '';
    return ct.includes('spreadsheetml') || ct.includes('octet-stream');
  });

  await check('Excel хотлайн (GET /reports/export/hotline)', async () => {
    const res = await fetch(`${API}/reports/export/hotline?date=${today}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status !== 200) return false;
    const ct = res.headers.get('content-type') || '';
    return ct.includes('spreadsheetml') || ct.includes('octet-stream');
  });

  // 6. Хотлайн
  section('6. Хотлайн');

  await check('Ваучеры на дату (GET /vouchers?tourDateFrom=...)', async () => {
    const r = await req('GET', `/vouchers?tourDateFrom=${today}&tourDateTo=${today}&limit=100`);
    if (r.status !== 200) return false;
    const list = Array.isArray(r.data) ? r.data : r.data?.vouchers || [];
    return `${list.length} ваучеров на ${today}`;
  });

  // Итог
  console.log('\n' + summary());
}

function summary() {
  const total = passed + failed + warned;
  const line = '─'.repeat(40);
  let s = `${COLOR.dim(line)}\n`;
  s += `${COLOR.bold('Результат:')}  `;
  s += `${COLOR.green(`✓ ${passed} ок`)}   `;
  if (failed > 0) s += `${COLOR.red(`✗ ${failed} ошибок`)}   `;
  if (warned > 0) s += `${COLOR.yellow(`⚠ ${warned} предупреждений`)}   `;
  s += `${COLOR.dim(`/ ${total} всего`)}`;
  if (failed === 0) s += `\n\n${COLOR.green(COLOR.bold('Всё работает — можно переносить!'))}`;
  else s += `\n\n${COLOR.red(COLOR.bold(`Есть проблемы — исправьте перед переносом.`))}`;
  return s;
}

run().catch(e => {
  console.error(COLOR.red('Критическая ошибка: ' + e.message));
  process.exit(1);
});
