export default function RankItem({ player, index, previousIndex = -1 }) {
  const medals = ['🥇', '🥈', '🥉'];
  let delta = null;

  if (previousIndex !== -1) {
    if (previousIndex > index) delta = <span className="delta du">▲{previousIndex - index}</span>;
    else if (previousIndex < index) delta = <span className="delta dd">▼</span>;
    else delta = <span className="delta de">—</span>;
  }

  return (
    <div className="rki" style={{ animationDelay: `${index * 0.05}s` }}>
      <div className="rk-medal">{medals[index] || `${index + 1}º`}</div>
      <div className="rk-ava">{player.avatar || '🎓'}</div>
      <div className="rk-name">{player.name}{delta}</div>
      <div className="rk-right">
        <div className="rk-score">{Number(player.score || 0).toLocaleString()}</div>
        <div className="rk-cor">✅ {player.correct || 0} certo{Number(player.correct || 0) !== 1 ? 's' : ''}</div>
      </div>
    </div>
  );
}
