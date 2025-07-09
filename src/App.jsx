import React, { useState, useMemo, useEffect } from 'react';
import GuessRow from './components/GuessRow';
import champs from '../champs.json';
import { DiscordSDK } from '@discord/embedded-app-sdk';

const EMOJI_MAP = {
  correct: '🟩',
  partial: '🟨',
  wrong: '🟥',
  low: '🔼',
  high: '🔽',
};

const split = (str = '') => str.split(',').map((s) => s.trim());

const compareValue = (val, ans) => {
  if (val === undefined || ans === undefined) return 'wrong';
  if (val === ans) return 'correct';
  const valArr = split(val);
  const ansArr = split(ans);
  if (valArr.some((v) => ansArr.includes(v))) return 'partial';
  return 'wrong';
};

const ATTRIBUTES = [
  { key: 'region', label: 'Region' },
  { key: 'resource', label: 'Resource' },
  { key: 'lane', label: 'Lane' },
  { key: 'genre', label: 'Genre' },
  { key: 'attackType', label: 'Atk Type' },
  { key: 'gender', label: 'Gender' },
  { key: 'releaseDate', label: 'Year' },
];

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start + (start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// Simple hook to pipe debug messages into UI
function useDebug() {
  const [logs, setLogs] = useState([]);

  const log = (...args) => {
    const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    setLogs((prev) => [...prev.slice(-99), msg]); // keep last 100
    // Also forward to real console
    // eslint-disable-next-line no-console
    console.log(...args);
  };

  return [logs, log];
}

export default function App() {
  const [logs, log] = useDebug();
  const [input, setInput] = useState('');
  const [guesses, setGuesses] = useState([]);
  const [discordSDK, setDiscordSDK] = useState(null);
  const [discordReady, setDiscordReady] = useState(false);
  const [lobbyMessageSent, setLobbyMessageSent] = useState(false);

  const answer = useMemo(() => {
    const today = new Date();
    const idx = (dayOfYear(today) * 17) % champs.length;
    return champs[idx];
  }, []);

  const won = guesses.length > 0 && guesses[guesses.length - 1].name === answer.name;

  // Initialize Discord SDK
  useEffect(() => {
    const initDiscord = async () => {
      try {
        log('Initializing Discord SDK...');
        // You need to replace 'YOUR_CLIENT_ID' with your actual Discord app client ID
        const sdk = new DiscordSDK('1392271229989294080');
        setDiscordSDK(sdk);
        
        log('Waiting for Discord ready...');
        await sdk.ready();
        setDiscordReady(true);
        log('Discord SDK ready!');
        
        // Log available commands
        if (sdk.commands) {
          log('Available commands:', Object.keys(sdk.commands));
        }
      } catch (err) {
        log('Discord SDK initialization error:', err.message);
        log('Running outside Discord or SDK not available');
      }
    };

    // Only initialize once
    if (!discordSDK) {
      initDiscord();
    }
  }, []); // Empty dependency array - only run once

  // Send lobby message when won (only once)
  useEffect(() => {
    if (!won || lobbyMessageSent || !discordReady || !discordSDK) return;

    const sendLobbyMessage = async () => {
      const lines = guesses.map((g) => {
        const statuses = [
          compareValue(g.region, answer.region),
          compareValue(g.resource, answer.resource),
          compareValue(g.lane, answer.lane),
          compareValue(g.genre, answer.genre),
          compareValue(g.attackType, answer.attackType),
          compareValue(g.gender, answer.gender),
          g.releaseDate === answer.releaseDate
            ? 'correct'
            : g.releaseDate < answer.releaseDate
            ? 'low'
            : 'high',
        ];
        return statuses.map((s) => EMOJI_MAP[s] || '🟥').join('');
      });

      const shareText = `I solved LoLdle in ${guesses.length}/8\n${lines.join('\n')}`;
      
      log('Won! Attempting to send lobby message...');
      log('Share text:', shareText);

      try {
        // Try different possible methods for sending messages
        if (discordSDK.commands.sendActivityMessage) {
          log('Trying sendActivityMessage...');
          const result = await discordSDK.commands.sendActivityMessage({
            content: shareText,
          });
          log('sendActivityMessage result:', result);
          setLobbyMessageSent(true);
        }
        else if (discordSDK.commands.openShare) {
          log('Trying openShare as fallback...');
          const result = await discordSDK.commands.openShare({
            name: 'LoLdle',
            description: shareText,
          });
          log('openShare result:', result);
          setLobbyMessageSent(true);
        }
        else {
          log('No message sending method found!');
          log('Available methods:', discordSDK.commands ? Object.keys(discordSDK.commands) : 'none');
        }
      } catch (err) {
        log('Error sending message:', err.message);
        log('Error details:', err);
      }
    };

    sendLobbyMessage();
  }, [won, discordReady, discordSDK, lobbyMessageSent, guesses, answer, log]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const champ = champs.find((c) => c.name.toLowerCase() === input.toLowerCase());
    if (!champ) return;

    setGuesses((prev) => [...prev, champ]);
    setInput('');
  };

  return (
    <div className="app">
      <h1 className="title">LoLdle</h1>
      <form className="guess-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Guess a champion..."
          list="champions"
        />
        <datalist id="champions">
          {champs.map((champ) => (
            <option key={champ.name} value={champ.name} />
          ))}
        </datalist>
        <button type="submit">Guess</button>
      </form>

      {won && (
        <div className="win-message">
          🎉 You found {answer.name} in {guesses.length} guesses!
        </div>
      )}

      <div className="table">
        <div className="header">
          <div className="cell">Name</div>
          {ATTRIBUTES.map((attr) => (
            <div key={attr.key} className="cell">
              {attr.label}
            </div>
          ))}
        </div>
        {guesses.map((guess, i) => (
          <GuessRow key={i} champ={guess} answer={answer} />
        ))}
      </div>

      <div className="footer">Data from Riot Games • 2025</div>

      <details className="debug-box">
        <summary>Debug Log ({logs.length})</summary>
        <pre>{logs.join('\n')}</pre>
      </details>
    </div>
  );
} 