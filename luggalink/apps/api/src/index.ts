import "dotenv/config";
import { createApp } from "./app";
import { registerJobs } from "./jobs";

const port = process.env.PORT ?? 4000;
const app = createApp();

registerJobs();

app.listen(port, () => {
  console.log(`LuggaLink API listening on port ${port}`);
});
