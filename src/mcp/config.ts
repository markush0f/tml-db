import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js";
import { projectDirectory, resolveDatabaseDsn, type DbHubOptions } from "../db/config";

export type { DbHubOptions } from "../db/config";

export async function dbHubLaunch(options: DbHubOptions = {}) {
  const dsn = await resolveDatabaseDsn(options);
  return {
    command: "node",
    args: [
      fileURLToPath(import.meta.resolve("@bytebase/dbhub")),
      "--transport",
      "stdio",
      "--config",
      resolve(projectDirectory, "config/dbhub.toml"),
    ],
    cwd: projectDirectory,
    // Credentials go through the environment, never command-line arguments.
    env: { ...getDefaultEnvironment(), DBHUB_DSN: dsn },
  };
}
