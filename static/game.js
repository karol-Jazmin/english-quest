/* Juego del estudiante */
(() => {
  const { h } = PX;
  const stage = document.getElementById('stage');
  const S = { data: null, token: newToken(), avatar: loadAvatar(), done: {}, profile: null };

  function newToken() {
    const a = new Uint8Array(18); crypto.getRandomValues(a);
    return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  function loadAvatar() {
    try { const v = JSON.parse(localStorage.getItem('eq_avatar')); if (v) return Object.assign({}, PX.DEFAULT_STUDENT, v); } catch (e) {}
    return { ...PX.DEFAULT_STUDENT };
  }
  function saveAvatar() { try { localStorage.setItem('eq_avatar', JSON.stringify(S.avatar)); } catch (e) {} }

  async function api(method, url, body) {
    const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    let data = null; try { data = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error((data && data.error) || 'Error ' + r.status);
    return data;
  }

  function scene({ theme = 'atardecer', char = null, expr = 'neutral', side = 'right', content, hud = false, confetti = false }) {
    stage.replaceChildren();
    const bg = h('canvas', { class: 'bg' }); PX.drawBg(bg, theme);
    stage.append(bg, PX.fx(theme));
    if (confetti) stage.append(PX.confetti());
    if (char) { const c = h('canvas', { class: 'char idle ' + side }); PX.drawChar(c, char, expr, 8); stage.append(c); }
    if (hud) {
      const c = h('canvas', { style: 'height:90px;width:auto' }); PX.drawChar(c, S.avatar, 'neutral', 4);
      stage.append(h('div', { class: 'hud' }, c));
    }
    stage.append(h('div', { class: 'ui' + (char ? (side === 'right' ? ' pr' : ' pl') : '') }, content));
  }
  const btn = (txt, fn, cls = '') => h('button', { class: 'px-btn ' + cls, onclick: fn }, txt);
  const guideOf = (w) => (w && w.character) || PX.DEFAULT_GUIDE;

  /* ---------- pantallas ---------- */
  function showTitle() {
    const st = S.data.settings;
    document.title = st.title;
    scene({ theme: 'atardecer', char: guideOf(S.data.worlds[0]), expr: 'wave', side: 'left',
      content: [h('h1', { class: 'title-px' }, st.title), h('p', { class: 'sub-px' }, st.subtitle),
        btn('🚀 COMENZAR AVENTURA', showHow, 'pink big')] });
  }
  function showHow() {
    const lines = S.data.settings.instructions.split('\n').filter((l) => l.trim());
    scene({ theme: 'atardecer', char: guideOf(S.data.worlds[0]), expr: 'explain', side: 'right',
      content: [h('div', { class: 'px-panel', style: 'max-width:480px' }, h('h2', {}, '¿Cómo jugar?'), h('ul', {}, lines.map((l) => h('li', {}, l)))),
        btn('SIGUIENTE ▶', showProfile, 'pink')] });
  }
  function showAvatar(next) {
    scene({ theme: 'cielo', content: [h('div', { class: 'px-panel glass' }, h('h2', {}, 'Tu personaje'),
      PX.avatarEditor(S.avatar, saveAvatar), btn('¡LISTO!', () => { saveAvatar(); next(); }, 'pink'))] });
  }
  function showProfile() {
    const saved = (() => { try { return JSON.parse(localStorage.getItem('eq_profile')) || {}; } catch (e) { return {}; } })();
    const err = h('div', { class: 'err' });
    const name = h('input', { type: 'text', maxlength: '120', autocomplete: 'name', value: S.profile ? S.profile.full_name : saved.full_name || '', placeholder: 'Nombres y apellidos' });
    const cycle = h('input', { type: 'text', maxlength: '30', list: 'cycles', value: S.profile ? S.profile.cycle : saved.cycle || '', placeholder: 'Ej: III' });
    const course = h('input', { type: 'text', maxlength: '80', value: S.profile ? S.profile.course : saved.course || '', placeholder: 'Nombre del curso' });
    const dl = h('datalist', { id: 'cycles' }, ['I', 'II', 'III', 'IV', 'V', 'VI'].map((c) => h('option', { value: c })));
    const fld = (l, el) => h('label', { class: 'fld' }, h('span', {}, l), el);
    const go = btn('¡LISTO, A JUGAR! ▶', async () => {
      err.textContent = ''; go.disabled = true;
      const p = { full_name: name.value, cycle: cycle.value, course: course.value };
      try {
        await api('POST', '/api/start', { token: S.token, ...p, avatar: S.avatar });
        S.profile = p; saveAvatar();
        try { localStorage.setItem('eq_profile', JSON.stringify(p)); } catch (e) {}
        showMap();
      } catch (e) { err.textContent = e.message; go.disabled = false; }
    }, 'pink');
    scene({ theme: 'cielo', content: [h('div', { class: 'px-panel glass profile' }, h('h2', {}, 'Crea tu personaje'),
      h('div', { class: 'profile-grid' },
        h('div', { class: 'form' }, fld('Nombre completo', name), fld('Ciclo', cycle), fld('Curso', course), dl),
        PX.avatarEditor(S.avatar, saveAvatar)),
      err, go)] });
  }
  function showMap() {
    const worlds = S.data.worlds;
    const all = worlds.every((w) => S.done[w.id]);
    const islands = worlds.map((w, i) => {
      const c = h('canvas'); PX.drawIsland(c, i);
      const answered = S.done[w.id];
      return h('button', { class: 'island', onclick: () => startWorld(i) }, c,
        h('div', {}, `Mundo ${i + 1}: ${w.name}`), h('div', { class: answered ? 'done' : '' }, answered ? '✔ COMPLETADO' : w.description));
    });
    scene({ theme: 'atardecer', hud: true, content: [h('h2', { class: 'sub-px' }, 'Selecciona tu punto de partida'),
      h('div', { class: 'progress' }, worlds.map((w) => h('i', { class: S.done[w.id] ? 'on' : '' }))),
      h('div', { class: 'islands' }, islands),
      h('div', {}, btn('MI PERSONAJE', () => showAvatar(showMap), 'small'),
        btn(all ? '🏁 FINALIZAR' : 'Completa todos los mundos para finalizar', finish, 'pink' + (all ? '' : ' small'), ) )] });
    const fin = stage.querySelector('.ui .px-btn.pink'); if (fin) fin.disabled = !all;
  }
  function startWorld(wi) { showIntro(wi, 0); }
  function showIntro(wi, qi) {
    const w = S.data.worlds[wi], q = w.questions[qi];
    scene({ theme: w.theme, char: guideOf(w), expr: 'explain',
      content: [h('div', { class: 'px-panel glass', style: 'max-width:520px' },
        h('p', { class: 'q-label' }, q.label), h('p', { class: 'q-obj' }, q.objective || w.name)),
        btn('EMPEZAR RETO ▶', () => showQuestion(wi, qi), 'pink')] });
  }
  function showQuestion(wi, qi) {
    const w = S.data.worlds[wi], q = w.questions[qi];
    const box = h('div', { class: 'opts' });
    q.options.forEach((o, i) => box.append(h('button', { class: 'px-btn', onclick: async (e) => {
      box.querySelectorAll('button').forEach((b) => (b.disabled = true));
      try {
        const res = await api('POST', '/api/check', { token: S.token, question_id: q.id, choice: i });
        showFeedback(wi, qi, res.correct);
      } catch (err) { alert(err.message); box.querySelectorAll('button').forEach((b) => (b.disabled = false)); }
    } }, `${String.fromCharCode(65 + i)}] ${o}`)));
    scene({ theme: w.theme, char: guideOf(w), expr: 'think',
      content: [h('div', { class: 'px-panel glass', style: 'max-width:580px;width:100%' },
        h('p', { class: 'q-label' }, q.label), h('p', { class: 'q-text' }, q.prompt), box)] });
  }
  function showFeedback(wi, qi, ok) {
    const w = S.data.worlds[wi], last = qi === w.questions.length - 1;
    if (ok) {
      scene({ theme: w.theme, char: guideOf(w), expr: 'cheer',
        content: [h('div', { class: 'px-panel glass' }, h('h2', {}, '¡Lo lograste!'), h('p', { class: 'q-obj' }, '¿Listo para el siguiente reto?')),
          btn('¡VAMOS POR MÁS!', () => (last ? showCheckpoint(wi) : showIntro(wi, qi + 1)), 'pink')] });
    } else {
      scene({ theme: w.theme, char: guideOf(w), expr: 'write',
        content: [h('div', { class: 'px-panel glass' }, h('h2', {}, '¡Casi lo tienes!')),
          btn('¿INTENTAMOS DE NUEVO?', () => showQuestion(wi, qi), 'pink')] });
    }
  }
  function showCheckpoint(wi) {
    const w = S.data.worlds[wi]; S.done[w.id] = true;
    const medal = h('canvas', { class: 'medal-pop', style: 'width:96px;height:96px' }); PX.drawMedal(medal, w.medal);
    const status = h('p', { class: 'save-status' }, '💾 Guardando tus respuestas…');
    const next = S.data.worlds[wi + 1];
    const nextBtn = next ? btn(`CONTINUAR AL MUNDO ${wi + 2}`, () => startWorld(wi + 1), 'pink') : null;
    const mapBtn = btn('VOLVER AL MAPA', showMap, next ? 'small' : 'pink');
    [nextBtn, mapBtn].forEach((b) => b && (b.disabled = true));
    scene({ theme: w.theme, char: guideOf(w), expr: 'cheer', confetti: true,
      content: [h('div', { class: 'px-panel glass', style: 'max-width:520px' }, h('h2', {}, `¡Check-point del Mundo ${wi + 1}!`), medal,
        h('p', { class: 'q-obj' }, w.checkpoint_text || '¡Mundo completado!'), status), nextBtn, mapBtn] });
    const save = async () => {
      try {
        await api('POST', '/api/world_done', { token: S.token, world_id: w.id });
        status.textContent = '✔ Respuestas guardadas automáticamente'; status.className = 'save-status ok';
        [nextBtn, mapBtn].forEach((b) => b && (b.disabled = false));
      } catch (e) {
        status.className = 'save-status bad'; status.textContent = '⚠ No se pudo guardar: ' + e.message + ' ';
        status.append(btn('REINTENTAR', () => { status.textContent = '💾 Guardando…'; save(); }, 'small'));
      }
    };
    save();
  }
  async function finish() {
    try {
      const res = await api('POST', '/api/finish', { token: S.token, avatar: S.avatar });
      showDone(res);
    } catch (e) { alert(e.message); }
  }
  function showDone(res) {
    const trophy = h('canvas', { style: 'width:96px;height:96px' }); PX.drawMedal(trophy, 'trofeo');
    scene({ theme: 'atardecer', char: S.avatar, expr: 'cheer',
      content: [h('div', { class: 'px-panel glass', style: 'max-width:540px' }, h('h2', {}, '🏆 ¡FELICIDADES, MISIÓN CUMPLIDA! 🏆'), trophy,
        h('p', { class: 'q-obj' }, S.data.settings.final_message),
        h('p', { class: 'score' }, `Aciertos a la primera: ${res.first_try} de ${res.total}`)),
        btn('🔄 JUGAR DE NUEVO', () => { S.token = newToken(); S.done = {}; showProfile(); }, 'pink')] });
  }

  api('GET', '/api/game').then((d) => {
    if (!d.worlds.length) { stage.append(h('div', { class: 'ui' }, h('div', { class: 'px-panel' }, 'Aún no hay mundos configurados.'))); return; }
    S.data = d; showTitle();
  }).catch((e) => { stage.textContent = 'No se pudo cargar el juego: ' + e.message; });
})();
