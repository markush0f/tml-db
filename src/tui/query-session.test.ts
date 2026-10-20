import { expect, test } from "bun:test";
import { createQueryController } from "./query-session";
import { QueryError, type QuerySession, type QueryResult } from "../mcp";
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const result: QueryResult = { statements: [], durationMs: 1 };
test("salida durante conexión cierra la adquisición tardía", async () => {
  const pending = deferred<QuerySession>(); let closed = 0;
  const controller = createQueryController(() => pending.promise);
  const connecting = controller.reconnect();
  const closing = controller.close();
  pending.resolve({ execute: async () => result, close: async () => { closed++; } });
  await connecting; await closing; await controller.close();
  expect(closed).toBe(1); expect(controller.state().connection).toBe("closed");
});
test("captura SQL, ignora duplicados y resoluciones tras cerrar", async () => {
  const pending = deferred<QueryResult>(); const calls: string[] = []; let closed = 0;
  const controller = createQueryController(async () => ({ execute: async (sql) => { calls.push(sql); return pending.promise; }, close: async () => { closed++; } }));
  await controller.reconnect();
  const running = controller.execute("SELECT 1"); await controller.execute("SELECT 2");
  expect(calls).toEqual(["SELECT 1"]); expect(controller.state().executedSql).toBe("SELECT 1");
  await controller.close(); pending.resolve(result); await running;
  expect(controller.state().connection).toBe("closed"); expect(controller.state().result).toBeNull(); expect(closed).toBe(1);
});
test("error SQL conserva sesión; timeout exige reconectar sin ejecutar", async () => {
  let factories = 0; let executions = 0;
  const controller = createQueryController(async () => { factories++; return { close: async () => {}, execute: async () => { executions++; throw new QueryError(executions === 1 ? "query" : "timeout"); } }; });
  await controller.reconnect(); await controller.execute("wrong");
  expect(controller.state().connection).toBe("ready");
  await controller.execute("slow"); expect(controller.state().connection).toBe("error");
  await controller.reconnect(); expect(factories).toBe(2); expect(executions).toBe(2);
  expect(controller.state().query).toBe("idle"); await controller.close();
});
