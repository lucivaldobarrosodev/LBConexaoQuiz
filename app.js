// ═══════════════════════════════════════════════════════════
//  QuizZap! ⚡  —  app.js
//  Lógica completa do jogo (Professor e Aluno)
//  Supabase via REST pura — sem SDK, sem Web Workers
// ═══════════════════════════════════════════════════════════

// ── REST helpers ─────────────────────────────────────────────
const REST    = `${SUPA_URL}/rest/v1`;
const HEADERS = {
  'Content-Type' : 'application/json',
  'apikey'       : SUPA_KEY,
  'Authorization': `Bearer ${SUPA_KEY}`,
  'Prefer'       : 'return=representation',
};

async function dbReq(method, table, body, query = '') {
  const res  = await fetch(`${REST}/${table}${query ? '?' + query : ''}`, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || res.statusText);
  return text ? JSON.parse(text) : [];
}

const GET    = (t, q)    => dbReq('GET',    t, null, q);
const POST   = (t, b)    => dbReq('POST',   t, b);
const PATCH  = (t, b, q) => dbReq('PATCH',  t, b,   q);
const DEL    = (t, q)    => dbReq('DELETE', t, null, q);

// ── Estado global ─────────────────────────────────────────────
const G = {
  role: null, pin: null, name: null, avatar: null,
  questions: [], timePerQ: 20, currentQ: 0, totalQ: 0,
  timer: null, pollTimer: null, timeLeft: 0,
  answered: false, prevRank: [],
};

// ── Utilitários de UI ─────────────────────────────────────────
function show(id) {
  document.querySelectorAll('.scr').forEach(s => s.classList.remove('on'));
  document.getElementById(id).classList.add('on');
}

function load(msg = '') {
  const el = document.getElementById('loader');
  if (msg) { document.getElementById('lmsg').textContent = msg; el.classList.add('on'); }
  else el.classList.remove('on');
}

let _tt;
function toast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = `tst on ${type}`;
  clearTimeout(_tt); _tt = setTimeout(() => el.classList.remove('on'), 3000);
}

// ═══════════════════════════════════════════════════════════
//  INICIALIZAÇÃO — chamada pelo HTML
// ═══════════════════════════════════════════════════════════

function initAdmin() {
  G.role = 'admin';
  buildCards();
  show('ss');
}

function initPlayer() {
  G.role = 'player';
  // Se veio pelo QR Code, o PIN já vem na URL ?pin=XXXXXX
  const pin = new URLSearchParams(location.search).get('pin');
  if (pin) document.getElementById('jpin').value = pin;
  show('spj');
}

// ═══════════════════════════════════════════════════════════
//  CARDS DE PERGUNTAS
// ═══════════════════════════════════════════════════════════

function buildCards() {
  const n    = parseInt(document.getElementById('qcount').value);
  const list = document.getElementById('qlist');
  list.innerHTML = '';
  const icons  = ['▲','●','♦','■'];
  const labels = ['A','B','C','D'];

  for (let i = 0; i < n; i++) {
    const c = document.createElement('div');
    c.className = 'qcard';
    c.innerHTML = `
      <div class="qtop">
        <div class="qbadge">${i + 1}</div>
        <input class="qinp" id="qi${i}" placeholder="Pergunta ${i + 1}…">
      </div>
      <div class="og">
        ${labels.map((l, j) => `
          <div class="ol">
            <div class="od ${l}">${icons[j]}</div>
            <input class="oi" id="qo${i}${l}" placeholder="Opção ${l}">
          </div>`).join('')}
      </div>
      <div class="qfoot">
        <label>✅ Correta:</label>
        <select class="csel" id="qc${i}">
          <option>A</option><option>B</option><option>C</option><option>D</option>
        </select>
      </div>`;
    list.appendChild(c);
  }
}

function getFormQ() {
  const n = parseInt(document.getElementById('qcount').value);
  const qs = [];
  for (let i = 0; i < n; i++) {
    qs.push({
      text   : document.getElementById(`qi${i}`).value   || `Pergunta ${i + 1}`,
      A      : document.getElementById(`qo${i}A`).value  || 'Opção A',
      B      : document.getElementById(`qo${i}B`).value  || 'Opção B',
      C      : document.getElementById(`qo${i}C`).value  || 'Opção C',
      D      : document.getElementById(`qo${i}D`).value  || 'Opção D',
      correct: document.getElementById(`qc${i}`).value,
    });
  }
  return qs;
}

function demoFill() {
  const DEMO = [
    {q:'Qual é a capital do Brasil?',          o:['Brasília','São Paulo','Rio de Janeiro','Salvador'],                          c:'A'},
    {q:'Quanto é 7 × 8?',                      o:['54','56','58','62'],                                                         c:'B'},
    {q:'Quem descobriu o Brasil?',              o:['Cristóvão Colombo','Pedro Álvares Cabral','Vasco da Gama','Américo Vespúcio'],c:'B'},
    {q:'Maior planeta do Sistema Solar?',       o:['Terra','Saturno','Júpiter','Netuno'],                                       c:'C'},
    {q:'1ª Copa do Mundo do Brasil?',           o:['1950','1958','1962','1970'],                                                 c:'B'},
    {q:'Símbolo químico do ouro?',              o:['Ag','Fe','Au','Cu'],                                                        c:'C'},
    {q:'Maior rio do Brasil?',                  o:['S. Francisco','Paraná','Amazonas','Tocantins'],                             c:'C'},
    {q:'Quantos estados tem o Brasil?',         o:['24','25','26','27'],                                                        c:'D'},
    {q:'Quem escreveu Dom Casmurro?',           o:['José de Alencar','Machado de Assis','Eça de Queirós','Clarice Lispector'],  c:'B'},
    {q:'Fórmula da água?',                      o:['CO₂','H₂O','O₂','NaCl'],                                                   c:'B'},
    {q:'Osso mais longo do corpo?',             o:['Úmero','Rádio','Fêmur','Tíbia'],                                           c:'C'},
    {q:'País com maior população?',             o:['Índia','China','EUA','Brasil'],                                             c:'A'},
    {q:'Lados de um hexágono?',                 o:['5','6','7','8'],                                                           c:'B'},
    {q:'Azul + Amarelo = ?',                    o:['Roxo','Laranja','Verde','Marrom'],                                          c:'C'},
    {q:'Continente mais extenso?',              o:['Américas','África','Ásia','Europa'],                                       c:'C'},
    {q:'Símbolo do sódio?',                     o:['So','Na','Sd','Sn'],                                                       c:'B'},
    {q:'Dias para Terra orbitar o Sol?',        o:['364','365','366','360'],                                                    c:'B'},
    {q:'Idioma mais falado no mundo?',          o:['Inglês','Espanhol','Mandarim','Hindi'],                                    c:'C'},
    {q:'Menor país do mundo?',                  o:['Mônaco','San Marino','Vaticano','Liechtenstein'],                          c:'C'},
    {q:'Raiz quadrada de 144?',                 o:['11','12','13','14'],                                                       c:'B'},
  ];
  const n = parseInt(document.getElementById('qcount').value);
  for (let i = 0; i < n; i++) {
    const d = DEMO[i % DEMO.length];
    document.getElementById(`qi${i}`).value = d.q;
    ['A','B','C','D'].forEach((l, j) => {
      document.getElementById(`qo${i}${l}`).value = d.o[j];
    });
    document.getElementById(`qc${i}`).value = d.c;
  }
}

// ═══════════════════════════════════════════════════════════
//  BANCO DE PERGUNTAS
// ═══════════════════════════════════════════════════════════

function switchTab(t) {
  document.getElementById('tab-new').classList.toggle('on', t === 'new');
  document.getElementById('tab-saved').classList.toggle('on', t === 'saved');
  document.getElementById('panel-new').style.display   = t === 'new'   ? '' : 'none';
  document.getElementById('panel-saved').style.display = t === 'saved' ? '' : 'none';
  if (t === 'saved') loadBanks();
}

async function loadBanks() {
  const emEl = document.getElementById('bank-empty');
  const blEl = document.getElementById('blist');
  emEl.textContent = '⏳ Carregando…';
  emEl.style.display = 'block';
  blEl.innerHTML = '';
  try {
    const data = await GET('banks', 'select=bank_id,bank_name,created_at&order=created_at.desc');
    const map  = {};
    (data || []).forEach(r => {
      if (!map[r.bank_id]) map[r.bank_id] = { ...r, count: 0 };
      map[r.bank_id].count++;
    });
    const banks = Object.values(map);
    emEl.style.display = banks.length ? 'none' : 'block';
    if (!banks.length) { emEl.textContent = '📭 Nenhum banco salvo ainda.\nCrie perguntas e clique em 💾 Salvar Banco.'; return; }
    banks.forEach(b => {
      const el = document.createElement('div');
      el.className = 'bitem';
      const dt = new Date(b.created_at).toLocaleDateString('pt-BR');
      el.innerHTML = `
        <div class="bico">📚</div>
        <div class="binfo">
          <div class="bnm">${b.bank_name}</div>
          <div class="bmeta">${b.count} pergunta${b.count !== 1 ? 's' : ''} · ${dt}</div>
        </div>
        <div class="bacts">
          <button class="btn btn-blue btn-sm" onclick="loadBank('${b.bank_id}','${b.bank_name}')">▶ Usar</button>
          <button class="btn btn-danger btn-sm" onclick="delBank('${b.bank_id}')">🗑️</button>
        </div>`;
      blEl.appendChild(el);
    });
  } catch (e) { emEl.textContent = '❌ Erro: ' + e.message; }
}

async function loadBank(bankId, bankName) {
  load('Carregando banco…');
  try {
    const data    = await GET('banks', `select=*&bank_id=eq.${bankId}&order=idx.asc`);
    const n       = data.length;
    const opts    = [5,10,15,20];
    const closest = opts.reduce((a, b) => Math.abs(b - n) < Math.abs(a - n) ? b : a);
    document.getElementById('qcount').value = String(closest);
    buildCards();
    const useN = Math.min(n, closest);
    for (let i = 0; i < useN; i++) {
      const q = data[i];
      document.getElementById(`qi${i}`).value  = q.text;
      document.getElementById(`qo${i}A`).value = q.opt_a;
      document.getElementById(`qo${i}B`).value = q.opt_b;
      document.getElementById(`qo${i}C`).value = q.opt_c;
      document.getElementById(`qo${i}D`).value = q.opt_d;
      document.getElementById(`qc${i}`).value  = q.correct;
    }
    document.getElementById('qtitle').value = bankName;
    load(); switchTab('new');
    toast(`Banco "${bankName}" carregado! ✅`);
  } catch (e) { load(); toast(e.message, 'err'); }
}

async function doSaveBank() {
  const name   = document.getElementById('qtitle').value || 'Banco sem nome';
  const qs     = getFormQ();
  const bankId = 'bank_' + Date.now();
  load('Salvando banco…');
  try {
    const rows = qs.map((q, i) => ({
      bank_id: bankId, bank_name: name, idx: i,
      text: q.text, opt_a: q.A, opt_b: q.B, opt_c: q.C, opt_d: q.D, correct: q.correct,
    }));
    await POST('banks', rows);
    load(); toast(`Banco "${name}" salvo! 💾`);
  } catch (e) { load(); toast(e.message, 'err'); }
}

async function delBank(bankId) {
  if (!confirm('Apagar este banco de perguntas?')) return;
  load('Apagando…');
  try { await DEL('banks', `bank_id=eq.${bankId}`); load(); toast('Banco apagado!'); loadBanks(); }
  catch (e) { load(); toast(e.message, 'err'); }
}

// ═══════════════════════════════════════════════════════════
//  FLUXO ADMIN — criar sala
// ═══════════════════════════════════════════════════════════

async function createRoom() {
  const title    = document.getElementById('qtitle').value || 'Quiz';
  const timePerQ = parseInt(document.getElementById('qtime').value);
  const questions = getFormQ();
  G.questions = questions; G.timePerQ = timePerQ; G.totalQ = questions.length;

  load('Criando sala…');
  try {
    // PIN único
    let pin, exists = true;
    while (exists) {
      pin = String(Math.floor(100000 + Math.random() * 900000));
      const d = await GET('games', `pin=eq.${pin}&select=pin`);
      exists = d.length > 0;
    }
    G.pin = pin;

    await POST('games', [{ pin, title, status:'lobby', current_q:0, total_q:questions.length, time_per_q:timePerQ }]);

    const qRows = questions.map((q, i) => ({
      pin, idx:i, text:q.text,
      opt_a:q.A, opt_b:q.B, opt_c:q.C, opt_d:q.D, correct:q.correct,
    }));
    await POST('questions', qRows);

    load();
    show('slob');
    document.getElementById('lpin').textContent    = pin;
    document.getElementById('lob-nm').textContent  = title;

    // ── QR Code aponta para aluno.html?pin=XXXXXX ──────────
    // Detecta se está rodando via Live Server (http) ou arquivo local
    const base    = location.href.replace(/index\.html.*$/, '');
    const joinUrl = `${base}aluno.html?pin=${pin}`;

    document.getElementById('qr-div').innerHTML = '';
    new QRCode(document.getElementById('qr-div'), {
      text        : joinUrl,
      width       : 148,
      height      : 148,
      colorDark   : '#06080f',
      colorLight  : '#ffffff',
      correctLevel: QRCode.CorrectLevel.H,
    });

    // Mostra a URL também em texto (útil em ambiente local)
    document.getElementById('qr-url').textContent = joinUrl;

    startLobbyPoll();
    toast(`Sala criada! PIN: ${pin} 🎉`);
  } catch (e) { load(); toast(e.message, 'err'); }
}

// ── Lobby poll ────────────────────────────────────────────────
function startLobbyPoll() {
  clearInterval(G.pollTimer);
  G.pollTimer = setInterval(async () => {
    try {
      const data = await GET('players', `pin=eq.${G.pin}&select=name,avatar&order=joined_at.asc`);
      const wrap = document.getElementById('pwrap');
      const existing = new Set([...wrap.querySelectorAll('.pchip')].map(c => c.dataset.n));
      (data || []).forEach(p => {
        if (!existing.has(p.name)) {
          const c = document.createElement('div');
          c.className = 'pchip'; c.dataset.n = p.name;
          c.innerHTML = `<span>${p.avatar || '🎓'}</span>${p.name}`;
          wrap.appendChild(c);
          toast(`${p.avatar} ${p.name} entrou!`, 'info');
        }
      });
      const cnt = wrap.querySelectorAll('.pchip').length;
      document.getElementById('pcnt').textContent =
        cnt ? `${cnt} jogador${cnt !== 1 ? 'es' : ''} conectado${cnt !== 1 ? 's' : ''}` : 'Aguardando alunos…';
    } catch (_) {}
  }, 2000);
}

async function adminStart() {
  clearInterval(G.pollTimer);
  load('Iniciando jogo…');
  try {
    await PATCH('games', { status:'playing', current_q:0 }, `pin=eq.${G.pin}`);
    G.currentQ = 0; load(); showAdmQ();
  } catch (e) { load(); toast(e.message, 'err'); }
}

// ── Pergunta admin ────────────────────────────────────────────
function showAdmQ() {
  const q = G.questions[G.currentQ];
  clearInterval(G.timer); clearInterval(G.pollTimer);
  G.timeLeft = G.timePerQ; G.answered = false;
  show('sqadm');

  document.getElementById('qtag').textContent = `${G.currentQ + 1} / ${G.totalQ}`;
  document.getElementById('qtxt').textContent = q.text;
  ['A','B','C','D'].forEach(l => {
    document.getElementById(`at-${l}`).textContent    = q[l];
    document.getElementById(`ac-${l}`).textContent    = '0';
    document.getElementById(`abar-${l}`).style.width  = '0';
    document.getElementById(`ab-${l}`).className      = `abtn ${l}`;
  });
  document.getElementById('acnt').textContent       = '✅ 0 resp.';
  document.getElementById('btn-rev').style.display  = 'none';
  document.getElementById('btn-nxtq').style.display = 'none';
  updTimer(G.timePerQ, G.timePerQ);

  PATCH('games', { current_q: G.currentQ }, `pin=eq.${G.pin}`).catch(() => {});

  G.pollTimer = setInterval(() => refreshCounts(), 1500);
  G.timer = setInterval(() => {
    G.timeLeft--;
    updTimer(G.timeLeft, G.timePerQ);
    if (G.timeLeft <= 0) { clearInterval(G.timer); adminReveal(); }
  }, 1000);
}

function updTimer(left, total) {
  const offset = 144.5 * (1 - left / total);
  const fg = document.getElementById('tfg');
  fg.style.strokeDashoffset = offset;
  fg.style.stroke = left <= 5 ? 'var(--A)' : left <= 10 ? 'var(--C)' : 'var(--acc)';
  document.getElementById('tnum').textContent = left;
}

async function refreshCounts() {
  try {
    const data   = await GET('answers', `pin=eq.${G.pin}&question_idx=eq.${G.currentQ}&select=option`);
    const counts = { A:0, B:0, C:0, D:0 };
    (data || []).forEach(r => { if (counts[r.option] !== undefined) counts[r.option]++; });
    const total  = (data || []).length;
    document.getElementById('acnt').textContent = `✅ ${total} resp.`;
    ['A','B','C','D'].forEach(l => {
      document.getElementById(`ac-${l}`).textContent   = counts[l];
      document.getElementById(`abar-${l}`).style.width = total > 0 ? `${(counts[l]/total)*100}%` : '0';
    });
    if (total > 0 && !G.answered) document.getElementById('btn-rev').style.display = 'block';
  } catch (_) {}
}

async function adminReveal() {
  clearInterval(G.timer); clearInterval(G.pollTimer);
  G.answered = true;
  document.getElementById('btn-rev').style.display  = 'none';
  document.getElementById('btn-nxtq').style.display = 'block';
  const cor = G.questions[G.currentQ].correct;
  ['A','B','C','D'].forEach(l =>
    document.getElementById(`ab-${l}`).className = `abtn ${l} ${l === cor ? 'cor' : 'wrg'}`
  );
  await refreshCounts();
}

function adminNext() { show('srnk'); renderRanking(false); }
function adminCont() { G.currentQ++; showAdmQ(); }

async function adminFin() {
  load('Finalizando…');
  try {
    await PATCH('games', { status:'finished' }, `pin=eq.${G.pin}`);
    const data = await GET('players', `pin=eq.${G.pin}&select=*&order=score.desc`);
    load(); showFinal(data || []);
  } catch (e) { load(); toast(e.message, 'err'); }
}

// ── Ranking ───────────────────────────────────────────────────
async function renderRanking(fin) {
  document.getElementById('rksub').textContent =
    fin ? '🏁 Resultado Final' : `Após pergunta ${G.currentQ + 1} de ${G.totalQ}`;
  try {
    const data = await GET('players', `pin=eq.${G.pin}&select=*&order=score.desc`);
    buildRankList(data || []);
    G.prevRank = data || [];
  } catch (e) { toast(e.message, 'err'); }
  const isLast = G.currentQ >= G.totalQ - 1;
  const btnNext = document.getElementById('btn-rknxt');
  const btnFin  = document.getElementById('btn-rkfin');
  if (btnNext) btnNext.style.display = G.role === 'admin' && !isLast ? 'block' : 'none';
  if (btnFin)  btnFin.style.display  = G.role === 'admin' &&  isLast ? 'block' : 'none';
}

function buildRankList(ranking) {
  const M = ['🥇','🥈','🥉'];
  document.getElementById('rklist').innerHTML = ranking.slice(0, 10).map((p, i) => {
    const pi = G.prevRank.findIndex(x => x.name === p.name);
    let delta = '';
    if (pi !== -1) {
      if      (pi > i) delta = `<span class="delta du">▲${pi - i}</span>`;
      else if (pi < i) delta = `<span class="delta dd">▼</span>`;
      else             delta = `<span class="delta de">—</span>`;
    }
    return `<div class="rki" style="animation-delay:${i * .05}s">
      <div class="rk-medal">${M[i] || `${i+1}º`}</div>
      <div class="rk-ava">${p.avatar || '🎓'}</div>
      <div class="rk-name">${p.name}${delta}</div>
      <div class="rk-right">
        <div class="rk-score">${Number(p.score).toLocaleString()}</div>
        <div class="rk-cor">✅ ${p.correct} certo${p.correct !== 1 ? 's' : ''}</div>
      </div>
    </div>`;
  }).join('');
}

// ── Final ─────────────────────────────────────────────────────
function showFinal(rk) {
  show('sfin');
  document.getElementById('fins').textContent =
    `${rk.length} participante${rk.length !== 1 ? 's' : ''} · ${G.totalQ} perguntas`;
  const top = rk.slice(0, 3), ord = [1,0,2], cls = ['s','g','b'];
  document.getElementById('podium').innerHTML = ord.map(i => {
    const p = top[i]; if (!p) return '';
    return `<div class="pod">
      <div class="pod-nm">${p.name}</div>
      <div class="pod-sc">${Number(p.score).toLocaleString()} pts</div>
      <div class="pod-blk ${cls[i]}">${i===0?'🥇':i===1?'🥈':'🥉'}</div>
    </div>`;
  }).join('');
  const M = ['🥇','🥈','🥉'];
  document.getElementById('finlist').innerHTML = rk.map((p, i) => `
    <div class="rki" style="animation-delay:${i*.06}s">
      <div class="rk-medal">${M[i]||`${i+1}º`}</div>
      <div class="rk-ava">${p.avatar||'🎓'}</div>
      <div class="rk-name">${p.name}</div>
      <div class="rk-right">
        <div class="rk-score">${Number(p.score).toLocaleString()}</div>
        <div class="rk-cor">✅ ${p.correct} de ${G.totalQ}</div>
      </div>
    </div>`).join('');
}

function restart() {
  clearInterval(G.timer); clearInterval(G.pollTimer);
  Object.assign(G, { pin:null, questions:[], currentQ:0, prevRank:[] });
  show('ss');
}

// ═══════════════════════════════════════════════════════════
//  FLUXO ALUNO
// ═══════════════════════════════════════════════════════════

async function doJoin() {
  const pin   = document.getElementById('jpin').value.trim();
  const name  = document.getElementById('jname').value.trim();
  const errEl = document.getElementById('jerr');
  errEl.style.display = 'none';

  if (pin.length < 6) { errEl.textContent = 'Digite o PIN de 6 dígitos!'; errEl.style.display = 'block'; return; }
  if (!name)          { errEl.textContent = 'Digite seu nome!';            errEl.style.display = 'block'; return; }

  load('Entrando na sala…');
  try {
    const games = await GET('games', `pin=eq.${pin}&select=*`);
    if (!games.length)            throw new Error('Sala não encontrada');
    if (games[0].status !== 'lobby') throw new Error('Este jogo já foi iniciado');

    const dup = await GET('players', `pin=eq.${pin}&name=eq.${encodeURIComponent(name)}&select=id`);
    if (dup.length) throw new Error('Este nome já está em uso nesta sala');

    const avatars = ['🦊','🐯','🦁','🐸','🐼','🦋','🐙','🦄','🐬','🦉','🐲','🦖','🦅','🐻','🦝','🦓','🦚','🦜','🐡','🦈'];
    const pList   = await GET('players', `pin=eq.${pin}&select=id`);
    const avatar  = avatars[pList.length % avatars.length];

    await POST('players', [{ pin, name, avatar, score:0, correct:0 }]);

    G.pin      = pin;
    G.name     = name;
    G.avatar   = avatar;
    G.timePerQ = games[0].time_per_q;
    G.totalQ   = games[0].total_q;

    load(); show('spw');
    document.getElementById('wnm').textContent  = `Olá, ${name}! ${avatar}`;
    document.getElementById('wava').textContent = avatar;
    toast('Você entrou! Aguarde o professor 🎉');

    startPlayerPoll();
  } catch (e) {
    load(); errEl.textContent = e.message; errEl.style.display = 'block';
  }
}

// ── Poll do aluno ─────────────────────────────────────────────
function startPlayerPoll() {
  clearInterval(G.pollTimer);
  let lastQ = -1;
  G.pollTimer = setInterval(async () => {
    try {
      const games = await GET('games', `pin=eq.${G.pin}&select=status,current_q,time_per_q,total_q`);
      if (!games.length) return;
      const g = games[0];

      const pls = await GET('players', `pin=eq.${G.pin}&select=id`);
      document.getElementById('winfo').innerHTML =
        `<span class="rt-dot"></span> ${pls.length} na sala — aguardando`;

      if (g.status === 'playing' && g.current_q > lastQ) {
        lastQ      = g.current_q;
        G.currentQ = g.current_q;
        G.timePerQ = g.time_per_q;
        G.totalQ   = g.total_q;
        clearInterval(G.pollTimer);
        startPlayerQ();
      }
      if (g.status === 'finished') { clearInterval(G.pollTimer); playerFinal(); }
    } catch (_) {}
  }, 2000);
}

// ── Pergunta aluno ────────────────────────────────────────────
async function startPlayerQ() {
  clearInterval(G.timer);
  G.answered = false; G.timeLeft = G.timePerQ;
  try {
    const qs = await GET('questions', `pin=eq.${G.pin}&idx=eq.${G.currentQ}&select=*`);
    if (!qs.length) return;
    const q = qs[0];

    show('spqa');
    document.getElementById('pqtxt').textContent = q.text;
    document.getElementById('pg').style.display  = 'grid';
    document.getElementById('pres').classList.remove('on');
    document.querySelectorAll('.pbtn').forEach(b => {
      b.disabled = false; b.classList.remove('chosen'); b.style.opacity = '1';
    });
    document.getElementById('ptfil').style.width      = '100%';
    document.getElementById('ptfil').style.background = 'var(--acc)';

    G.timer = setInterval(() => {
      G.timeLeft--;
      document.getElementById('ptfil').style.width = `${(G.timeLeft / G.timePerQ) * 100}%`;
      if (G.timeLeft <= 5) document.getElementById('ptfil').style.background = 'var(--A)';
      if (G.timeLeft <= 0) { clearInterval(G.timer); if (!G.answered) playerTimeout(); }
    }, 1000);

    // Aguarda próxima pergunta / fim
    pollNextQ();
  } catch (e) { toast(e.message, 'err'); }
}

function pollNextQ() {
  clearInterval(G.pollTimer);
  G.pollTimer = setInterval(async () => {
    try {
      const games = await GET('games', `pin=eq.${G.pin}&select=status,current_q`);
      if (!games.length) return;
      const g = games[0];
      if (g.status === 'finished') { clearInterval(G.pollTimer); clearInterval(G.timer); playerFinal(); return; }
      if (g.status === 'playing' && g.current_q > G.currentQ) {
        clearInterval(G.pollTimer); clearInterval(G.timer);
        G.currentQ = g.current_q;
        startPlayerQ();
      }
    } catch (_) {}
  }, 2000);
}

async function doAns(opt) {
  if (G.answered) return;
  G.answered = true; clearInterval(G.timer);

  document.querySelectorAll('.pbtn').forEach(b => {
    b.disabled = true;
    if (!b.classList.contains(opt)) b.style.opacity = '.3';
  });
  document.querySelector(`.pbtn.${opt}`).classList.add('chosen');
  load('Enviando…');

  try {
    const qs   = await GET('questions', `pin=eq.${G.pin}&idx=eq.${G.currentQ}&select=correct`);
    const game = await GET('games',     `pin=eq.${G.pin}&select=time_per_q`);
    const correct   = qs[0]?.correct || 'A';
    const timePerQ  = game[0]?.time_per_q || G.timePerQ;
    const isCorrect = opt === correct;
    const points    = isCorrect ? Math.round(500 + 500 * (G.timeLeft / timePerQ)) : 0;

    try {
      await POST('answers', [{
        pin: G.pin, question_idx: G.currentQ,
        player_name: G.name, option: opt,
        time_left: G.timeLeft, is_correct: isCorrect, points,
      }]);
    } catch (e2) { if (!e2.message.includes('23505')) throw e2; }

    if (isCorrect) {
      const pl = await GET('players', `pin=eq.${G.pin}&name=eq.${encodeURIComponent(G.name)}&select=score,correct`);
      if (pl.length) {
        await PATCH('players',
          { score: pl[0].score + points, correct: pl[0].correct + 1 },
          `pin=eq.${G.pin}&name=eq.${encodeURIComponent(G.name)}`
        );
      }
    }
    load(); showPRes(isCorrect, points);
  } catch (e) { load(); toast(e.message, 'err'); }
}

function playerTimeout() {
  G.answered = true;
  document.getElementById('pg').style.display = 'none';
  document.getElementById('pres').classList.add('on');
  document.getElementById('prico').textContent = '⏰';
  document.getElementById('prtxt').textContent = 'Tempo esgotado!';
  document.getElementById('prpts').textContent = '+0 pts';
  document.getElementById('prrnk').textContent = '';
}

async function showPRes(isCorrect, points) {
  document.getElementById('pg').style.display = 'none';
  document.getElementById('pres').classList.add('on');
  document.getElementById('prico').textContent = isCorrect ? '🎉' : '😢';
  document.getElementById('prtxt').textContent = isCorrect ? 'Correto!' : 'Errou!';
  document.getElementById('prpts').textContent = isCorrect ? `+${points} pts` : '0 pts';
  try {
    const data = await GET('players', `pin=eq.${G.pin}&select=name,score&order=score.desc`);
    const pos  = (data || []).findIndex(p => p.name === G.name) + 1;
    document.getElementById('prrnk').textContent = pos > 0 ? `Você está em #${pos} 🏆` : '';
  } catch (_) {}
}

async function playerFinal() {
  const data = await GET('players', `pin=eq.${G.pin}&select=*&order=score.desc`);
  G.prevRank = [];
  buildRankList(data || []);
  show('srnk');
  document.getElementById('rksub').textContent = '🏁 Resultado Final';
  const btnNext = document.getElementById('btn-rknxt');
  const btnFin  = document.getElementById('btn-rkfin');
  if (btnNext) btnNext.style.display = 'none';
  if (btnFin)  btnFin.style.display  = 'none';
}
