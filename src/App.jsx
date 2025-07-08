import React, { useState, useMemo, useEffect } from 'react';
import GuessRow from './components/GuessRow';
import champs from '../champs.json';

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

export default function App() {
  const [input, setInput] = useState('');
  const [guesses, setGuesses] = useState([]);

  const answer = useMemo(() => {
    const today = new Date();
    const idx = (dayOfYear(today) * 17) % champs.length; // 17 is arbitrary prime multiplier
    return champs[idx];
  }, []);

  const remaining = 8 - guesses.length;
  const won = guesses.some((g) => g.id === answer.id);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const champ = champs.find((c) => c.name.toLowerCase() === input.trim().toLowerCase());
    if (!champ) {
      alert('Champion not found!');
      return;
    }
    if (guesses.find((g) => g.id === champ.id)) {
      setInput('');
      return;
    }
    if (guesses.length >= 8 || won) return;
    setGuesses([...guesses, champ]);
    setInput('');
  };

  // Share Sheet after winning
  useEffect(() => {
    if (!won) return;

    const run = async () => {
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

      // Send lobby feed message first
      try {
        if (window.DiscordSDK?.commands?.lobbies?.sendLobbyMessage) {
          await window.DiscordSDK.commands.lobbies.sendLobbyMessage({
            content: shareText,
          });
        }
      } catch (err) {
        console.error('Error sending lobby message', err);
      }

      // Fallback: open share sheet for manual send
      if (window.DiscordSDK?.commands?.openShare) {
        window.DiscordSDK.commands.openShare({
          name: 'LoLdle',
          description: shareText,
          url: window.location.href,
        });
      }
    };

    run();
  }, [won]);

  return (
    <div className="app">
      <h1 className="title">LoLdle Daily final finished woo</h1>

      <form onSubmit={handleSubmit} className="guess-form">
        <input
          list="champions"
          placeholder="Guess a champion..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <datalist id="champions">
          {champs.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
        <button type="submit">Guess</button>
      </form>

      <div className="board">
        <div className="row header">
          <div className="cell name">Name</div>
          {ATTRIBUTES.map((a) => (
            <div key={a.key} className="cell">
              {a.label}
            </div>
          ))}
        </div>
        {guesses.map((g, idx) => (
          <GuessRow key={idx} champ={g} answer={answer} />
        ))}
      </div>

      {won && <div className="result success">🎉 You found {answer.name} in {guesses.length} guesses!</div>}
      {!won && remaining === 0 && (
        <div className="result fail">Out of guesses! The answer was {answer.name}.</div>
      )}

      <footer>
        <small>Data from Riot Games · {new Date().getFullYear()}</small>
      </footer>
    </div>
  );
} 