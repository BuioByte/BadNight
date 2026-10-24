// Descrizione leggibile di un errore per la console: segue la catena delle cause (e.cause) e, per gli
// errori HTTP del provider, estrae codice e messaggio dalla risposta JSON invece di stamparla grezza.

export function describeError(e) {
  const parts = [];
  for (let err = e, depth = 0; err && depth < 5; err = err.cause, depth++) parts.push(describeOne(err));
  return parts.join(' ← ');
}

function describeOne(err) {
  if (!(err instanceof Error)) return String(err);
  const name = err.name && err.name !== 'Error' ? `${err.name}: ` : '';
  const api = providerError(err);
  if (api) return `${name}${[api.code, api.status].filter(Boolean).join(' ')} ${api.message}`.trim();
  return `${name}${err.message}`;
}

// Gli errori del Gemini SDK hanno `status` e come messaggio il JSON della risposta:
// {"error":{"code":500,"message":"…","status":"INTERNAL"}}. Quelli OpenAI-compatible del harness
// riportano lo stato HTTP nel testo. Se il messaggio non è di questo tipo restituisce null.
function providerError(err) {
  const json = err.message?.slice(err.message.indexOf('{'));
  if (!json?.startsWith('{')) return null;
  try {
    const { error } = JSON.parse(json);
    if (!error) return null;
    return { code: error.code ?? err.status, status: error.status, message: error.message ?? '' };
  } catch {
    return null;
  }
}
