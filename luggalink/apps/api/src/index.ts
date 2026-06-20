import "dotenv/config";
import { createApp } from "./app";

const port = process.env.PORT ?? 4000;
const app = createApp();

app.listen(port, () => {
  console.log(`LuggaLink API listening on port ${port}`);
});
