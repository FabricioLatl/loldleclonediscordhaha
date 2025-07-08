import React from 'react';

const split = (str = '') => str.split(',').map((s) => s.trim());

const compareValue = (val, ans) => {
  if (val === undefined || ans === undefined) return 'unknown';
  if (val === ans) return 'correct';
  // handle comma-separated fields
  const valArr = split(val);
  const ansArr = split(ans);
  if (valArr.some((v) => ansArr.includes(v))) return 'partial';
  return 'wrong';
};

export default function GuessRow({ champ, answer }) {
  const statuses = {
    region: compareValue(champ.region, answer.region),
    resource: compareValue(champ.resource, answer.resource),
    lane: compareValue(champ.lane, answer.lane),
    genre: compareValue(champ.genre, answer.genre),
    attackType: compareValue(champ.attackType, answer.attackType),
    gender: compareValue(champ.gender, answer.gender),
    releaseDate:
      champ.releaseDate === answer.releaseDate
        ? 'correct'
        : champ.releaseDate < answer.releaseDate
        ? 'low'
        : 'high',
  };

  return (
    <div className="row">
      <div className="cell name champ-name">{champ.name}</div>
      <div className={`cell ${statuses.region}`}>{champ.region}</div>
      <div className={`cell ${statuses.resource}`}>{champ.resource}</div>
      <div className={`cell ${statuses.lane}`}>{champ.lane}</div>
      <div className={`cell ${statuses.genre}`}>{champ.genre}</div>
      <div className={`cell ${statuses.attackType}`}>{champ.attackType}</div>
      <div className={`cell ${statuses.gender}`}>{champ.gender}</div>
      <div className={`cell ${statuses.releaseDate}`}>{champ.releaseDate}</div>
    </div>
  );
} 