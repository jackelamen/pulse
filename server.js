const http = require("node:http");
const next = require("next");

if (process.env.NODE_PORT && !process.env.PORT) {
  process.env.PORT = process.env.NODE_PORT;
}

const port = Number(process.env.PORT || 3000);
const hostname = "0.0.0.0";
const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();
let ready = false;

process.on("uncaughtException", (error) => {
  console.error("[pulse] uncaught exception", formatError(error));
});

process.on("unhandledRejection", (reason) => {
  console.error("[pulse] unhandled rejection", formatError(reason));
});

console.log(`[pulse] starting custom Next server on ${hostname}:${port}`);

const server = http.createServer((req, res) => {
  console.log(`[pulse] ${req.method || "GET"} ${req.url || "/"}`);

  if (!ready) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Pulse is starting");
    return;
  }

  handle(req, res).catch((error) => {
    console.error(`[pulse] request failed ${req.method || "GET"} ${req.url || "/"}`, formatError(error));
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Pulse request failed. Check runtime logs.");
    } else {
      res.end();
    }
  });
});

server.listen(port, hostname, () => {
  console.log(`[pulse] listening on ${hostname}:${port}`);

  app
    .prepare()
    .then(() => {
      ready = true;
      console.log(`[pulse] ready on ${hostname}:${port}`);
    })
    .catch((error) => {
      console.error("[pulse] failed to start", error);
    process.exit(1);
  });

function formatError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    };
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
});
