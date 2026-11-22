import { homedir } from "node:os";
import path from "node:path";
import { createAcademy } from "./app.ts";

const port = Number(process.env.HARNESS_PORT ?? 4317);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("HARNESS_PORT 需在 0–65535 之间。");
const dataDir = path.resolve(process.env.HARNESS_DATA_DIR || path.join(homedir(), ".harness-academy"));
const { app, db } = createAcademy(dataDir);
const server = app.listen(port, "127.0.0.1", () => {
  const address = server.address();
  if (address && typeof address !== "string")
    console.log(`Harness Academy · http://127.0.0.1:${address.port}`);
});
server.on("error", () => {
  console.error("无法监听端口，请检查 HARNESS_PORT。");
  db.close();
  process.exitCode = 1;
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () =>
    server.close(() => {
      db.close();
    }),
  );
