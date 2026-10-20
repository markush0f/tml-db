export interface SchemaPreview {
  readonly name: string;
  readonly expanded: boolean;
  readonly tables: readonly string[];
}

export interface ResultPreview {
  readonly columns: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

export interface WorkspacePreview {
  readonly connectionName: string;
  readonly schemas: readonly SchemaPreview[];
  readonly query: string;
  readonly results: ResultPreview;
  readonly assistantMessage: string;
}

export const demoWorkspace: WorkspacePreview = {
  connectionName: "demo_local",
  schemas: [
    {
      name: "public",
      expanded: true,
      tables: [
        "users",
        "rooms",
        "room_participations",
        "games",
        "game_players",
        "coaches",
        "external_clubs",
        "match_contexts",
      ],
    },
    { name: "information_schema", expanded: false, tables: [] },
    { name: "pg_catalog", expanded: false, tables: [] },
  ],
  query: "SELECT id, name, email\nFROM public.users\nLIMIT 3;",
  results: {
    columns: ["id", "name", "email"],
    rows: [
      ["1", "Ana", "ana@example.com"],
      ["2", "Luis", "luis@example.com"],
      ["3", "Marta", "marta@example.com"],
    ],
  },
  assistantMessage: "Pregunta sobre tu base de datos",
};
