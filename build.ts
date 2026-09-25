#!/usr/bin/env node
/* Single-file build: strip types from core.ts + ui.ts, inline into
 * dist/index.html. No npm dependencies. */

import { stripTypeScriptTypes } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL(".", import.meta.url).pathname;

const coreJs = stripTypeScriptTypes(readFileSync(ROOT + "src/core.ts", "utf8"), {
  mode: "strip",
});
let uiJs = stripTypeScriptTypes(readFileSync(ROOT + "src/ui.ts", "utf8"), {
  mode: "strip",
});
uiJs = uiJs.replace(
  /^import\s*{[\s\S]*?}\s*from\s*"\.\/core\.ts";\n/m,
  "// core.ts (inlined below)\n",
);
uiJs = "// core.ts\n" + coreJs + "\n" + uiJs;

const template = readFileSync(ROOT + "index.template.html", "utf8");
const html = template.replace("/*__GAME__*/", uiJs);

mkdirSync(ROOT + "dist", { recursive: true });
writeFileSync(ROOT + "dist/index.html", html);
console.log(`dist/index.html written (${html.length} bytes) — works offline`);
