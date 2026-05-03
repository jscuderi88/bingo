/* ─────────────────────────────────────────
   Bingo · Consultora Natura & Belleza
   App logic — vanilla JS, persistencia en localStorage
   ───────────────────────────────────────── */

const STORAGE_KEY = 'cn-bingo-state-v1';

const DEFAULTS = {
  config: {
    maxNumber: 20,
    repsToWin: 4,
    allowRepetition: true,
    nameMode: 'both',     // 'numbers' | 'both' | 'names'
    cols: 5,
    autoSpeed: 3500,
  },
  buyers: {},             // { 1: 'Pedro', 2: 'María', ... }
  draws: [],              // historial cronológico
  winner: null,
  soundOn: true,
};

let state = loadState();
let autoTimer = null;
let isAuto = false;

/* ─────────────────── Persistencia ─────────────────── */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw);
    // merge with defaults to handle schema evolution
    return {
      ...structuredClone(DEFAULTS),
      ...parsed,
      config: { ...DEFAULTS.config, ...(parsed.config || {}) },
      buyers: parsed.buyers || {},
      draws: parsed.draws || [],
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function clearState() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  state = structuredClone(DEFAULTS);
}

/* ─────────────────── Audio ─────────────────── */

let audioCtx = null;
function getAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
  }
  return audioCtx;
}

function playBeep(freq = 720, duration = 0.18, type = 'sine', vol = 0.18) {
  if (!state.soundOn) return;
  const ctx = getAudio();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  o.connect(g); g.connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + duration);
}

function playDrawSound() {
  // 3-tone arpeggio building tension
  if (!state.soundOn) return;
  playBeep(440, 0.10, 'triangle', 0.14);
  setTimeout(() => playBeep(554, 0.10, 'triangle', 0.14), 90);
  setTimeout(() => playBeep(659, 0.18, 'triangle', 0.16), 200);
}

function playRevealSound() {
  if (!state.soundOn) return;
  playBeep(880, 0.22, 'sine', 0.20);
  setTimeout(() => playBeep(1320, 0.30, 'sine', 0.18), 100);
}

function playWinSound() {
  if (!state.soundOn) return;
  // Fanfare: C E G C
  const notes = [523, 659, 784, 1047];
  notes.forEach((f, i) => {
    setTimeout(() => playBeep(f, 0.30, 'triangle', 0.22), i * 130);
  });
}

/* ─────────────────── Sortear ─────────────────── */

function getCount(n) {
  return state.draws.filter(x => x === n).length;
}

function eligibleNumbers() {
  const max = state.config.maxNumber;
  if (state.config.allowRepetition) {
    // sin tope individual, salvo que ya alguien haya ganado
    return Array.from({ length: max }, (_, i) => i + 1);
  } else {
    return Array.from({ length: max }, (_, i) => i + 1).filter(n => getCount(n) === 0);
  }
}

function drawOne() {
  if (state.winner) return null;
  const pool = eligibleNumbers();
  if (pool.length === 0) return null;
  const idx = Math.floor(Math.random() * pool.length);
  const num = pool[idx];
  state.draws.push(num);
  // chequear winner
  const newCount = getCount(num);
  if (state.config.allowRepetition && newCount >= state.config.repsToWin) {
    state.winner = num;
  } else if (!state.config.allowRepetition && state.draws.length === state.config.maxNumber) {
    // bingo clásico: ganador = último número (o todos)
    state.winner = num;
  }
  saveState();
  return num;
}

/* ─────────────────── Renderers ─────────────────── */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function renderSetup() {
  // Inicializa el modal con valores actuales
  $('#cfgMaxNumber').value = state.config.maxNumber;
  $('#cfgRepsToWin').value = state.config.repsToWin;
  $('#cfgCols').value = state.config.cols;
  $$('.toggle-btn[data-allow-rep]').forEach(b => {
    b.classList.toggle('active', String(b.dataset.allowRep) === String(state.config.allowRepetition));
  });
  $$('.toggle-btn[data-name-mode]').forEach(b => {
    b.classList.toggle('active', b.dataset.nameMode === state.config.nameMode);
  });
  updateNamesCount();
  updateRepsVisibility();
}

function updateNamesCount() {
  const n = Object.values(state.buyers).filter(v => v && v.trim()).length;
  $('#namesCount').textContent = n;
}

function updateRepsVisibility() {
  const grp = $('#grpReps');
  if (!state.config.allowRepetition) {
    grp.style.opacity = '0.5';
    $('#cfgRepsToWin').disabled = true;
  } else {
    grp.style.opacity = '1';
    $('#cfgRepsToWin').disabled = false;
  }
}

function renderNamesEditor() {
  const grid = $('#namesGrid');
  grid.innerHTML = '';
  const max = parseInt($('#cfgMaxNumber').value, 10) || state.config.maxNumber;
  for (let n = 1; n <= max; n++) {
    const row = document.createElement('div');
    row.className = 'name-row';
    row.innerHTML = `
      <span class="name-num">${n}</span>
      <input type="text" class="name-input" data-num="${n}" placeholder="Nombre del comprador" value="${escapeHtml(state.buyers[n] || '')}">
    `;
    grid.appendChild(row);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]);
}

function renderBoard() {
  const board = $('#board');
  board.style.setProperty('--cols', state.config.cols);
  board.innerHTML = '';
  for (let n = 1; n <= state.config.maxNumber; n++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.num = n;
    const count = getCount(n);
    const reps = state.config.allowRepetition ? state.config.repsToWin : 1;
    const isHit = count > 0;
    const isWin = state.winner === n;
    if (isHit) cell.classList.add('cell-hit');
    if (isWin) cell.classList.add('cell-winner');

    const showNum = state.config.nameMode === 'numbers' || state.config.nameMode === 'both';
    const showName = state.config.nameMode === 'names' || state.config.nameMode === 'both';
    const buyer = state.buyers[n];

    cell.innerHTML = `
      ${showNum ? `<div class="cell-num">${n}</div>` : ''}
      ${showName && buyer ? `<div class="cell-name">${escapeHtml(buyer)}</div>` : ''}
      <div class="cell-count">${count}/${reps}</div>
      <div class="cell-progress" style="width:${Math.min(100, (count / reps) * 100)}%"></div>
    `;
    board.appendChild(cell);
  }
}

function renderHistory() {
  const hist = $('#history');
  hist.innerHTML = '';
  state.draws.forEach(n => {
    const ball = document.createElement('div');
    ball.className = 'hist-ball';
    ball.textContent = n;
    hist.appendChild(ball);
  });
  $('#historyCount').textContent = state.draws.length;
  // Auto-scroll al final
  hist.scrollLeft = hist.scrollWidth;
}

function renderStats() {
  $('#statDraws').textContent = state.draws.length;
  if (state.config.allowRepetition) {
    $('#statRemaining').textContent = '∞';
  } else {
    $('#statRemaining').textContent = Math.max(0, state.config.maxNumber - state.draws.length);
  }
}

function renderBall(num) {
  const ball = $('#ball');
  if (num === null || num === undefined) {
    ball.classList.add('ball-empty');
    ball.querySelector('.ball-num').textContent = '—';
    ball.querySelector('.ball-name').textContent = '';
  } else {
    ball.classList.remove('ball-empty');
    ball.querySelector('.ball-num').textContent = num;
    const buyer = state.buyers[num];
    ball.querySelector('.ball-name').textContent = buyer || '';
  }
}

function renderWinner() {
  if (!state.winner) {
    $('#winnerBanner').hidden = true;
    return;
  }
  $('#winnerBanner').hidden = false;
  $('#winnerNum').textContent = state.winner;
  const buyer = state.buyers[state.winner];
  $('#winnerName').textContent = buyer ? `Ganó ${buyer}` : '¡Tenemos ganador!';
}

function renderAll() {
  renderBoard();
  renderHistory();
  renderStats();
  renderBall(state.draws[state.draws.length - 1]);
  renderWinner();
  updateSoundBtn();
}

function updateSoundBtn() {
  $('#btnSound').classList.toggle('active', state.soundOn);
}

/* ─────────────────── Animación de sorteo ─────────────────── */

async function animateDraw() {
  const ball = $('#ball');
  const numEl = ball.querySelector('.ball-num');
  const nameEl = ball.querySelector('.ball-name');

  ball.classList.remove('ball-empty', 'ball-pop');
  ball.classList.add('ball-shake');
  playDrawSound();

  // Numbers tumbling effect
  const max = state.config.maxNumber;
  const ticks = 14;
  for (let i = 0; i < ticks; i++) {
    numEl.textContent = Math.floor(Math.random() * max) + 1;
    nameEl.textContent = '';
    await sleep(60 + i * 12);
  }

  // Sortear de verdad
  const num = drawOne();
  if (num === null) {
    ball.classList.remove('ball-shake');
    return null;
  }
  ball.classList.remove('ball-shake');
  ball.classList.add('ball-pop');
  numEl.textContent = num;
  nameEl.textContent = state.buyers[num] || '';
  playRevealSound();
  // Re-render board + history (con highlight)
  renderBoard();
  renderHistory();
  renderStats();
  // Highlight la celda recién sorteada
  const cell = document.querySelector(`.cell[data-num="${num}"]`);
  if (cell) {
    cell.classList.add('cell-just-drew');
    setTimeout(() => cell.classList.remove('cell-just-drew'), 600);
  }

  // Si hay winner, festejar
  if (state.winner) {
    setTimeout(() => {
      renderWinner();
      playWinSound();
      fireConfetti();
      stopAuto();
    }, 600);
  }

  return num;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ─────────────────── Auto-draw ─────────────────── */

function startAuto() {
  if (autoTimer) clearTimeout(autoTimer);
  if (state.winner) return;
  isAuto = true;
  scheduleAuto();
}

function scheduleAuto() {
  autoTimer = setTimeout(async () => {
    if (!isAuto || state.winner) return;
    await animateDraw();
    if (isAuto && !state.winner) scheduleAuto();
  }, state.config.autoSpeed);
}

function stopAuto() {
  isAuto = false;
  if (autoTimer) clearTimeout(autoTimer);
  autoTimer = null;
  $('#cfgAuto').checked = false;
}

/* ─────────────────── Confeti ─────────────────── */

function fireConfetti() {
  const canvas = $('#confetti');
  const ctx = canvas.getContext('2d');
  const W = canvas.width = window.innerWidth;
  const H = canvas.height = window.innerHeight;
  const colors = ['#B97A6C', '#D9A99C', '#C9A77A', '#8FA89A', '#F0DCD3', '#9D5E50'];
  const pieces = [];
  for (let i = 0; i < 180; i++) {
    pieces.push({
      x: Math.random() * W,
      y: -20 - Math.random() * H * 0.5,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 3 + 2,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      angle: Math.random() * Math.PI * 2,
      vAngle: (Math.random() - 0.5) * 0.2,
      shape: Math.random() < 0.5 ? 'rect' : 'circ',
    });
  }
  let frame = 0;
  function tick() {
    ctx.clearRect(0, 0, W, H);
    pieces.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.06;
      p.angle += p.vAngle;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.4);
      else { ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    });
    frame++;
    if (frame < 240) requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, W, H);
  }
  tick();
}

/* ─────────────────── Event handlers ─────────────────── */

function setupEvents() {
  // Toggle allow repetition
  $$('.toggle-btn[data-allow-rep]').forEach(b => {
    b.addEventListener('click', () => {
      $$('.toggle-btn[data-allow-rep]').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      state.config.allowRepetition = b.dataset.allowRep === 'true';
      updateRepsVisibility();
    });
  });

  // Toggle name mode
  $$('.toggle-btn[data-name-mode]').forEach(b => {
    b.addEventListener('click', () => {
      $$('.toggle-btn[data-name-mode]').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      state.config.nameMode = b.dataset.nameMode;
    });
  });

  // Edit names button
  $('#btnEditNames').addEventListener('click', () => {
    renderNamesEditor();
    $('#namesModal').hidden = false;
  });
  $('#namesClose').addEventListener('click', () => $('#namesModal').hidden = true);
  $('#namesClearAll').addEventListener('click', () => {
    if (!confirm('¿Borrar todos los nombres?')) return;
    state.buyers = {};
    renderNamesEditor();
  });
  $('#namesSave').addEventListener('click', () => {
    const inputs = $$('.name-input');
    const buyers = {};
    inputs.forEach(input => {
      const n = input.dataset.num;
      const v = input.value.trim();
      if (v) buyers[n] = v;
    });
    state.buyers = buyers;
    updateNamesCount();
    $('#namesModal').hidden = true;
  });

  // Empezar partida
  $('#btnStartGame').addEventListener('click', () => {
    state.config.maxNumber = clamp(parseInt($('#cfgMaxNumber').value, 10) || 20, 2, 999);
    state.config.repsToWin = clamp(parseInt($('#cfgRepsToWin').value, 10) || 4, 1, 100);
    state.config.cols = clamp(parseInt($('#cfgCols').value, 10) || 5, 2, 20);
    state.draws = [];
    state.winner = null;
    saveState();
    showGame();
  });

  // Sortear
  $('#btnDraw').addEventListener('click', async () => {
    if (state.winner) return;
    $('#btnDraw').disabled = true;
    await animateDraw();
    $('#btnDraw').disabled = !!state.winner;
  });

  // Auto
  $('#cfgAuto').addEventListener('change', (e) => {
    if (e.target.checked) startAuto();
    else stopAuto();
  });
  $('#cfgAutoSpeed').addEventListener('change', (e) => {
    state.config.autoSpeed = parseInt(e.target.value, 10);
    if (isAuto) startAuto(); // restart with new speed
  });

  // Sound
  $('#btnSound').addEventListener('click', () => {
    state.soundOn = !state.soundOn;
    saveState();
    updateSoundBtn();
  });

  // Fullscreen
  $('#btnFullscreen').addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  });

  // Reset
  $('#btnReset').addEventListener('click', () => {
    if (!confirm('¿Reiniciar la partida? (Se mantienen la configuración y los nombres.)')) return;
    state.draws = [];
    state.winner = null;
    saveState();
    stopAuto();
    renderAll();
    $('#btnDraw').disabled = false;
  });

  // Settings (volver al setup)
  $('#btnSettings').addEventListener('click', () => {
    if (state.draws.length > 0 && !confirm('Si cambiás la configuración se reinicia la partida actual. ¿Continuar?')) return;
    stopAuto();
    showSetup();
  });

  // Nueva partida desde el banner ganador
  $('#btnNewGame').addEventListener('click', () => {
    state.draws = [];
    state.winner = null;
    saveState();
    renderAll();
    $('#btnDraw').disabled = false;
  });

  // Resize confetti canvas on window resize
  window.addEventListener('resize', () => {
    const c = $('#confetti');
    c.width = window.innerWidth;
    c.height = window.innerHeight;
  });
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

/* ─────────────────── Screen switcher ─────────────────── */

function showSetup() {
  $('#setupModal').style.display = 'flex';
  $('#game').hidden = true;
  renderSetup();
}

function showGame() {
  $('#setupModal').style.display = 'none';
  $('#game').hidden = false;
  $('#cfgAutoSpeed').value = String(state.config.autoSpeed);
  $('#btnDraw').disabled = !!state.winner;
  renderAll();
}

/* ─────────────────── Init ─────────────────── */

function init() {
  setupEvents();
  // Si ya hay una partida en curso (draws.length > 0), saltamos directo al juego
  if (state.draws.length > 0 || state.winner) {
    showGame();
  } else {
    showSetup();
  }
}

document.addEventListener('DOMContentLoaded', init);
