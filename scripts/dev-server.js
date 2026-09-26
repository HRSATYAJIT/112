// Local stand-in for Vercel: serves public/ and routes /api/<name> to api/<name>.js.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json" };
const port = Number(process.env.PORT) || 3000;

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.startsWith("/api/")) {
    const name = url.pathname.slice(5).replace(/[^a-z0-9-]/gi, "");
    let raw = ""; for await (const c of req) raw += c;
    try { req.body = raw ? JSON.parse(raw) : undefined; } catch { req.body = raw; }
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(o)); return res; };
    try { (await import(join(root, "api", `${name}.js`))).default(req, res); }
    catch (e) { res.statusCode = 404; res.end(`No API route ${name}: ${e.message}`); }
    return;
  }
  const path = normalize(url.pathname === "/" ? "/index.html" : url.pathname).replace(/^(\.\.[/\\])+/, "");
  try {
    const file = await readFile(join(root, "public", path));
    res.setHeader("content-type", types[extname(path)] || "application/octet-stream");
    res.end(file);
  } catch { res.statusCode = 404; res.end("Not found"); }
}).listen(port, () => console.log(`Pay Kit running on http://localhost:${port}`));
