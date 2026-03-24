import { useEffect, useRef, useState } from 'react';
import RankItem from './RankItem.jsx';
import { GET, PATCH_REQ, POST } from '../lib/api.js';
import { ANSWER_ICONS, ANSWER_LABELS } from '../lib/helpers.js';

export default function PlayerApp({ navigate, feedback, initialPin }) {
  const [screen, setScreen] = useState('join');
  const [pin, setPin] = useState(initialPin || '');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('🎓');
  const [error, setError] = useState('');
  const [statusInfo, setStatusInfo] = useState('Conectado - aguardando');
  const [timePerQ, setTimePerQ] = useState(20);
  const [totalQ, setTotalQ] = useState(0);
  const [currentQ, setCurrentQ] = useState(0);
  const [question, setQuestion] = useState(null);
  const [timeLeft, setTimeLeft] = useState(20);
  const [answered, setAnswered] = useState(false);
  const [selectedOption, setSelectedOption] = useState('');
  const [result, setResult] = useState({ icon: '🎉', text: 'Correto!', points: '+850 pts', ranking: '' });
  const [liveRank, setLiveRank] = useState([]);
  const [finalRanking, setFinalRanking] = useState([]);
  const pollRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => () => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    if (timerRef.current) window.clearInterval(timerRef.current);
  }, []);

  async function joinRoom() {
    if (pin.trim().length < 6) return setError('Digite o PIN de 6 digitos.');
    if (!name.trim()) return setError('Digite seu nome.');
    setError('');
    feedback.setLoadingMessage('Entrando na sala...');
    try {
      const games = await GET('games', `pin=eq.${pin}&select=*`);
      if (!games.length) throw new Error('Sala nao encontrada');
      if (games[0].status !== 'lobby') throw new Error('Este jogo ja foi iniciado');

      const duplicate = await GET('players', `pin=eq.${pin}&name=eq.${encodeURIComponent(name.trim())}&select=id`);
      if (duplicate.length) throw new Error('Este nome ja esta em uso nesta sala');

      const avatars = [
        '🦊', '🐯', '🦁', '🐸', '🐼', '🦋', '🐙', '🐬', '🦉', '🦒',
        '🐰', '🐻', '🐨', '🦓', '🦜', '🐢', '🐳', '🦭', '🦘', '🦔',
        '🐿️', '🦥', '🦩', '🐺', '🦝', '🦚', '🐧', '🦦', '🦎', '🐮',
        '🐷', '🐵', '🦛', '🦌', '🐞', '🐛', '🦢', '🦞', '🦀', '🐡',
      ];
      const players = await GET('players', `pin=eq.${pin}&select=id`);
      const nextAvatar = avatars[players.length % avatars.length];

      await POST('players', [{ pin, name: name.trim(), avatar: nextAvatar, score: 0, correct: 0 }]);
      setAvatar(nextAvatar);
      setTimePerQ(games[0].time_per_q);
      setTotalQ(games[0].total_q);
      setStatusInfo(`${players.length + 1} na sala - aguardando`);
      setScreen('waiting');
      feedback.toast('Voce entrou! Aguarde o professor.');
      startWaitingPoll(name.trim());
    } catch (joinError) {
      setError(joinError.message);
    } finally {
      feedback.setLoadingMessage('');
    }
  }

  function startWaitingPoll(playerName) {
    if (pollRef.current) window.clearInterval(pollRef.current);
    let lastQuestion = -1;
    pollRef.current = window.setInterval(async () => {
      try {
        const games = await GET('games', `pin=eq.${pin}&select=status,current_q,time_per_q,total_q`);
        if (!games.length) return;
        const game = games[0];
        const players = await GET('players', `pin=eq.${pin}&select=id`);
        setStatusInfo(`${players.length} na sala - aguardando`);

        if (game.status === 'playing' && game.current_q > lastQuestion) {
          lastQuestion = game.current_q;
          setCurrentQ(game.current_q);
          setTimePerQ(game.time_per_q);
          setTotalQ(game.total_q);
          window.clearInterval(pollRef.current);
          startQuestionScreen(playerName, game.current_q, game.time_per_q);
        }

        if (game.status === 'finished') {
          window.clearInterval(pollRef.current);
          showPlayerFinal();
        }
      } catch {
        // ignore waiting poll errors
      }
    }, 2000);
  }

  async function startQuestionScreen(playerName, questionIndex, duration) {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setAnswered(false);
    setSelectedOption('');
    setTimeLeft(duration);
    try {
      const rows = await GET('questions', `pin=eq.${pin}&idx=eq.${questionIndex}&select=*`);
      if (!rows.length) return;
      setQuestion(rows[0]);
      setScreen('question');
      updateLiveRank(playerName);

      timerRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            window.clearInterval(timerRef.current);
            setAnswered(true);
            setResult({ icon: '⏰', text: 'Tempo esgotado!', points: '+0 pts', ranking: '' });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      pollRef.current = window.setInterval(async () => {
        try {
          const games = await GET('games', `pin=eq.${pin}&select=status,current_q`);
          await updateLiveRank(playerName);
          if (!games.length) return;
          const game = games[0];
          if (game.status === 'finished') {
            window.clearInterval(pollRef.current);
            window.clearInterval(timerRef.current);
            showPlayerFinal();
            return;
          }
          if (game.status === 'playing' && game.current_q > questionIndex) {
            window.clearInterval(pollRef.current);
            window.clearInterval(timerRef.current);
            setCurrentQ(game.current_q);
            startQuestionScreen(playerName, game.current_q, duration);
          }
        } catch {
          // ignore
        }
      }, 2000);
    } catch (questionError) {
      feedback.toast(questionError.message, 'err');
    }
  }

  async function answerQuestion(option) {
    if (answered || !question) return;
    setAnswered(true);
    setSelectedOption(option);
    if (timerRef.current) window.clearInterval(timerRef.current);
    feedback.setLoadingMessage('Enviando...');
    try {
      const [questionRows, gameRows] = await Promise.all([
        GET('questions', `pin=eq.${pin}&idx=eq.${currentQ}&select=correct`),
        GET('games', `pin=eq.${pin}&select=time_per_q`),
      ]);
      const correct = questionRows[0]?.correct || 'A';
      const baseTime = gameRows[0]?.time_per_q || timePerQ;
      const isCorrect = option === correct;
      const points = isCorrect ? Math.round(500 + 500 * (timeLeft / baseTime)) : 0;

      try {
        await POST('answers', [{
          pin,
          question_idx: currentQ,
          player_name: name.trim(),
          option,
          time_left: timeLeft,
          is_correct: isCorrect,
          points,
        }]);
      } catch (postError) {
        if (!String(postError.message).includes('23505')) throw postError;
      }

      if (isCorrect) {
        const playerRows = await GET('players', `pin=eq.${pin}&name=eq.${encodeURIComponent(name.trim())}&select=score,correct`);
        if (playerRows.length) {
          await PATCH_REQ(
            'players',
            { score: playerRows[0].score + points, correct: playerRows[0].correct + 1 },
            `pin=eq.${pin}&name=eq.${encodeURIComponent(name.trim())}`
          );
        }
      }

      const rankingRows = await GET('players', `pin=eq.${pin}&select=name,score,avatar,correct&order=score.desc`);
      setLiveRank(rankingRows || []);
      const position = (rankingRows || []).findIndex((player) => player.name === name.trim()) + 1;
      setResult({
        icon: isCorrect ? '🎉' : '😢',
        text: isCorrect ? 'Correto!' : 'Errou!',
        points: isCorrect ? `+${points} pts` : '0 pts',
        ranking: position > 0 ? `Voce esta em #${position}` : '',
      });
    } catch (answerError) {
      feedback.toast(answerError.message, 'err');
    } finally {
      feedback.setLoadingMessage('');
    }
  }

  async function updateLiveRank(playerName) {
    try {
      const rankingRows = await GET('players', `pin=eq.${pin}&select=name,avatar,score,correct&order=score.desc`);
      setLiveRank(rankingRows || []);
      return rankingRows?.findIndex((player) => player.name === playerName) + 1;
    } catch {
      return 0;
    }
  }

  async function showPlayerFinal() {
    const data = await GET('players', `pin=eq.${pin}&select=*&order=score.desc`);
    setFinalRanking(data || []);
    setScreen('final');
  }

  const myPosition = liveRank.findIndex((player) => player.name === name.trim()) + 1;
  const myData = liveRank[myPosition - 1];

  function renderTopbar() {
    return (
      <div className="tb">
        <button className="btn btn-ghost btn-sm home-back" type="button" onClick={() => navigate('home')}>Home</button>
        <div className="logo">LB Conexao Quiz</div>
        <div className="rt-badge"><span className="rt-dot"></span> Aluno</div>
      </div>
    );
  }

  return (
    <>
      {screen === 'join' && (
        <div id="spj" className="scr on">
          {renderTopbar()}
          <div className="app-page-shell app-center-shell">
            <div className="section-eyebrow">Entrada do aluno</div>
            <div className="jlogo">LB Conexao Quiz</div>
            <div className="jcard">
              <div className="join-badge">Acesso rapido</div>
              <div className="page-guide student-guide">
                <h3>Orientacoes do aluno</h3>
                <p>Entre com atencao para participar sem erro.</p>
                <ul>
                  <li>Digite o PIN informado pelo professor.</li>
                  <li>Escolha o nome como deseja aparecer no ranking.</li>
                  <li>Responda rapido para ganhar mais pontos.</li>
                </ul>
              </div>
              <div className="join-highlights">
                <span>PIN ou QR Code</span>
                <span>Ranking ao vivo</span>
                <span>Pontos por agilidade</span>
              </div>
              <div className="jlbl">PIN da Sala</div>
              <input className="inp inp-pin" type="text" value={pin} onChange={(event) => setPin(event.target.value)} placeholder="000000" maxLength="6" inputMode="numeric" />
              <div className="jlbl">Seu Nome</div>
              <input className="inp" type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Como quer ser chamado?" style={{ textAlign: 'center', fontSize: '.95rem' }} />
              <div className="jerr" style={{ display: error ? 'block' : 'none' }}>{error}</div>
              <button className="btn btn-green btn-lg" type="button" style={{ width: '100%', justifyContent: 'center' }} onClick={joinRoom}>Entrar</button>
            </div>
          </div>
        </div>
      )}

      {screen === 'waiting' && (
        <div id="spw" className="scr on">
          {renderTopbar()}
          <div className="app-page-shell app-center-shell">
            <div className="section-eyebrow">Lobby</div>
            <div className="wava">{avatar}</div>
            <div className="wnm">{`Ola, ${name}!`}</div>
            <div className="wsub">Aguardando o professor iniciar...</div>
            <div className="dots"><span></span><span></span><span></span></div>
            <div className="winfo"><span className="rt-dot"></span> {statusInfo}</div>
            <div className="waiting-card">
              <strong>Prepare-se para responder rapido</strong>
              <span>Quanto mais cedo voce responder corretamente, maior sera sua pontuacao.</span>
            </div>
          </div>
        </div>
      )}

      {screen === 'question' && question && (
        <div id="spqa" className="scr on">
          {renderTopbar()}
          <div className="app-page-shell app-center-shell">
            <div className="section-eyebrow">Quiz ao vivo</div>
            <div className="question-meta-student">
              <span>Pergunta {currentQ + 1} de {totalQ}</span>
              <strong>{timeLeft}s restantes</strong>
            </div>
            <div className="pqtxt">{question.text}</div>
            <div className="ptbar"><div className="ptfil" style={{ width: `${(timeLeft / timePerQ) * 100}%`, background: timeLeft <= 5 ? 'var(--A)' : 'var(--acc)' }}></div></div>
            <div className="live-rank-shell">
              <div className="live-rank-head">
                <strong>Ranking ao vivo</strong>
                <span>{liveRank.length ? `${liveRank.length} jogadores` : 'Aguardando dados'}</span>
              </div>
              <div className="live-rank-self">
                {myPosition > 0 && myData ? `Voce esta em #${myPosition} com ${Number(myData.score || 0).toLocaleString()} pts` : 'Sua posicao aparecera aqui.'}
              </div>
              <div className="live-rank-list">
                {liveRank.slice(0, 5).map((player, index) => (
                  <div className={`live-rank-item ${player.name === name.trim() ? 'me' : ''}`} key={player.name}>
                    <span className="live-rank-pos">#{index + 1}</span>
                    <span className="live-rank-name">{player.avatar || '🎓'} {player.name}</span>
                    <span className="live-rank-score">{Number(player.score || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {!answered && (
              <div className="pg">
                {ANSWER_LABELS.map((label) => (
                  <button key={label} className={`pbtn ${label} ${selectedOption === label ? 'chosen' : ''}`} type="button" onClick={() => answerQuestion(label)}>
                    {ANSWER_ICONS[label]}
                  </button>
                ))}
              </div>
            )}

            {answered && (
              <div className="pres on">
                <div className="prico">{result.icon}</div>
                <div className="prtxt">{result.text}</div>
                <div className="prpts">{result.points}</div>
                <div className="prrnk">{result.ranking}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {screen === 'final' && (
        <div id="srnk" className="scr on">
          {renderTopbar()}
          <div className="app-page-shell app-center-shell">
            <div className="section-eyebrow">Resultado final</div>
            <div className="rkh"><h2>🏆 Ranking</h2><p>Resultado Final</p></div>
            <div className="section-banner section-banner-center">
              <div>
                <strong>Jogo encerrado</strong>
                <span>Confira sua colocacao final e acompanhe o desempenho da turma.</span>
              </div>
            </div>
            <div className="rklist">
              {finalRanking.map((player, index) => <RankItem key={player.name} player={player} index={index} />)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
