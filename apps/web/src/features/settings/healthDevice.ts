/**
 * The id of this phone's Apple Health connection on the server (`deviceId` from POST /apple-health/connect). Kept on the
 * device so Sign out can name it and the server can revoke its upload token with the session (Contract 3). The key starts
 * with `logbook.`, so the shell's account wipe removes it.
 */
const KEY = 'logbook.health.device';
export const healthDeviceId = (): string | null => {
  try {
    return localStorage.getItem(KEY) || null;
  } catch {
    return null;
  }
};
export const rememberHealthDevice = (id: string | null | undefined) => {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode: sign out then revokes nothing by name; disconnecting on the phone still stops the uploads */
  }
};
