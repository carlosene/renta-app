import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync, mkdirSync} from 'node:fs';
import {timingSafeEqual} from 'node:crypto';
const {APP_USER = 'admin', APP_PASS, PORT = 3000, DB_PATH = '/data/renta.db'} = process.env;
if (!APP_PASS) { console.error('Falta la variable APP_PASS (clave de acceso)'); process.exit(1); }
mkdirSync(DB_PATH.replace(/\/[^/]*$/, ''), {recursive: true});
const db = new DatabaseSync(DB_PATH);
db.exec('CREATE TABLE IF NOT EXISTS emps (ruc TEXT PRIMARY KEY, name TEXT, reg TEXT, data TEXT, updated TEXT)');
const html = readFileSync(new URL('./index.html', import.meta.url));
const eq = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
const body = req => new Promise((ok, no) => { let n = 0; const c = [];
  req.on('data', d => { n += d.length; if (n > 50e6) { no(new Error('Archivo muy grande')); req.destroy(); } else c.push(d); });
  req.on('end', () => ok(Buffer.concat(c).toString())); });
createServer(async (req, res) => {
  const send = (code, v, type = 'application/json') => { res.writeHead(code, {'Content-Type': type, 'Cache-Control': 'no-store'}); res.end(type === 'application/json' ? JSON.stringify(v) : v); };
  const [u, p] = Buffer.from((req.headers.authorization || '').slice(6), 'base64').toString().split(/:(.*)/s);
  if (!(eq(u || '', APP_USER) && eq(p || '', APP_PASS))) { res.writeHead(401, {'WWW-Authenticate': 'Basic realm="Renta"'}); return res.end(); }
  try {
    const path = new URL(req.url, 'http://x').pathname, m = path.match(/^\/api\/emp\/(\d{13})$/);
    if (req.method === 'GET' && (path === '/' || path === '/index.html')) return send(200, html, 'text/html; charset=utf-8');
    if (req.method === 'GET' && path === '/api/emps') return send(200, db.prepare('SELECT * FROM emps ORDER BY name').all().map(r => ({...r, data: JSON.parse(r.data)})));
    if (m && req.method === 'PUT') {
      const b = JSON.parse(await body(req));
      db.prepare('INSERT INTO emps VALUES (?,?,?,?,?) ON CONFLICT(ruc) DO UPDATE SET name=excluded.name, reg=excluded.reg, data=excluded.data, updated=excluded.updated')
        .run(m[1], String(b.name), String(b.reg), JSON.stringify(b.data), new Date().toISOString());
      return send(200, {ok: true});
    }
    if (m && req.method === 'DELETE') { db.prepare('DELETE FROM emps WHERE ruc=?').run(m[1]); return send(200, {ok: true}); }
    send(404, {error: 'No encontrado'});
  } catch(e){ send(500, {error: e.message}); }
}).listen(PORT, '0.0.0.0', () => console.log('Renta app en puerto ' + PORT));
