// Builds a single-file preview for the claude.ai artifact: inlines scripts, drops the document
// wrapper (the artifact host adds its own), and hides Download PDF (printing is blocked there).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const html = readFileSync("public/index.html", "utf8");
const inline = (name) => `<script>\n${readFileSync(`public/${name}`, "utf8")}\n</script>`;
let out = html.slice(html.indexOf("<!--HEAD-START-->") + 17);
out = out.replace("<!--HEAD-END-->\n</head>\n<body>\n", "").replace(/<\/body>\s*<\/html>\s*$/, "")
  .replace('<script src="engine.js"></script>', inline("engine.js"))
  .replace('<script src="letter-template.js"></script>', inline("letter-template.js"))
  .replace("<script>\n(function(){", '<script>document.documentElement.dataset.preview="1";</script>\n<script>\n(function(){');
mkdirSync("dist", { recursive: true });
writeFileSync("dist/preview.html", out);
console.log("dist/preview.html", out.length, "bytes");
