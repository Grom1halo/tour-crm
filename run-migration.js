#!/usr/bin/env node
/**
 * Запускает миграцию через SSH-туннель к серверу 147.45.146.161
 *
 * Использование:
 *   node run-migration.js [--file path/to/dump.sql] [--dry-run] [--passphrase "ваш_passphrase"]
 *
 * Или через переменную окружения:
 *   SSH_PASSPHRASE="ваш_passphrase" node run-migration.js --file D:/Downloads/localhost.sql
 *
 * Если passphrase не указан — спросит интерактивно.
 */
'use strict';

const { Client: SSH2Client } = require('./sync-live/node_modules/ssh2');
const net  = require('net');
const path = require('path');
const fs   = require('fs');
const os   = require('os');
const readline = require('readline');

const TUNNEL_LOCAL_PORT = 15432;
const VPS_HOST = '147.45.146.161';
const VPS_USER = 'root';
const KEY_PATH = path.join(os.homedir(), '.ssh', 'id_ed25519');

const PG = {
  host:     '127.0.0.1',
  port:     TUNNEL_LOCAL_PORT,
  user:     process.env.PG_USER     || 'tour_user',
  password: process.env.PG_PASSWORD || '348004',
  database: process.env.PG_DB       || 'tour_crm',
};

const fileIdx = process.argv.indexOf('--file');
const DUMP_FILE = fileIdx !== -1 ? process.argv[fileIdx + 1] : 'D:/Downloads/localhost.sql';
const DRY_RUN  = process.argv.includes('--dry-run');
const ppIdx = process.argv.indexOf('--passphrase');
let PASSPHRASE = ppIdx !== -1 ? process.argv[ppIdx + 1] : (process.env.SSH_PASSPHRASE || null);

function askPassphrase() {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('SSH ключ зашифрован. Введите passphrase: ', ans => {
      rl.close();
      resolve(ans);
    });
  });
}

function openTunnel(passphrase) {
  return new Promise((resolve, reject) => {
    const ssh = new SSH2Client();
    const server = net.createServer(sock => {
      ssh.forwardOut('127.0.0.1', TUNNEL_LOCAL_PORT, '127.0.0.1', 5432, (err, stream) => {
        if (err) { sock.destroy(); return; }
        sock.pipe(stream).pipe(sock);
      });
    });

    server.listen(TUNNEL_LOCAL_PORT, '127.0.0.1', () => {
      console.log(`Туннель открыт: localhost:${TUNNEL_LOCAL_PORT} → ${VPS_HOST}:5432`);
    });

    ssh.on('ready', () => {
      console.log(`SSH подключён к ${VPS_HOST}`);
      resolve({ ssh, server });
    }).on('error', e => {
      server.close();
      reject(e);
    }).connect({
      host: VPS_HOST,
      port: 22,
      username: VPS_USER,
      privateKey: fs.readFileSync(KEY_PATH),
      passphrase: passphrase || undefined,
    });
  });
}

async function main() {
  if (!PASSPHRASE) {
    // Проверим, зашифрован ли ключ
    const keyContent = fs.readFileSync(KEY_PATH, 'utf8');
    if (keyContent.includes('ENCRYPTED') || keyContent.includes('Proc-Type')) {
      PASSPHRASE = await askPassphrase();
    }
  }

  console.log(`\nФайл дампа: ${DUMP_FILE}`);
  console.log(`Режим: ${DRY_RUN ? 'DRY RUN' : 'ЖИВАЯ МИГРАЦИЯ'}\n`);

  let tunnel;
  try {
    tunnel = await openTunnel(PASSPHRASE);
  } catch (e) {
    console.error('Ошибка SSH:', e.message);
    if (e.message.includes('passphrase') || e.message.includes('decrypt')) {
      console.error('Неверный passphrase');
    }
    process.exit(1);
  }

  // Запускаем migrate-from-dump.js через туннель
  process.env.PG_HOST     = PG.host;
  process.env.PG_PORT     = String(PG.port);
  process.env.PG_USER     = PG.user;
  process.env.PG_PASSWORD = PG.password;
  process.env.PG_DB       = PG.database;

  // Даём туннелю секунду стартовать
  await new Promise(r => setTimeout(r, 500));

  try {
    // Динамически импортируем и запускаем main из migrate-from-dump.js
    // Переопределяем argv чтобы передать нужные параметры
    const origArgv = process.argv.slice();
    process.argv = ['node', 'migrate-from-dump.js', '--file', DUMP_FILE];
    if (DRY_RUN) process.argv.push('--dry-run');

    // Сбросим кеш require чтобы перечитать файл с новыми env
    delete require.cache[require.resolve('./migrate-from-dump.js')];
    require('./migrate-from-dump.js');

    // Ждём завершения (migrate-from-dump.js вызывает process.exit сам)
    await new Promise(r => setTimeout(r, 120000));
  } finally {
    tunnel.server.close();
    tunnel.ssh.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
