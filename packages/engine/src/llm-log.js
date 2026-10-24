// Log su file delle chiamate HTTP al provider LLM, per capire cosa è stato chiesto e cosa ha risposto.
//
// Intercetta il fetch globale del processo: il Gemini SDK e il client OpenAI-compatible del harness lo usano
// al momento della richiesta, e l'engine non fa altre chiamate fetch. Così il log copre ogni provider
// (e i tentativi ripetuti dall'SDK) senza toccare il harness.
//
// Il file si svuota a ogni avvio. Contiene richieste e risposte complete (quindi testo del giocatore e
// del modello) ma non le intestazioni, dove viaggiano le chiavi; un'eventuale chiave nell'URL è oscurata.

import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const SECRET_PARAMS = /([?&](?:key|api_key|apikey|access_token)=)[^&]+/gi;

// Restituisce stop(), che ripristina il fetch originale.
export function startLlmLog(file) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `# Chiamate al provider LLM, dall'avvio del ${new Date().toISOString()}\n`);

  const original = globalThis.fetch;
  let count = 0;

  globalThis.fetch = async function loggedFetch(input, init = {}) {
    const n = ++count;
    const started = Date.now();
    const method = init.method ?? input?.method ?? 'GET';
    const url = redact(String(input?.url ?? input));
    const write = (text) => appendFileSync(file, text);

    write(`\n=== #${n} ${new Date(started).toISOString()} ${method} ${url}\n`);
    if (init.body != null) write(`--- richiesta\n${pretty(init.body)}\n`);

    let response;
    try {
      response = await original(input, init);
    } catch (e) {
      write(`--- errore di rete dopo ${Date.now() - started} ms: ${e.message}${e.cause ? ` (${e.cause.message ?? e.cause})` : ''}\n`);
      throw e;
    }
    // La copia si legge in parallelo: chi ha chiamato riceve la risposta intatta.
    response
      .clone()
      .text()
      .then(
        (body) => write(`--- risposta ${response.status} ${response.statusText} in ${Date.now() - started} ms\n${pretty(body)}\n`),
        (e) => write(`--- risposta ${response.status} in ${Date.now() - started} ms, corpo illeggibile: ${e.message}\n`),
      );
    return response;
  };

  return () => {
    globalThis.fetch = original;
  };
}

function redact(url) {
  return url.replace(SECRET_PARAMS, '$1[oscurata]');
}

function pretty(body) {
  if (typeof body !== 'string') return `[corpo ${body?.constructor?.name ?? typeof body}]`;
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}
