import React, { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { CreateGameResponse, ErrorResponse, GameView, StoryMessage, TurnRequest, TurnResponse } from './api.types.js';
import { disableSound, enableSound } from './sound.js';
import './style.css';

const roomPath = ['cameretta', 'salone', 'camera_genitori'];

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json() as T | ErrorResponse;
  if (!response.ok) throw new Error((body as ErrorResponse).error ?? 'La casa non risponde. Riprova tra poco.');
  return body as T;
}

function App() {
  const [sessionId, setSessionId] = useState('');
  const [view, setView] = useState<GameView | null>(null);
  const [messages, setMessages] = useState<StoryMessage[]>([]);
  const [action, setAction] = useState('');
  const [thinking, setThinking] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const storyEnd = useRef<HTMLDivElement>(null);
  const soundOn = useRef(false);

  useEffect(() => storyEnd.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  async function startGame() {
    setBusy(true);
    setError('');
    try {
      const game = await requestJson<CreateGameResponse>('/api/game', { method: 'POST' });
      setSessionId(game.sessionId);
      setView(game.state);
      setMessages([{ role: 'narrator', text: game.intro }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Non riesco ad aprire la porta.');
    } finally {
      setBusy(false);
    }
  }

  async function sendAction(event?: FormEvent) {
    event?.preventDefault();
    const cleanAction = action.trim();
    if (!sessionId || !cleanAction || busy || view?.won) return;
    const playerMessage: StoryMessage = {
      role: 'player',
      text: cleanAction,
      ...(thinking.trim() ? { thinking: thinking.trim() } : {}),
    };
    setMessages((current) => [...current, playerMessage]);
    setAction('');
    setThinking('');
    setError('');
    setBusy(true);
    try {
      const payload: TurnRequest = {
        action: cleanAction,
        ...(playerMessage.thinking ? { thinking: playerMessage.thinking } : {}),
      };
      const result = await requestJson<TurnResponse>(`/api/game/${sessionId}/turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setView(result.state);
      setMessages((current) => [...current, { role: 'narrator', text: result.text }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Qualcosa si muove nel buio. Riprova.');
    } finally {
      setBusy(false);
    }
  }

  function useSuggestion(value: string) {
    setAction(value);
    document.querySelector<HTMLTextAreaElement>('#player-action')?.focus();
  }

  function onActionKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void sendAction();
    }
  }

  const currentRoomIndex = view ? roomPath.indexOf(view.room.id) : -1;

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="BadNight, inizio">
          <span className="brand-mark">☾</span><span>BAD<span className="brand-accent">NIGHT</span></span>
        </a>
        <div className="topbar-note"><span className="status-dot" /> UNA STORIA DA GIOCARE</div>
        <button className="reset-button" type="button" onClick={() => void startGame()} disabled={busy}>
          ↺ <span>Ricomincia</span>
        </button>
        <button
          className="sound-button"
          type="button"
          aria-pressed={soundEnabled}
          onClick={async () => {
            if (soundOn.current) {
              soundOn.current = false;
              disableSound();
              setSoundEnabled(false);
            } else {
              const enabled = await enableSound();
              soundOn.current = enabled;
              setSoundEnabled(enabled);
            }
          }}
        >
          {soundEnabled ? '♫ Musica attiva' : '♫ Attiva la musica'}
        </button>
      </header>

      <section className="intro-row" id="top">
        <div>
          <p className="eyebrow">LIVELLO 01 <span>·</span> LA PRIMA NOTTE</p>
          <h1>La casa fa<br /><em>strani rumori.</em></h1>
        </div>
        <p className="intro-copy">Un passo alla volta, una stanza alla volta.<br />I fantasmi sembrano conoscere la strada.</p>
      </section>

      {!view ? (
        <section className="start-card" aria-labelledby="start-title">
          <div className="ascii-door" aria-hidden="true">{`  .--------.\n  |  _  _  |\n  | | | | |\n  | | | | |\n  | |   o |\n  |_|_____|`}</div>
          <div className="start-copy">
            <p className="eyebrow">È TUTTO PRONTO</p>
            <h2 id="start-title">Ti sei svegliato?</h2>
            <p>La cameretta è buia. Il lettone di mamma e papà è dall’altra parte della casa. Forse i fantasmi possono aiutarti.</p>
            {error && <p className="error-message" role="alert">{error}</p>}
            <button className="primary-button" type="button" onClick={() => void startGame()} disabled={busy}>
              {busy ? 'La casa si sveglia…' : 'Entra nella storia'} <span aria-hidden="true">→</span>
            </button>
          </div>
        </section>
      ) : (
        <div className="game-grid">
          <aside className="side-panel">
            <section className="map-card" aria-labelledby="map-heading">
              <div className="section-heading"><span className="eyebrow">IL PERCORSO</span><span className="tiny-count">{view.progress.visited}/{view.progress.total}</span></div>
              <h2 id="map-heading">Una casa, tre stanze</h2>
              <div className="route-map" aria-label={`Sei in ${view.room.name}`}>
                {roomPath.map((room, index) => (
                  <React.Fragment key={room}>
                    <span className={`map-room ${currentRoomIndex === index ? 'current' : ''} ${currentRoomIndex > index ? 'passed' : ''}`}>
                      {room === 'cameretta' ? 'LETTO' : room === 'salone' ? 'SALONE' : 'LETTONE'}
                    </span>
                    {index < roomPath.length - 1 && <span className="map-link" aria-hidden="true">──</span>}
                  </React.Fragment>
                ))}
              </div>
              <div className="progress-track"><span style={{ width: `${Math.max(12, (view.progress.visited / view.progress.total) * 100)}%` }} /></div>
            </section>

            <section className="inventory-card" aria-labelledby="inventory-heading">
              <p className="eyebrow">NELLE TASCHE</p>
              <h2 id="inventory-heading">Piccoli tesori</h2>
              {view.inventory.length ? (
                <ul className="item-list">{view.inventory.map((item) => <li key={item.id}><span aria-hidden="true">✦</span>{item.name}</li>)}</ul>
              ) : <p className="empty-note">Per ora, niente.</p>}
            </section>

            <div className="side-whisper" aria-hidden="true">{`     .-"""-.\n    / .===. \\\n    \\ '===' /\n     '-...-'\n      (o o)\n      /|_|\\`}</div>
          </aside>

          <section className="play-panel" aria-label="Storia e azioni">
            <div className="room-heading">
              <div><p className="eyebrow">TI TROVI IN</p><h2>{view.room.name}</h2></div>
              <span className="moon-icon" aria-hidden="true">☾</span>
            </div>
            <p className="room-description">{view.room.description}</p>

            {(view.objects.length > 0 || view.ghosts.length > 0) && (
              <div className="discoveries">
                {view.objects.map((object) => <button key={object.id} type="button" onClick={() => useSuggestion(`Esamina ${object.name}.`)} disabled={busy}>⌕ {object.name}</button>)}
                {view.ghosts.map((ghost) => <button key={ghost.id} type="button" onClick={() => useSuggestion(`Parla con ${ghost.name}.`)} disabled={busy}>☻ {ghost.name}</button>)}
              </div>
            )}

            <div className="story-window" aria-live="polite" aria-label="Racconto">
              {messages.map((message, index) => (
                <article className={`story-message ${message.role}`} key={`${index}-${message.role}`}>
                  <span className="message-label">{message.role === 'player' ? 'TU' : 'LA CASA'}</span>
                  <p>{message.text}</p>
                  {message.thinking && <span className="thinking-note">Ti stai chiedendo: “{message.thinking}”</span>}
                </article>
              ))}
              {busy && <div className="thinking-indicator"><span className="status-dot" /> La casa sta ascoltando…</div>}
              <div ref={storyEnd} />
            </div>

            <div className="exits" aria-label="Passaggi">
              <span className="eyebrow">PASSAGGI</span>
              {view.exits.map((exit) => (
                <button
                  key={exit.to}
                  type="button"
                  className={`exit-button ${exit.open ? '' : 'locked'}`}
                  onClick={() => useSuggestion(`Vai ${exit.name.toLowerCase()}.`)}
                  disabled={busy || !exit.open || view.won}
                  title={exit.open ? exit.description : 'Il passaggio è ancora chiuso'}
                >
                  <span aria-hidden="true">{exit.open ? '↗' : '⊠'}</span> {exit.name}
                  {!exit.open && <span className="locked-label">CHIUSO</span>}
                </button>
              ))}
            </div>

            {view.won ? (
              <div className="win-banner" role="status">✦ Sei al sicuro nel lettone. Buonanotte! ✦</div>
            ) : (
              <form className="composer" onSubmit={(event) => void sendAction(event)}>
                <label htmlFor="player-action" className="eyebrow">COSA VUOI FARE?</label>
                <textarea id="player-action" value={action} onChange={(event) => setAction(event.target.value)} onKeyDown={onActionKey} maxLength={1000} placeholder="Es. Guardo sotto il letto…" rows={2} disabled={busy} />
                <details className="thinking-details">
                  <summary>Il tuo pensiero <span>(facoltativo)</span></summary>
                  <textarea value={thinking} onChange={(event) => setThinking(event.target.value)} maxLength={1000} placeholder="A cosa stai pensando?" rows={2} disabled={busy} />
                </details>
                {error && <p className="error-message" role="alert">{error}</p>}
                <div className="composer-footer">
                  <span className="key-hint">CTRL/⌘ + INVIO PER GIOCARE</span>
                  <button className="primary-button send-button" type="submit" disabled={busy || !action.trim()}>{busy ? '…' : 'Fai un passo'} <span aria-hidden="true">→</span></button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}

      <footer className="footer"><span>BADNIGHT <span className="brand-accent">✦</span> UNA PICCOLA STORIA DI FANTASMI</span><span>NESSUNO È SOLO NEL BUIO.</span></footer>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
