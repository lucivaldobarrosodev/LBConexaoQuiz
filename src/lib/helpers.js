export const DRAFT_KEY = 'quizzap_draft_v2_react';
export const ANSWER_LABELS = ['A', 'B', 'C', 'D'];
export const ANSWER_ICONS = { A: '▲', B: '●', C: '♦', D: '■' };
export const DEMO_QUESTIONS = [
  { text: 'Qual e a capital do Brasil?', A: 'Brasilia', B: 'Sao Paulo', C: 'Rio de Janeiro', D: 'Salvador', correct: 'A' },
  { text: 'Quanto e 7 x 8?', A: '54', B: '56', C: '58', D: '62', correct: 'B' },
  { text: 'Quem escreveu Dom Casmurro?', A: 'Jose de Alencar', B: 'Machado de Assis', C: 'Eca de Queiros', D: 'Clarice Lispector', correct: 'B' },
  { text: 'Maior planeta do Sistema Solar?', A: 'Terra', B: 'Saturno', C: 'Jupiter', D: 'Netuno', correct: 'C' },
  { text: 'Formula da agua?', A: 'CO2', B: 'H2O', C: 'O2', D: 'NaCl', correct: 'B' },
  { text: 'Azul + Amarelo = ?', A: 'Roxo', B: 'Laranja', C: 'Verde', D: 'Marrom', correct: 'C' },
];

export function createEmptyQuestion(index) {
  return {
    text: `Pergunta ${index + 1}`,
    A: 'Opcao A',
    B: 'Opcao B',
    C: 'Opcao C',
    D: 'Opcao D',
    correct: 'A',
  };
}

export function resizeQuestions(prev, count) {
  return Array.from({ length: count }, (_, index) => prev[index] || createEmptyQuestion(index));
}

export function csvEscape(value) {
  const text = String(value ?? '');
  if (!/[;"\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function getQueryRoute() {
  const params = new URLSearchParams(window.location.search);
  const queryView = params.get('view');
  const pathname = window.location.pathname.toLowerCase();
  let view = queryView;

  if (!view) {
    if (pathname.endsWith('/professor.html') || pathname.endsWith('professor.html')) view = 'professor';
    else if (pathname.endsWith('/aluno.html') || pathname.endsWith('aluno.html')) view = 'aluno';
  }

  return {
    view: view === 'professor' || view === 'aluno' ? view : 'home',
    pin: params.get('pin') || '',
  };
}

export function getAppPath() {
  const { pathname } = window.location;
  if (!pathname || pathname === '/') return '/index.html';
  if (pathname.endsWith('/')) return `${pathname}index.html`;
  if (pathname.endsWith('/index.html')) return pathname;
  return pathname.replace(/\/[^/]*$/, '/index.html');
}

export function buildAppUrl(view, pin = '') {
  const params = new URLSearchParams();
  if (view !== 'home') params.set('view', view);
  if (pin) params.set('pin', pin);
  const appPath = getAppPath();
  return `${window.location.origin}${appPath}${params.toString() ? `?${params}` : ''}`;
}

export function pushRoute(view, pin = '') {
  const params = new URLSearchParams();
  if (view !== 'home') params.set('view', view);
  if (pin) params.set('pin', pin);
  const next = `${getAppPath()}${params.toString() ? `?${params}` : ''}`;
  window.history.pushState({}, '', next);
}

export function replaceRoute(view, pin = '') {
  const params = new URLSearchParams();
  if (view !== 'home') params.set('view', view);
  if (pin) params.set('pin', pin);
  const next = `${getAppPath()}${params.toString() ? `?${params}` : ''}`;
  window.history.replaceState({}, '', next);
}
