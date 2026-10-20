import { expect, test } from "bun:test";
import { createQueryController } from "./query-session";
import type { QueryResult } from "../db";
test("cambiar cierra antes de conectar, limpia resultados y no ejecuta SQL", async () => {
  const calls: string[] = [];
  const controller = createQueryController(async (name) => {
    calls.push(`connect:${name}`);
    return {
      close: async () => {
        calls.push(`close:${name}`);
      },
      execute: async () => {
        calls.push("execute");
        return { statements: [], durationMs: 1 };
      },
    };
  });
  await controller.reconnect("dev");
  await controller.execute("SELECT 1");
  expect(controller.state().query).toBe("success");
  await controller.switchConnection("prod");
  expect(calls).toEqual(["connect:dev", "execute", "close:dev", "connect:prod"]);
  expect(controller.state().result).toBeNull();
  expect(controller.state().query).toBe("idle");
  await controller.close();
});
test("no cambia mientras una consulta está ejecutándose", async () => {
  let resolve!: (result: QueryResult) => void;
  const pending = new Promise<QueryResult>((done) => {
    resolve = done;
  });
  let connects = 0;
  const controller = createQueryController(async () => {
    connects++;
    return { close: async () => {}, execute: () => pending };
  });
  await controller.reconnect();
  const executing = controller.execute("SELECT 1");
  await controller.switchConnection("prod");
  expect(connects).toBe(1);
  resolve({ statements: [], durationMs: 1 });
  await executing;
  await controller.close();
});
