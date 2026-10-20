import { connectDbHub } from "./client";

try {
  const connection = await connectDbHub();
  try {
    const { tools } = await connection.client.listTools({}, { timeout: 10_000 });
    if (!tools.some((tool) => tool.name === "execute_sql"))
      throw new Error("DBHub no ofrece execute_sql.");
    const result = await connection.client.callTool(
      { name: "execute_sql", arguments: { sql: "SELECT 1 AS connected;" } },
      undefined,
      { timeout: 10_000 },
    );
    if (result.isError)
      throw new Error("La consulta de comprobación falló. Revisa tu configuración local.");
    console.log("DBHub local conectado por stdio (solo lectura).");
    console.log(`Herramientas: ${tools.map((tool) => tool.name).join(", ")}`);
    console.log("SELECT 1: OK");
  } finally {
    await connection.close();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "No se pudo comprobar DBHub local.");
  process.exitCode = 1;
}
