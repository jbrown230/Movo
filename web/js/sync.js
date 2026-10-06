// Respaldo opcional en el servidor. Solo viajan los movimientos ya extraídos,
// las reglas y los ajustes; los correos se quedan en el teléfono.
// Protocolo: push de lo "dirty" + pull de lo que cambió desde el último cursor.

export async function api(path, { token, method = 'GET', body } = {}) {
  const r = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(data.error || 'Error ' + r.status); e.status = r.status; throw e; }
  return data;
}

export async function syncNow(repo, token) {
  let pulled = 0, pushed = 0, rounds = 0;
  for (;;) {
    const changes = repo.dirty(500);
    const since = repo.meta('sync_cursor', 0);
    const res = await api('/sync', { token, method: 'POST', body: { since, changes } });
    repo.markClean(changes);
    pulled += repo.applyRemote(res.changes || {});
    pushed += changes.tx.length + changes.rule.length + changes.setting.length;
    repo.setMeta('sync_cursor', res.cursor);
    repo.setMeta('last_sync', Date.now());
    if (!res.more && repo.pendingCount() === 0) break;
    if (++rounds > 20) break;
  }
  return { pulled, pushed };
}
