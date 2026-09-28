const DAY_MS = 24 * 60 * 60 * 1000;

// Read endpoints only return this snapshot. Only the background timer checks Neon.
export function createDatabaseMonitor(checkDatabase) {
  let snapshot = { ok: null, checkedAt: null, nextCheckAt: null };
  let timer;
  let stopped = true;

  async function check() {
    const checkedAt = new Date().toISOString();
    try {
      const database = await checkDatabase();
      snapshot = { ok: database.ok, database, checkedAt };
    } catch {
      snapshot = { ok: false, database: { ok: false }, checkedAt };
      console.error("Daily database check failed");
    }
    snapshot.nextCheckAt = new Date(Date.now() + DAY_MS).toISOString();
    if (!stopped) {
      timer = setTimeout(check, DAY_MS);
      timer.unref();
    }
  }

  return {
    snapshot: () => ({ ...snapshot }),
    start() {
      if (!stopped) return;
      stopped = false;
      return check();
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
    },
  };
}
