const fs = require("fs");
const files = ["AGENTS.md", ".env.example", "README.md", "KNOWN_ISSUES.md", "CLAUDE.md"];
files.forEach(function (f) {
  try {
    let c = fs.readFileSync(f, "utf8");
    c = c.replace(/sb_secret_\w+/g, "sb_secret_R3MOVED");
    fs.writeFileSync(f, c);
  } catch (e) {}
});
