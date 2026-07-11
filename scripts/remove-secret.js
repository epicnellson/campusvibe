const fs = require("fs");
const files = ["AGENTS.md", ".env.example", "README.md", "KNOWN_ISSUES.md", "CLAUDE.md"];
files.forEach((f) => {
  try {
    let c = fs.readFileSync(f, "utf8");
    let nc = c
      .replace(/sb_secret_\w+/g, "sb_secret_REMOVED")
      .replace(/SUPABASE_SECRET_KEY=.*/g, "SUPABASE_SECRET_KEY=sb_secret_REMOVED");
    if (nc !== c) fs.writeFileSync(f, nc);
  } catch (e) {
    // file may not exist in older commits
  }
});
