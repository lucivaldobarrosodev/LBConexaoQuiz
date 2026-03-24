import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import RankItem from './RankItem.jsx';
import TopBar from './TopBar.jsx';
import { GET, POST, PATCH_REQ, DEL } from '../lib/api.js';
import { ANSWER_ICONS, ANSWER_LABELS, buildAppUrl, createEmptyQuestion, csvEscape, DEMO_QUESTIONS, DRAFT_KEY, resizeQuestions } from '../lib/helpers.js';

export default function ProfessorApp({ navigate, feedback }) {
  const [screen, setScreen] = useState('setup');
  const [tab, setTab] = useState('new');
  const [quizTitle, setQuizTitle] = useState('LB Conexao Quiz');
  const [qCount, setQCount] = useState(10);
  const [qTime, setQTime] = useState(20);
  const [questions, setQuestions] = useState(() => resizeQuestions([], 10));
  const [banks, setBanks] = useState([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [editBankId, setEditBankId] = useState(null);
  const [editBankName, setEditBankName] = useState('');
  const [pin, setPin] = useState('');
  const [lobbyPlayers, setLobbyPlayers] = useState([]);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [currentQ, setCurrentQ] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [answerCounts, setAnswerCounts] = useState({ A: 0, B: 0, C: 0, D: 0, total: 0 });
  const [revealed, setRevealed] = useState(false);
  const [ranking, setRanking] = useState([]);
  const [prevRank, setPrevRank] = useState([]);
  const [finalRanking, setFinalRanking] = useState([]);
  const [importNonce, setImportNonce] = useState(0);
  const pollRef = useRef(null);
  const timerRef = useRef(null);

  const totalQ = questions.length;
  const currentQuestion = questions[currentQ];
  const joinUrl = pin ? buildAppUrl('aluno', pin) : '';
  const isLastQuestion = currentQ >= totalQ - 1;
  const rankingLabel = isLastQuestion ? 'Resultado Final' : `Apos pergunta ${currentQ + 1} de ${totalQ}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft?.questions?.length) return;
      setQuizTitle(draft.title || 'LB Conexao Quiz');
      setQTime(Number(draft.timePerQ) || 20);
      setQCount(draft.questions.length);
      setQuestions(draft.questions.map((q, index) => ({ ...createEmptyQuestion(index), ...q })));
    } catch {
      // ignore invalid draft
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ title: quizTitle, timePerQ: qTime, questions }));
  }, [quizTitle, qTime, questions]);

  useEffect(() => {
    setQuestions((prev) => resizeQuestions(prev, qCount));
  }, [qCount]);

  useEffect(() => {
    if (screen !== 'lobby' || !pin) return undefined;
    const run = async () => {
      try {
        const data = await GET('players', `pin=eq.${pin}&select=name,avatar&order=joined_at.asc`);
        setLobbyPlayers(data || []);
      } catch {
        // ignore
      }
    };
    run();
    pollRef.current = window.setInterval(run, 2000);
    return () => clearPoll();
  }, [screen, pin]);

  useEffect(() => {
    if (screen !== 'question' || revealed || !pin) return undefined;

    const loadCounts = async () => {
      try {
        const data = await GET('answers', `pin=eq.${pin}&question_idx=eq.${currentQ}&select=option`);
        const counts = { A: 0, B: 0, C: 0, D: 0 };
        (data || []).forEach((row) => {
          if (counts[row.option] !== undefined) counts[row.option] += 1;
        });
        setAnswerCounts({ ...counts, total: (data || []).length });
      } catch {
        // ignore
      }
    };

    loadCounts();
    pollRef.current = window.setInterval(loadCounts, 1500);
    timerRef.current = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearTimer();
          handleReveal();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    PATCH_REQ('games', { current_q: currentQ }, `pin=eq.${pin}`).catch(() => {});
    return () => {
      clearPoll();
      clearTimer();
    };
  }, [screen, revealed, pin, currentQ]);

  useEffect(() => {
    if (screen !== 'lobby' || !pin) return;
    QRCode.toDataURL(joinUrl, { width: 148, margin: 1 }).then(setQrDataUrl).catch(() => setQrDataUrl(''));
  }, [screen, pin, joinUrl]);

  useEffect(() => () => {
    clearPoll();
    clearTimer();
  }, []);

  const rankingWithDelta = useMemo(() => ranking.map((player) => ({
    ...player,
    previousIndex: prevRank.findIndex((item) => item.name === player.name),
  })), [ranking, prevRank]);

  function clearPoll() {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function clearTimer() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function updateQuestion(index, field, value) {
    setQuestions((prev) => prev.map((question, qIndex) => (
      qIndex === index ? { ...question, [field]: value } : question
    )));
  }

  function validateQuiz() {
    if (!questions.length) return 'Adicione pelo menos 1 pergunta.';
    for (let i = 0; i < questions.length; i += 1) {
      const q = questions[i];
      if (!q.text?.trim()) return `Preencha o texto da pergunta ${i + 1}.`;
      if (!q.A?.trim() || !q.B?.trim() || !q.C?.trim() || !q.D?.trim()) return `Preencha todas as alternativas da pergunta ${i + 1}.`;
    }
    return '';
  }

  async function loadBanks() {
    setBankLoading(true);
    try {
      const data = await GET('banks', 'select=bank_id,bank_name,created_at&order=created_at.desc');
      const map = {};
      (data || []).forEach((row) => {
        if (!map[row.bank_id]) map[row.bank_id] = { ...row, count: 0 };
        map[row.bank_id].count += 1;
      });
      setBanks(Object.values(map));
    } catch (error) {
      feedback.toast(error.message, 'err');
    } finally {
      setBankLoading(false);
    }
  }

  async function openBank(bankId, bankName, editMode = false) {
    feedback.setLoadingMessage('Carregando banco...');
    try {
      const data = await GET('banks', `select=*&bank_id=eq.${bankId}&order=idx.asc`);
      const loaded = (data || []).map((row, index) => ({
        ...createEmptyQuestion(index),
        text: row.text,
        A: row.opt_a,
        B: row.opt_b,
        C: row.opt_c,
        D: row.opt_d,
        correct: row.correct,
      }));
      setQCount(loaded.length || 10);
      setQuestions(loaded.length ? loaded : resizeQuestions([], 10));
      setQuizTitle(bankName);
      setEditBankId(editMode ? bankId : null);
      setEditBankName(editMode ? bankName : '');
      setTab('new');
      feedback.toast(editMode ? `Banco "${bankName}" pronto para edicao!` : `Banco "${bankName}" carregado!`);
    } catch (error) {
      feedback.toast(error.message, 'err');
    } finally {
      feedback.setLoadingMessage('');
    }
  }

  async function saveBank() {
    const validation = validateQuiz();
    if (validation) return feedback.toast(validation, 'err');
    const wasEditing = Boolean(editBankId);
    const bankId = editBankId || `bank_${Date.now()}`;
    feedback.setLoadingMessage(wasEditing ? 'Atualizando banco...' : 'Salvando banco...');
    try {
      if (wasEditing) await DEL('banks', `bank_id=eq.${editBankId}`);
      const rows = questions.map((question, index) => ({
        bank_id: bankId,
        bank_name: quizTitle || 'Banco sem nome',
        idx: index,
        text: question.text,
        opt_a: question.A,
        opt_b: question.B,
        opt_c: question.C,
        opt_d: question.D,
        correct: question.correct,
      }));
      await POST('banks', rows);
      setEditBankId(bankId);
      setEditBankName(quizTitle || 'Banco sem nome');
      feedback.toast(wasEditing ? `Banco "${quizTitle}" atualizado!` : `Banco "${quizTitle}" salvo!`);
    } catch (error) {
      feedback.toast(error.message, 'err');
    } finally {
      feedback.setLoadingMessage('');
    }
  }

  async function removeBank(bankId) {
    if (!window.confirm('Apagar este banco de perguntas?')) return;
    feedback.setLoadingMessage('Apagando...');
    try {
      await DEL('banks', `bank_id=eq.${bankId}`);
      await loadBanks();
      feedback.toast('Banco apagado!');
    } catch (error) {
      feedback.toast(error.message, 'err');
    } finally {
      feedback.setLoadingMessage('');
    }
  }

  async function createRoom() {
    const validation = validateQuiz();
    if (validation) return feedback.toast(validation, 'err');
    feedback.setLoadingMessage('Criando sala...');
    try {
      let nextPin = '';
      let exists = true;
      while (exists) {
        nextPin = String(Math.floor(100000 + Math.random() * 900000));
        const data = await GET('games', `pin=eq.${nextPin}&select=pin`);
        exists = data.length > 0;
      }

      await POST('games', [{
        pin: nextPin,
        title: quizTitle || 'LB Conexao Quiz',
        status: 'lobby',
        current_q: 0,
        total_q: questions.length,
        time_per_q: qTime,
      }]);

      await POST('questions', questions.map((question, index) => ({
        pin: nextPin,
        idx: index,
        text: question.text,
        opt_a: question.A,
        opt_b: question.B,
        opt_c: question.C,
        opt_d: question.D,
        correct: question.correct,
      })));

      setPin(nextPin);
      setCurrentQ(0);
      setTimeLeft(qTime);
      setAnswerCounts({ A: 0, B: 0, C: 0, D: 0, total: 0 });
      setRevealed(false);
      setLobbyPlayers([]);
      setScreen('lobby');
      feedback.toast(`Sala criada! PIN: ${nextPin}`);
    } catch (error) {
      feedback.toast(error.message, 'err');
    } finally {
      feedback.setLoadingMessage('');
    }
  }

  async function startGame() {
    feedback.setLoadingMessage('Iniciando jogo...');
    try {
      await PATCH_REQ('games', { status: 'playing', current_q: 0 }, `pin=eq.${pin}`);
      setCurrentQ(0);
      setTimeLeft(qTime);
      setRevealed(false);
      setAnswerCounts({ A: 0, B: 0, C: 0, D: 0, total: 0 });
      setScreen('question');
    } catch (error) {
      feedback.toast(error.message, 'err');
    } finally {
      feedback.setLoadingMessage('');
    }
  }

  function handleReveal() {
    clearPoll();
    clearTimer();
    setRevealed(true);
  }

  async function openRanking() {
    try {
      const data = await GET('players', `pin=eq.${pin}&select=*&order=score.desc`);
      setPrevRank(ranking);
      setRanking(data || []);
      setScreen('ranking');
    } catch (error) {
      feedback.toast(error.message, 'err');
    }
  }

  function continueGame() {
    setCurrentQ((prev) => prev + 1);
    setTimeLeft(qTime);
    setRevealed(false);
    setAnswerCounts({ A: 0, B: 0, C: 0, D: 0, total: 0 });
    setScreen('question');
  }

  async function finishGame() {
    feedback.setLoadingMessage('Finalizando...');
    try {
      await PATCH_REQ('games', { status: 'finished' }, `pin=eq.${pin}`);
      const data = await GET('players', `pin=eq.${pin}&select=*&order=score.desc`);
      setFinalRanking(data || []);
      setScreen('final');
    } catch (error) {
      feedback.toast(error.message, 'err');
    } finally {
      feedback.setLoadingMessage('');
    }
  }

  async function exportFinalReport() {
    feedback.setLoadingMessage('Gerando relatorio...');
    try {
      const [players, answers, questionRows] = await Promise.all([
        GET('players', `pin=eq.${pin}&select=*&order=score.desc`),
        GET('answers', `pin=eq.${pin}&select=*`),
        GET('questions', `pin=eq.${pin}&select=idx,text,correct&order=idx.asc`),
      ]);

      const answerMap = {};
      (answers || []).forEach((answer) => {
        answerMap[`${answer.player_name}::${answer.question_idx}`] = answer;
      });

      const headers = ['Posicao', 'Nome', 'Avatar', 'Pontuacao', 'Acertos'];
      (questionRows || []).forEach((q) => {
        const number = Number(q.idx) + 1;
        headers.push(`Pergunta ${number}`, `Resposta ${number}`, `Correta ${number}`, `Acertou ${number}`, `Pontos ${number}`, `Tempo Restante ${number}`);
      });

      const rows = [headers.join(';')];
      (players || []).forEach((player, index) => {
        const row = [index + 1, player.name, player.avatar || '', player.score || 0, player.correct || 0];
        (questionRows || []).forEach((q) => {
          const answer = answerMap[`${player.name}::${q.idx}`];
          row.push((q.text || '').replace(/;/g, ','));
          row.push(answer?.option || '');
          row.push(q.correct || '');
          row.push(answer ? (answer.is_correct ? 'Sim' : 'Nao') : 'Nao respondeu');
          row.push(answer?.points ?? 0);
          row.push(answer?.time_left ?? '');
        });
        rows.push(row.map(csvEscape).join(';'));
      });

      const blob = new Blob([`\ufeff${rows.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `lb-conexao-quiz-relatorio-${pin}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      feedback.toast('Relatorio exportado em CSV!');
    } catch (error) {
      feedback.toast(error.message, 'err');
    } finally {
      feedback.setLoadingMessage('');
    }
  }

  function loadDemo() {
    setQuestions(resizeQuestions([], qCount).map((_, index) => DEMO_QUESTIONS[index % DEMO_QUESTIONS.length]));
    feedback.toast('Perguntas de exemplo aplicadas!');
  }

  function exportQuiz() {
    const validation = validateQuiz();
    if (validation) return feedback.toast(validation, 'err');
    const payload = { title: quizTitle, timePerQ: qTime, questions };
    const safeName = (quizTitle || 'quiz')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'quiz';
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${safeName}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    feedback.toast('Quiz exportado em JSON!');
  }

  function importQuiz(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result || '{}'));
        const loaded = (payload.questions || []).map((question, index) => ({
          ...createEmptyQuestion(index),
          text: question.text || question.pergunta || `Pergunta ${index + 1}`,
          A: question.A || question.a || question.opt_a || '',
          B: question.B || question.b || question.opt_b || '',
          C: question.C || question.c || question.opt_c || '',
          D: question.D || question.d || question.opt_d || '',
          correct: question.correct || question.correta || 'A',
        }));
        setQuizTitle(payload.title || payload.nome || 'LB Conexao Quiz');
        setQTime(Number(payload.timePerQ || payload.tempoPorPergunta || 20));
        setQCount(loaded.length || 10);
        setQuestions(loaded.length ? loaded : resizeQuestions([], 10));
        feedback.toast('Quiz importado com sucesso!');
      } catch (error) {
        feedback.toast(`Arquivo invalido: ${error.message}`, 'err');
      } finally {
        setImportNonce((value) => value + 1);
      }
    };
    reader.readAsText(file);
  }

  function clearQuiz() {
    if (!window.confirm('Limpar o quiz atual e apagar o rascunho local?')) return;
    localStorage.removeItem(DRAFT_KEY);
    setQuizTitle('LB Conexao Quiz');
    setQTime(20);
    setQCount(10);
    setQuestions(resizeQuestions([], 10));
    setEditBankId(null);
    setEditBankName('');
    feedback.toast('Formulario limpo!');
  }

  return (
    <>
      {screen === 'setup' && (
        <div id="ss" className="scr on">
          <TopBar navigate={navigate} rightContent={<><span className="rt-dot"></span> Supabase</>} />
          <div className="app-page-shell sw">
            <div className="page-hero-card">
              <div className="section-eyebrow">Painel do professor</div>
              <div className="ph">Monte seu quiz ao vivo</div>
              <div className="ps">Crie uma sala, carregue um banco salvo e acompanhe a turma em tempo real.</div>
            </div>
            <div className="page-guide">
              <h3>Orientacoes do professor</h3>
              <p>Organize o quiz com calma antes de abrir a sala.</p>
              <ul>
                <li>Defina um nome claro para o quiz.</li>
                <li>Revise perguntas, alternativas e tempo por questao.</li>
                <li>Use banco salvo quando quiser reaproveitar atividades.</li>
                <li>Ao final, exporte o relatorio para acompanhar o desempenho.</li>
              </ul>
            </div>

            <div className="setup-overview">
              <article className="setup-stat">
                <span className="setup-stat-label">Perguntas</span>
                <strong>{qCount}</strong>
                <small>Estrutura atual do quiz</small>
              </article>
              <article className="setup-stat">
                <span className="setup-stat-label">Tempo por pergunta</span>
                <strong>{qTime}s</strong>
                <small>Ritmo definido para a rodada</small>
              </article>
              <article className="setup-stat">
                <span className="setup-stat-label">Modo atual</span>
                <strong>{editBankId ? 'Edicao' : 'Criacao'}</strong>
                <small>{editBankId ? 'Atualizando um banco salvo' : 'Montando um novo quiz'}</small>
              </article>
            </div>

            <div className="tabs">
              <button className={`tab ${tab === 'new' ? 'on' : ''}`} type="button" onClick={() => setTab('new')}>Novo Quiz</button>
              <button className={`tab ${tab === 'saved' ? 'on' : ''}`} type="button" onClick={() => { setTab('saved'); loadBanks(); }}>Bancos Salvos</button>
            </div>

            {tab === 'new' && (
              <div id="panel-new">
                <div className="cfg">
                  <div className="cf" style={{ flex: 2, minWidth: '185px' }}>
                    <label>Nome do Quiz</label>
                    <input type="text" value={quizTitle} onChange={(event) => setQuizTitle(event.target.value)} placeholder="Ex: Matematica 9A" />
                  </div>
                  <div className="cf">
                    <label>Perguntas</label>
                    <select value={qCount} onChange={(event) => setQCount(Number(event.target.value))}>
                      {[5, 10, 15, 20].map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </div>
                  <div className="cf">
                    <label>Tempo / Pergunta</label>
                    <select value={qTime} onChange={(event) => setQTime(Number(event.target.value))}>
                      {[10, 20, 30, 60].map((value) => <option key={value} value={value}>{value} seg</option>)}
                    </select>
                  </div>
                </div>

                {editBankId && (
                  <div className="bank-edit">
                    <div>
                      <strong>Modo edicao</strong>
                      <span>{`Editando "${editBankName}"`}</span>
                    </div>
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setEditBankId(null); setEditBankName(''); }}>Cancelar edicao</button>
                  </div>
                )}

                <div className="qlist">
                  {questions.map((question, index) => (
                    <div className="qcard" key={`q-${index}`}>
                      <div className="qtop">
                        <div className="qbadge">{index + 1}</div>
                        <input className="qinp" value={question.text} onChange={(event) => updateQuestion(index, 'text', event.target.value)} placeholder={`Pergunta ${index + 1}...`} />
                      </div>
                      <div className="og">
                        {ANSWER_LABELS.map((label) => (
                          <div className="ol" key={`${index}-${label}`}>
                            <div className={`od ${label}`}>{ANSWER_ICONS[label]}</div>
                            <input className="oi" value={question[label]} onChange={(event) => updateQuestion(index, label, event.target.value)} placeholder={`Opcao ${label}`} />
                          </div>
                        ))}
                      </div>
                      <div className="qfoot">
                        <label>Correta:</label>
                        <select className="csel" value={question.correct} onChange={(event) => updateQuestion(index, 'correct', event.target.value)}>
                          {ANSWER_LABELS.map((label) => <option key={label} value={label}>{label}</option>)}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>

                <input key={importNonce} id="quiz-import" type="file" accept="application/json,.json" hidden onChange={importQuiz} />
                <div className="action-groups">
                  <div className="sa">
                    <button className="btn btn-yellow" type="button" onClick={loadDemo}>Exemplo</button>
                    <button className="btn btn-blue" type="button" onClick={() => feedback.toast('Rascunho salvo neste dispositivo!')}>Salvar Rascunho</button>
                    <button className="btn btn-acc" type="button" onClick={exportQuiz}>Exportar JSON</button>
                    <button className="btn btn-purple" type="button" onClick={() => document.getElementById('quiz-import')?.click()}>Importar JSON</button>
                    <button className="btn btn-danger" type="button" onClick={clearQuiz}>Limpar</button>
                  </div>
                  <div className="sa sa-primary">
                    <button className="btn btn-purple" type="button" onClick={saveBank}>{editBankId ? 'Atualizar Banco' : 'Salvar Banco'}</button>
                    <button className="btn btn-green btn-lg" type="button" onClick={createRoom}>Criar Sala</button>
                  </div>
                </div>
              </div>
            )}

            {tab === 'saved' && (
              <div id="panel-saved">
                <div className="section-banner">
                  <div>
                    <strong>Bancos disponiveis</strong>
                    <span>{banks.length ? `${banks.length} banco(s) encontrado(s)` : 'Nenhum banco carregado ainda'}</span>
                  </div>
                </div>
                {bankLoading && <div className="empty">Carregando...</div>}
                {!bankLoading && !banks.length && <div className="empty">Nenhum banco salvo ainda.</div>}
                <div className="blist">
                  {banks.map((bank) => (
                    <div className="bitem" key={bank.bank_id}>
                      <div className="bico">??</div>
                      <div className="binfo">
                        <div className="bnm">{bank.bank_name}</div>
                        <div className="bmeta">{bank.count} pergunta{bank.count !== 1 ? 's' : ''}</div>
                      </div>
                      <div className="bacts">
                        <button className="btn btn-blue btn-sm" type="button" onClick={() => openBank(bank.bank_id, bank.bank_name, false)}>Usar</button>
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => openBank(bank.bank_id, bank.bank_name, true)}>Editar</button>
                        <button className="btn btn-danger btn-sm" type="button" onClick={() => removeBank(bank.bank_id)}>Excluir</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {screen === 'lobby' && (
        <div id="slob" className="scr on">
          <div className="tb">
            <button className="btn btn-ghost btn-sm home-back" type="button" onClick={() => navigate('home')}>Home</button>
            <div className="logo">LB Conexao Quiz</div>
            <div id="lob-nm" style={{ fontFamily: 'Sora, sans-serif', color: 'var(--muted)', fontSize: '.85rem' }}>{quizTitle}</div>
            <button className="btn btn-green" type="button" onClick={startGame}>Iniciar</button>
          </div>
          <div className="app-page-shell lob">
            <div className="lob-l">
              <div className="pin-box">
                <div className="pin-lbl">PIN da Sala</div>
                <div className="pin-val">{pin}</div>
              </div>
              <div className="qr-box">
                <div className="qr-lbl">Alunos entram por aqui</div>
                {qrDataUrl && <img src={qrDataUrl} alt="QR Code da sala" width="148" height="148" />}
                <div className="qr-url">{joinUrl}</div>
              </div>
            </div>
            <div className="lob-r">
              <div className="section-eyebrow">Sala ativa</div>
              <div className="section-banner section-banner-inline">
                <div>
                  <strong>Sala pronta para receber a turma</strong>
                  <span>Compartilhe o PIN ou o QR Code e inicie quando todos estiverem conectados.</span>
                </div>
              </div>
              <h3><span className="rt-dot"></span> Ao vivo na sala</h3>
              <div className="pcnt">{lobbyPlayers.length ? `${lobbyPlayers.length} jogador${lobbyPlayers.length !== 1 ? 'es' : ''} conectado${lobbyPlayers.length !== 1 ? 's' : ''}` : 'Aguardando alunos...'}</div>
              <div className="pwrap">
                {lobbyPlayers.map((player) => (
                  <div className="pchip" key={player.name}><span>{player.avatar || '??'}</span>{player.name}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {screen === 'question' && currentQuestion && (
        <div id="sqadm" className="scr on">
          <div className="tb" style={{ flexShrink: 0 }}>
            <button className="btn btn-ghost btn-sm home-back" type="button" onClick={() => navigate('home')}>Home</button>
            <div className="logo">LB Conexao Quiz</div>
            <div className="acnt">{answerCounts.total} resp.</div>
            <div style={{ display: 'flex', gap: '5px' }}>
              {!revealed && <button className="btn btn-yellow btn-sm" type="button" onClick={handleReveal} style={{ display: answerCounts.total ? 'inline-flex' : 'none' }}>Revelar</button>}
              {revealed && <button className="btn btn-green btn-sm" type="button" onClick={openRanking}>Prox.</button>}
            </div>
          </div>
          <div className="app-page-shell app-flow-shell">
          <div className="section-eyebrow">Aplicacao em andamento</div>
          <div className="qmeta">
            <div className="qtag">{currentQ + 1} / {totalQ}</div>
            <div className="tmr">
              <svg viewBox="0 0 54 54" width="54" height="54">
                <circle className="tmr-bg" cx="27" cy="27" r="23" />
                <circle className="tmr-fg" cx="27" cy="27" r="23" strokeDasharray="144.5" strokeDashoffset={144.5 * (1 - timeLeft / qTime)} style={{ stroke: timeLeft <= 5 ? 'var(--A)' : timeLeft <= 10 ? 'var(--C)' : 'var(--acc)' }} />
              </svg>
              <div className="tmr-n">{timeLeft}</div>
            </div>
          </div>
          <div className="qbbl"><h2>{currentQuestion.text}</h2></div>
          <div className="ag">
            {ANSWER_LABELS.map((label) => {
              const count = answerCounts[label];
              const total = answerCounts.total || 1;
              const isCorrect = currentQuestion.correct === label;
              return (
                <button key={label} className={`abtn ${label} ${revealed ? (isCorrect ? 'cor' : 'wrg') : ''}`} type="button">
                  <span className="aico">{ANSWER_ICONS[label]}</span>
                  <span className="atxt">{currentQuestion[label]}</span>
                  <span className="acn">{count}</span>
                  <span className="abar" style={{ width: `${(count / total) * 100}%` }}></span>
                </button>
              );
            })}
          </div>
          </div>
        </div>
      )}

      {screen === 'ranking' && (
        <div id="srnk" className="scr on">
          <button className="btn btn-ghost btn-sm home-floating" type="button" onClick={() => navigate('home')}>Home</button>
          <div className="app-page-shell app-center-shell">
            <div className="section-eyebrow">Classificacao</div>
            <div className="rkh"><h2>Ranking</h2><p>{rankingLabel}</p></div>
            <div className="rklist">
              {rankingWithDelta.slice(0, 10).map((player, index) => (
                <RankItem key={player.name} player={player} index={index} previousIndex={player.previousIndex} />
              ))}
            </div>
            {!isLastQuestion && <button className="btn btn-acc" type="button" onClick={continueGame}>Proxima Pergunta</button>}
            {isLastQuestion && <button className="btn btn-green" type="button" onClick={finishGame}>Resultado Final</button>}
          </div>
        </div>
      )}

      {screen === 'final' && (
        <div id="sfin" className="scr on">
          <button className="btn btn-ghost btn-sm home-floating" type="button" onClick={() => navigate('home')}>Home</button>
          <div className="app-page-shell app-center-shell">
            <div className="section-eyebrow">Encerramento</div>
            <div style={{ fontSize: '2.6rem', animation: 'float 2s ease-in-out infinite' }}>??</div>
            <div className="fin-t">Fim de Jogo!</div>
            <div className="fin-s">{finalRanking.length} participante(s) · {totalQ} perguntas</div>
            <div className="podium">
              {[1, 0, 2].map((orderIndex) => {
                const top = finalRanking.slice(0, 3);
                const player = top[orderIndex];
                const classes = ['s', 'g', 'b'];
                if (!player) return null;
                return (
                  <div className="pod" key={`${player.name}-${orderIndex}`}>
                    <div className="pod-nm">{player.name}</div>
                    <div className="pod-sc">{Number(player.score).toLocaleString()} pts</div>
                    <div className={`pod-blk ${classes[orderIndex]}`}>{orderIndex === 0 ? '??' : orderIndex === 1 ? '??' : '??'}</div>
                  </div>
                );
              })}
            </div>
            <div className="rklist" style={{ maxWidth: '460px', width: '100%' }}>
              {finalRanking.map((player, index) => <RankItem key={player.name} player={player} index={index} />)}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '8px' }}>
              <button className="btn btn-blue" type="button" onClick={exportFinalReport}>Exportar CSV</button>
              <button className="btn btn-acc" type="button" onClick={() => {
                clearPoll();
                clearTimer();
                setScreen('setup');
                setPin('');
                setCurrentQ(0);
                setFinalRanking([]);
              }}>Novo Jogo</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}






