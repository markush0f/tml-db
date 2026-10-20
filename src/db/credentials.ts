export interface CredentialStore {
  get(name: string): Promise<string | null>;
  set(name: string, value: string): Promise<void>;
  delete(name: string): Promise<void>;
}
const service = "tml-db";
const unavailable = () =>
  new Error(
    "No se pudo acceder al llavero. Desbloquéalo y comprueba el servicio de credenciales del sistema.",
  );
export const systemCredentials: CredentialStore = {
  async get(name) {
    try {
      return await Bun.secrets.get({ service, name });
    } catch {
      throw unavailable();
    }
  },
  async set(name, value) {
    try {
      await Bun.secrets.set({ service, name, value, persist: "local" });
    } catch {
      throw unavailable();
    }
  },
  async delete(name) {
    try {
      await Bun.secrets.delete({ service, name });
    } catch {
      throw unavailable();
    }
  },
};
export async function credentialDsn(name: string, store = systemCredentials): Promise<string> {
  const value = await store.get(name);
  if (!value)
    throw new Error(
      "No hay credenciales en el llavero para esta conexión. Sustitúyelas en Gestionar conexiones.",
    );
  return value;
}
