import "dotenv/config";
import { createServer } from "node:http";
import { createApp } from "./app";
import { initSocket } from "./config/socket";
import { loadProductionSecrets } from "./config/secrets";
import { registerJobs } from "./jobs";

async function main() {
  await loadProductionSecrets();

  const port = process.env.PORT ?? 4000;
  const app = createApp();
  const httpServer = createServer(app);

  initSocket(httpServer);
  registerJobs();

  httpServer.listen(port, () => {
    console.log(`LuggaLink API listening on port ${port}`);
  });
}

void main();
