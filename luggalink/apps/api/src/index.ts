import "dotenv/config";
import { createServer } from "node:http";
import { createApp } from "./app";
import { initSocket } from "./config/socket";
import { registerJobs } from "./jobs";

const port = process.env.PORT ?? 4000;
const app = createApp();
const httpServer = createServer(app);

initSocket(httpServer);
registerJobs();

httpServer.listen(port, () => {
  console.log(`LuggaLink API listening on port ${port}`);
});
