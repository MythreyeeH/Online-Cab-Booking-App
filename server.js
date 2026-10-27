const http = require('http');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { URL } = require('url');
const admin = require('./routes/admin');

const PORT = Number(process.env.PORT || 3000);
const FRONTEND = path.resolve(__dirname, '../frontend');
const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg' };

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}
function serveStatic(pathname, res) {
  let requested = decodeURIComponent(pathname);
  if (requested === '/') requested = '/index.html';
  const filePath = path.resolve(FRONTEND, `.${requested}`);
  if (!filePath.startsWith(FRONTEND + path.sep) && filePath !== FRONTEND) {
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, content) => {
    if (err) { res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' }); return res.end('Page not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Methods':'GET,OPTIONS', 'Access-Control-Allow-Headers':'Content-Type' });
    return res.end();
  }
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/admin/summary') return sendJson(res, 200, await admin.getSummary());
    if (req.method === 'GET' && url.pathname === '/api/admin/bookings') return sendJson(res, 200, await admin.getBookings());
    if (req.method === 'GET' && url.pathname === '/api/admin/map-vehicles') return sendJson(res, 200, await admin.getMapVehicles());
    if (url.pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'API endpoint not found' });
    return serveStatic(url.pathname, res);
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { error: 'Server/database error. Check backend configuration and MySQL connection.' });
  }
});

server.listen(PORT, () => console.log(`Cab Booking app running at http://localhost:${PORT}`));
