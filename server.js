if (process.env.NODE_PORT && !process.env.PORT) {
  process.env.PORT = process.env.NODE_PORT;
}

if (!process.env.HOSTNAME || process.env.HOSTNAME.startsWith("/") || process.env.HOSTNAME.includes("extapp-sock")) {
  process.env.HOSTNAME = "0.0.0.0";
}

require("./.next/standalone/server.js");
