const http = require('http'); const fs = require('fs'); const path = require('path');
const PORT = 3000; const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm' };
http.createServer((req, res) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  let file = req.url === '/' ? './index.html' : '.' + req.url;
  fs.readFile(file, (err, content) => {
    if (err) { res.writeHead(404); res.end('Not found'); } 
    else { res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(content, 'utf-8'); }
  });
}).listen(PORT, () => console.log('Server running on port ' + PORT));
