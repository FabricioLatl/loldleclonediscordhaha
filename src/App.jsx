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
        
        // Try different initialization approaches
        let sdk;
        
        // Method 1: Standard initialization
        try {
          sdk = new DiscordSDK('1392271229989294080');
          setDiscordSDK(sdk);
          log('SDK instance created');
        } catch (sdkErr) {
          log('Error creating SDK instance:', sdkErr.message);
          return;
        }
        
        log('Waiting for Discord ready...');
        
        // Add timeout to prevent hanging
        const readyPromise = sdk.ready();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Discord ready timeout after 10 seconds')), 10000)
        );
        
        try {
          await Promise.race([readyPromise, timeoutPromise]);
          setDiscordReady(true);
          log('Discord SDK ready!');
        } catch (readyErr) {
          log('Ready failed:', readyErr.message);
          
          // Try to continue anyway and see what commands are available
          setDiscordReady(true);
          log('Continuing without proper ready state...');
        }
        
        // Log available commands
        if (sdk.commands) {
          log('Available commands:', Object.keys(sdk.commands));
        } else {
          log('No commands available');
        }
        
        // Send start message
        try {
          if (discordSDK.commands?.shareLink) {
            log('Sending start message with shareLink...');
            await discordSDK.commands.shareLink({
              url: window.location.href,
              text: '🎮 Started playing LoLdle!'
            });
            log('Start message sent!');
          } else if (discordSDK.commands?.startPurchase) {
            log('Trying alternative method...');
            // This might not work but let's see what happens
          } else {
            log('No message sending methods available');
            log('Trying to call any share-related method...');
            
            // Let's try to call some methods that might exist
            const availableMethods = Object.keys(discordSDK.commands);
            const shareMethods = availableMethods.filter(method => 
              method.includes('share') || method.includes('Share') || method.includes('message') || method.includes('Message')
            );
            log('Share-related methods found:', shareMethods);
          }
        } catch (startErr) {
          log('Error sending start message:', startErr.message);
        }
        
      } catch (err) {
        log('Discord SDK initialization error:', err.message);
        log('Error stack:', err.stack);
        log('Running outside Discord or SDK not available');
        
        // Try to continue without Discord features
        setDiscordReady(false);
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
      
      log('Won! Skipping Discord integration, showing results screen...');
      setLobbyMessageSent(true);
    };

    sendLobbyMessage();
  }, [won, discordReady, discordSDK, lobbyMessageSent, guesses, answer, log]);

  // Generate emoji grid for display
  const getEmojiGrid = () => {
    if (!won) return null;
    
    return guesses.map((g) => {
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
  };

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

      {won && (
        <div className="results-screen">
          <div className="results-header">
            <h2>LoLdle Results</h2>
            <div className="score">Got it in {guesses.length}/8! 🎯</div>
          </div>
          
          <div className="emoji-grid">
            {getEmojiGrid()?.map((line, i) => (
              <div key={i} className="emoji-row">
                {line}
              </div>
            ))}
          </div>
          
          <div className="results-footer">
          
            <div className="game-info">
              LoLdle • {new Date().toLocaleDateString()}
            </div>
          </div>
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