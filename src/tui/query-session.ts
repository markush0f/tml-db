import { createSignal } from "solid-js";
import {
  QueryError,
  tablePreviewSql,
  type QueryResult,
  type QuerySession,
  type TableCatalog,
  type DatabaseTable,
  type ColumnCatalog,
} from "../db";

export interface ColumnState {
  table: DatabaseTable | null;
  status: "idle" | "loading" | "ready" | "error";
  catalog: ColumnCatalog | null;
}

export type SessionFactory = (name?: string) => Promise<QuerySession>;
export interface QueryState {
  connection: "connecting" | "ready" | "error" | "closed";
  query: "idle" | "running" | "success" | "error";
  result: QueryResult | null;
  message: string;
  executedSql: string | null;
  resultTable?: DatabaseTable;
  writeEnabled?: boolean;
}
export function createQueryController(connect: SessionFactory) {
  const [state, setState] = createSignal<QueryState>({
    connection: "connecting",
    query: "idle",
    result: null,
    message: "",
    executedSql: null,
  });
  const emptyTables = { status: "idle" as const, catalog: null };
  const [tables, setTables] = createSignal<{
    status: "idle" | "loading" | "ready" | "error";
    catalog: TableCatalog | null;
  }>(emptyTables);
  const emptyColumns: ColumnState = { table: null, status: "idle", catalog: null };
  const [columns, setColumns] = createSignal<ColumnState>(emptyColumns);
  let columnRequest = 0;
  function clearColumns() {
    columnRequest++;
    setColumns(emptyColumns);
  }
  let session: QuerySession | undefined;
  async function selectTable(table: DatabaseTable) {
    const current = session;
    if (disposed || !current || state().connection !== "ready" || state().query === "running")
      return;
    const selected = columns().table;
    if (
      selected?.schema === table.schema &&
      selected.name === table.name &&
      columns().status !== "error"
    ) {
      clearColumns();
      return;
    }
    const request = ++columnRequest;
    setColumns({ table, status: "loading", catalog: null });
    try {
      if (!current.listColumns) throw new QueryError("protocol");
      const catalog = await current.listColumns(table);
      if (!disposed && session === current && request === columnRequest)
        setColumns({ table, status: "ready", catalog });
    } catch (error) {
      if (disposed || session !== current) return;
      if (request === columnRequest) setColumns({ table, status: "error", catalog: null });
      if (
        error instanceof QueryError &&
        (error.code === "connection" || error.code === "timeout")
      ) {
        session = undefined;
        clearColumns();
        setState((s) => ({
          ...s,
          connection: "error",
          query: "error",
          result: null,
          message: error.message,
        }));
        await current.close().catch(() => {});
      }
    }
  }
  async function refreshTables() {
    const current = session;
    if (disposed || !current || tables().status === "loading" || state().query === "running")
      return;
    if (!current.listTables) {
      setTables({ status: "error", catalog: null });
      return;
    }
    clearColumns();
    setTables({ status: "loading", catalog: null });
    try {
      const catalog = await current.listTables();
      if (!disposed && session === current) setTables({ status: "ready", catalog });
    } catch (error) {
      if (disposed || session !== current) return;
      setTables({ status: "error", catalog: null });
      if (
        error instanceof QueryError &&
        (error.code === "connection" || error.code === "timeout")
      ) {
        session = undefined;
        setState((s) => ({
          ...s,
          connection: "error",
          query: "error",
          result: null,
          message: error.message,
        }));
        await current.close().catch(() => {});
      }
    }
  }
  let pending: Promise<void> | undefined;
  let disposed = false;
  let closing: Promise<void> | undefined;
  let selectedName: string | undefined;
  async function reconnect(name = selectedName, replace = false) {
    if (disposed || pending || state().query === "running" || (session && !replace)) return;
    selectedName = name;
    const previous = session;
    session = undefined;
    clearColumns();
    setTables(emptyTables);
    setState({
      connection: "connecting",
      query: "idle",
      result: null,
      message: "",
      executedSql: null,
    });
    pending = (async () => {
      try {
        if (previous) {
          await previous.close().catch(() => {});
          if (disposed) return;
        }
        const acquired = await connect(selectedName);
        if (disposed) {
          await acquired.close().catch(() => {});
          return;
        }
        session = acquired;
        setState((s) => ({
          ...s,
          connection: "ready",
          writeEnabled: acquired.writeEnabled === true,
        }));
        void refreshTables();
      } catch {
        if (!disposed)
          setState((s) => ({
            ...s,
            connection: "error",
            message: new QueryError("connection").message,
          }));
      }
    })();
    try {
      await pending;
    } finally {
      pending = undefined;
    }
  }
  async function browseTable(table: DatabaseTable) {
    if (disposed || !session || state().connection !== "ready" || state().query === "running")
      return;
    const selected = columns().table;
    if (
      selected?.schema !== table.schema ||
      selected.name !== table.name ||
      columns().status === "error"
    )
      void selectTable(table);
    await execute(tablePreviewSql(table), table);
  }
  async function execute(sql: string, table?: DatabaseTable) {
    if (
      disposed ||
      !session ||
      state().connection !== "ready" ||
      state().query === "running" ||
      !sql.trim()
    )
      return;
    const current = session;
    setState({
      connection: "ready",
      query: "running",
      writeEnabled: current.writeEnabled === true,
      result: null,
      message: "",
      executedSql: table ? null : sql,
      resultTable: table,
    });
    try {
      const result =
        table && current.readTable ? await current.readTable(table) : await current.execute(sql);
      if (!disposed && session === current) setState((s) => ({ ...s, query: "success", result }));
    } catch (error) {
      if (disposed || session !== current) return;
      const safe = error instanceof QueryError ? error : new QueryError("connection");
      const disconnected = safe.code === "connection" || safe.code === "timeout";
      if (disconnected) {
        session = undefined;
        setTables(emptyTables);
        clearColumns();
        await current.close().catch(() => {});
      }
      if (!disposed)
        setState((s) => ({
          ...s,
          connection: disconnected ? "error" : "ready",
          query: "error",
          message: safe.message,
        }));
    }
  }
  function close(): Promise<void> {
    if (closing) return closing;
    disposed = true;
    clearColumns();
    setTables(emptyTables);
    setState((s) => ({ ...s, connection: "closed" }));
    const current = session;
    session = undefined;
    closing = (async () => {
      await current?.close().catch(() => {});
      await pending;
    })();
    return closing;
  }
  return {
    state,
    tables,
    refreshTables,
    columns,
    selectTable,
    browseTable,
    reconnect,
    switchConnection: (name: string) => reconnect(name, true),
    execute,
    close,
  };
}
