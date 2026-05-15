const http = require("node:http");
const next = require("next");

if (process.env.NODE_PORT && !process.env.PORT) {
  process.env.PORT = process.env.NODE_PORT;
}

const port = Number(process.env.PORT || 3000);
const hostname = "0.0.0.0";
const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

console.log(`[pulse] starting custom Next server on ${hostname}:${port}`);

app
  .prepare()
  .then(() => {
    http
      .createServer((req, res) => {
        handle(req, res);
      })
      .listen(port, hostname, () => {
        console.log(`[pulse] ready on ${hostname}:${port}`);
      });
  })
  .catch((error) => {
    console.error("[pulse] failed to start", error);
    process.exit(1);
  });
