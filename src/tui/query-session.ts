import { createSignal } from "solid-js";
import { QueryError, type QueryResult, type QuerySession } from "../mcp";

export type SessionFactory = () => Promise<QuerySession>;
export interface QueryState {
  connection: "connecting" | "ready" | "error" | "closed";
  query: "idle" | "running" | "success" | "error";
  result: QueryResult | null;
  message: string;
  executedSql: string | null;
}
export function createQueryController(connect: SessionFactory) {
  const [state, setState] = createSignal<QueryState>({ connection: "connecting", query: "idle", result: null, message: "", executedSql: null });
  let session: QuerySession | undefined;
  let pending: Promise<void> | undefined;
  let disposed = false;
  let closing: Promise<void> | undefined;
  async function reconnect() {
    if (disposed || pending || session) return;
    setState({ connection: "connecting", query: "idle", result: null, message: "", executedSql: null });
    pending = (async () => {
      try {
        const acquired = await connect();
        if (disposed) { await acquired.close().catch(() => {}); return; }
        session = acquired;
        setState((s) => ({ ...s, connection: "ready" }));
      } catch {
        if (!disposed) setState((s) => ({ ...s, connection: "error", message: new QueryError("connection").message }));
      }
    })();
    try { await pending; } finally { pending = undefined; }
  }
  async function execute(sql: string) {
    if (disposed || !session || state().connection !== "ready" || state().query === "running" || !sql.trim()) return;
    const current = session;
    setState({ connection: "ready", query: "running", result: null, message: "", executedSql: sql });
    try {
      const result = await current.execute(sql);
      if (!disposed) setState((s) => ({ ...s, query: "success", result }));
    } catch (error) {
      if (disposed) return;
      const safe = error instanceof QueryError ? error : new QueryError("connection");
      const disconnected = safe.code === "connection" || safe.code === "timeout";
      if (disconnected) {
        session = undefined;
        await current.close().catch(() => {});
      }
      if (!disposed) setState((s) => ({ ...s, connection: disconnected ? "error" : "ready", query: "error", message: safe.message }));
    }
  }
  function close(): Promise<void> {
    if (closing) return closing;
    disposed = true;
    setState((s) => ({ ...s, connection: "closed" }));
    const current = session;
    session = undefined;
    closing = (async () => {
      await current?.close().catch(() => {});
      await pending;
    })();
    return closing;
  }
  return { state, reconnect, execute, close };
}
