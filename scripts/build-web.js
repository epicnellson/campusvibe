const { existsSync, mkdirSync, readdirSync, statSync, copyFileSync } = require("fs");
const { join } = require("path");

function copy(src, dst) {
  if (!existsSync(src)) return;
  if (statSync(src).isDirectory()) {
    mkdirSync(dst, { recursive: true });
    for (const entry of readdirSync(src)) {
      copy(join(src, entry), join(dst, entry));
    }
  } else {
    copyFileSync(src, dst);
  }
}

// admin -> dist/admin (directory as subdirectory)
if (existsSync("admin")) {
  copy("admin", join("dist", "admin"));
}
// public/* -> dist/ (contents of public into dist)
if (existsSync("public")) {
  for (const entry of readdirSync("public")) {
    copy(join("public", entry), join("dist", entry));
  }
}
