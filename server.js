const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

if (process.env.NODE_PORT && !process.env.PORT) {
  process.env.PORT = process.env.NODE_PORT;
}

if (!process.env.HOSTNAME || process.env.HOSTNAME.startsWith("/") || process.env.HOSTNAME.includes("extapp-sock")) {
  process.env.HOSTNAME = "0.0.0.0";
}

const standaloneServer = path.join(__dirname, ".next", "standalone", "server.js");

console.log(
  `[pulse] starting on port=${process.env.PORT || "3000"} hostname=${process.env.HOSTNAME || "default"} standalone=${fs.existsSync(standaloneServer)}`
);

if (fs.existsSync(standaloneServer)) {
  require(standaloneServer);
} else {
  console.warn("[pulse] standalone server not found; falling back to next start");
  const nextBin = path.join(__dirname, "node_modules", ".bin", "next");
  const child = spawn(nextBin, ["start"], { stdio: "inherit", env: process.env });

  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code || 0);
  });
}
