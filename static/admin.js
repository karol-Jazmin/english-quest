/* Panel de administración */
(() => {
  const { h } = PX;
  const app = document.getElementById('app');
  let ME = null, TAB = 'results';

  async function api(method, url, body) {
    const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    let data = null; try { data = await r.json(); } catch (e) {}
    if (!r.ok) { const err = new Error((data && data.error) || 'Error ' + r.status); err.status = r.status; throw err; }
    return data;
  }
  function toast(msg, bad) {
    const t = h('div', { class: 'toast' + (bad ? ' bad' : '') }, msg); document.body.append(t); setTimeout(() => t.remove(), 3200);
  }
  const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { if (e.status === 401) boot(); else toast(e.message, true); } };
  function modal(title, content, buttons) {
    const bg = h('div', { class: 'modal-bg' });
    const close = () => bg.remove();
    bg.append(h('div', { class: 'modal' }, h('h2', {}, title), content,
      h('div', { class: 'foot' }, [h('button', { class: 'px-btn small', onclick: close }, 'CERRAR'),
        ...buttons.map(([t, fn, cls]) => h('button', { class: 'px-btn small ' + (cls || 'pink'), onclick: guard(async () => { if ((await fn()) !== false) close(); }) }, t))])));
    bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
    document.body.append(bg);
    return close;
  }
  const fld = (l, el) => h('label', { class: 'fld' }, h('span', {}, l), el);
  const fmt = (s) => s.replace(' ', ' · ');
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  function thumb(av, scale = 3) { const c = h('canvas', { style: `height:${scale * 28}px;width:auto` }); PX.drawChar(c, av, 'neutral', scale); return c; }

  /* ---------- login ---------- */
  function loginView() {
    const u = h('input', { type: 'text', autocomplete: 'username' }), p = h('input', { type: 'password', autocomplete: 'current-password' });
    const err = h('div', { class: 'err' });
    const go = async () => { try { await api('POST', '/api/admin/login', { username: u.value, password: p.value }); boot(); } catch (e) { err.textContent = e.message; } };
    p.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    app.replaceChildren(h('div', { class: 'card login' }, h('h3', {}, 'English Quest · Administración'),
      h('div', { class: 'controls' }, fld('Usuario', u), fld('Contraseña', p), err, h('button', { class: 'px-btn purple', onclick: go }, 'ENTRAR'))));
    u.focus();
  }

  /* ---------- estructura ---------- */
  const TABS = { results: 'Resultados', stats: 'Por pregunta', worlds: 'Mundos y preguntas', texts: 'Textos', users: 'Administradores' };
  async function boot() {
    try { ME = await api('GET', '/api/admin/me'); } catch (e) { return loginView(); }
    render();
  }
  function render() {
    const box = h('div', {});
    app.replaceChildren(
      h('div', { class: 'adm-head' }, h('h1', {}, 'ENGLISH QUEST · PANEL'),
        h('div', {}, `${ME.display_name} (${ME.username}) `, h('button', { class: 'px-btn small', onclick: async () => { await api('POST', '/api/admin/logout', {}); boot(); } }, 'SALIR'))),
      ME.default_password ? h('div', { class: 'banner', style: 'margin-top:16px' }, '⚠ Sigues usando la contraseña por defecto (admin123). Cámbiala en la pestaña Administradores.') : null,
      h('div', { class: 'tabs' }, Object.entries(TABS).map(([k, l]) => h('button', { class: k === TAB ? 'on' : '', onclick: () => { TAB = k; render(); } }, l))), box);
    ({ results: tabResults, stats: tabStats, worlds: tabWorlds, texts: tabTexts, users: tabUsers })[TAB](box).catch((e) => { if (e.status === 401) boot(); else box.append(h('div', { class: 'banner' }, e.message)); });
  }

  /* ---------- resultados ---------- */
  async function tabResults(box) {
    const all = await api('GET', '/api/admin/submissions');
    const q = h('input', { type: 'text', placeholder: 'Buscar por nombre…' });
    const courses = [...new Set(all.map((s) => s.course))].sort(), cycles = [...new Set(all.map((s) => s.cycle))].sort();
    const selC = h('select', {}, h('option', { value: '' }, 'Todos los cursos'), courses.map((c) => h('option', { value: c }, c)));
    const selY = h('select', {}, h('option', { value: '' }, 'Todos los ciclos'), cycles.map((c) => h('option', { value: c }, c)));
    const kpis = h('div', { class: 'cards' }), body = h('tbody', {});
    const draw = () => {
      const list = all.filter((s) => s.full_name.toLowerCase().includes(q.value.toLowerCase()) && (!selC.value || s.course === selC.value) && (!selY.value || s.cycle === selY.value));
      const tot = list.reduce((a, s) => a + s.total, 0), ok = list.reduce((a, s) => a + s.first_try, 0);
      kpis.replaceChildren(
        h('div', { class: 'kpi' }, h('b', {}, list.length), h('span', {}, 'Estudiantes')),
        h('div', { class: 'kpi' }, h('b', {}, pct(ok, tot) + '%'), h('span', {}, 'Aciertos a la primera')),
        h('div', { class: 'kpi' }, h('b', {}, list.length ? (list.reduce((a, s) => a + s.attempts_count, 0) / list.length).toFixed(1) : 0), h('span', {}, 'Intentos por estudiante')));
      body.replaceChildren(...list.map((s) => h('tr', { class: 'click', onclick: guard(() => detail(s.id)) },
        h('td', {}, thumb(s.avatar, 2)), h('td', {}, s.full_name), h('td', {}, s.cycle), h('td', {}, s.course),
        h('td', {}, `${s.first_try}/${s.total} (${pct(s.first_try, s.total)}%)`), h('td', {}, s.attempts_count), h('td', {}, s.finished ? '✔ Finalizado' : `En juego (${s.worlds_done} mundos)`), h('td', {}, fmt(s.created_at)))));
      if (!list.length) body.append(h('tr', {}, h('td', { colspan: 8 }, 'Aún no hay resultados.')));
    };
    [q, selC, selY].forEach((e) => e.addEventListener('input', draw));
    box.append(kpis, h('div', { class: 'card' },
      h('div', { class: 'toolbar' }, q, selC, selY, h('a', { class: 'px-btn small', href: '/api/admin/export.csv', style: 'text-decoration:none' }, '⬇ EXPORTAR CSV')),
      h('div', { class: 'tw' }, h('table', {}, h('thead', {}, h('tr', {}, ['', 'Nombre', 'Ciclo', 'Curso', 'Aciertos 1.er intento', 'Intentos', 'Estado', 'Fecha'].map((t) => h('th', {}, t)))), body))));
    draw();
  }
  async function detail(id) {
    const s = await api('GET', '/api/admin/submissions/' + id);
    const groups = [];
    s.attempts.forEach((a) => {
      let g = groups.find((x) => x.prompt === a.prompt && x.label === a.label);
      if (!g) groups.push((g = { world: a.world_name, label: a.label, prompt: a.prompt, correct: a.correct_text, list: [] }));
      g.list.push(a);
    });
    const rows = groups.map((g) => h('tr', {}, h('td', {}, g.world), h('td', {}, h('b', {}, g.label), h('br'), g.prompt),
      h('td', {}, g.list.map((a) => h('span', { class: 'chip ' + (a.is_correct ? 'ok' : 'no') }, `${a.attempt_no}. ${a.chosen_text} ${a.is_correct ? '✔' : '✘'}`))),
      h('td', {}, g.list.some((a) => a.is_correct) ? '✔ ' + g.correct : '✘ Sin acertar')));
    modal(s.full_name, h('div', {}, h('div', { style: 'display:flex;gap:14px;align-items:center;margin-bottom:12px' }, thumb(s.avatar, 3),
      h('div', {}, h('div', {}, `Ciclo: ${s.cycle} · Curso: ${s.course}`), h('div', {}, `Aciertos a la primera: ${s.first_try}/${s.total}`), h('div', {}, `Total de intentos: ${s.attempts_count}`), h('div', {}, fmt(s.created_at)))),
      h('div', { class: 'tw' }, h('table', {}, h('thead', {}, h('tr', {}, ['Mundo', 'Pregunta', 'Respuestas dadas', 'Correcta'].map((t) => h('th', {}, t)))), h('tbody', {}, rows)))),
      [['ELIMINAR', async () => { if (!confirm('¿Eliminar este resultado?')) return false; await api('DELETE', '/api/admin/submissions/' + id); render(); }, 'danger']]);
  }

  /* ---------- por pregunta ---------- */
  async function tabStats(box) {
    const rows = await api('GET', '/api/admin/stats');
    box.append(h('div', { class: 'card' }, h('h3', {}, 'Rendimiento por pregunta'), h('div', { class: 'tw' }, h('table', {},
      h('thead', {}, h('tr', {}, ['Mundo', 'Pregunta', 'Estudiantes', 'Acierto a la primera', 'Intentos prom.'].map((t) => h('th', {}, t)))),
      h('tbody', {}, rows.length ? rows.map((r) => h('tr', {}, h('td', {}, r.world_name), h('td', {}, h('b', {}, r.label), h('br'), r.prompt), h('td', {}, r.students),
        h('td', {}, h('span', { class: 'bar' }, h('i', { style: `width:${pct(r.first_ok, r.students)}%` })), ` ${pct(r.first_ok, r.students)}%`),
        h('td', {}, (r.attempts / r.students).toFixed(1)))) : h('tr', {}, h('td', { colspan: 5 }, 'Aún no hay datos.')))))));
  }

  /* ---------- mundos y preguntas ---------- */
  async function tabWorlds(box) {
    const worlds = await api('GET', '/api/admin/worlds');
    const act = (fn) => guard(async () => { await fn(); render(); });
    box.append(h('div', { class: 'toolbar' }, h('button', { class: 'px-btn purple small', onclick: () => worldModal(null) }, '+ NUEVO MUNDO')));
    worlds.forEach((w, wi) => {
      const prev = h('canvas', { style: 'height:84px;width:auto' }); PX.drawChar(prev, w.character, 'wave', 3);
      box.append(h('div', { class: 'card' },
        h('div', { class: 'world-head' }, h('div', { style: 'display:flex;gap:10px;align-items:center' }, prev,
          h('div', {}, h('h3', {}, `Mundo ${wi + 1}: ${w.name}`), h('div', {}, `${w.description || ''} · Fondo: ${PX.THEMES[w.theme]} · ${PX.MEDALS[w.medal]}`))),
          h('div', { class: 'row-actions' },
            h('button', { class: 'px-btn small', disabled: wi === 0, onclick: act(() => api('POST', `/api/admin/worlds/${w.id}/move`, { dir: 'up' })) }, '↑'),
            h('button', { class: 'px-btn small', disabled: wi === worlds.length - 1, onclick: act(() => api('POST', `/api/admin/worlds/${w.id}/move`, { dir: 'down' })) }, '↓'),
            h('button', { class: 'px-btn small pink', onclick: () => worldModal(w) }, 'EDITAR MUNDO / PERSONAJE'),
            h('button', { class: 'px-btn small danger', onclick: act(async () => { if (!confirm(`¿Eliminar el mundo "${w.name}" y sus preguntas?`)) throw new Error('Cancelado'); await api('DELETE', '/api/admin/worlds/' + w.id); }) }, 'ELIMINAR'))),
        h('div', { style: 'margin-top:10px' }, w.questions.map((q, qi) => h('div', { class: 'q-item' },
          h('div', {}, h('span', { class: 'tag' }, q.label || 'Pregunta ' + (qi + 1)), q.prompt, h('br'), h('small', {}, q.options.map((o, i) => (i === q.correct ? '✔ ' : '· ') + o).join('   '))),
          h('div', { class: 'row-actions' },
            h('button', { class: 'px-btn small', disabled: qi === 0, onclick: act(() => api('POST', `/api/admin/questions/${q.id}/move`, { dir: 'up' })) }, '↑'),
            h('button', { class: 'px-btn small', disabled: qi === w.questions.length - 1, onclick: act(() => api('POST', `/api/admin/questions/${q.id}/move`, { dir: 'down' })) }, '↓'),
            h('button', { class: 'px-btn small pink', onclick: () => questionModal(w, q) }, 'EDITAR'),
            h('button', { class: 'px-btn small danger', onclick: act(async () => { if (!confirm('¿Eliminar esta pregunta?')) throw new Error('Cancelado'); await api('DELETE', '/api/admin/questions/' + q.id); }) }, '✘'))))),
        h('button', { class: 'px-btn small purple', onclick: () => questionModal(w, null) }, '+ AGREGAR PREGUNTA')));
    });
  }
  function worldModal(w) {
    const d = w ? JSON.parse(JSON.stringify(w)) : { name: '', description: '', theme: 'cielo', medal: 'bronce', checkpoint_text: '', character: { ...PX.DEFAULT_GUIDE } };
    const name = h('input', { type: 'text', value: d.name, maxlength: 80 }), desc = h('input', { type: 'text', value: d.description, maxlength: 120 });
    const cp = h('textarea', { rows: 3, maxlength: 300 }, d.checkpoint_text);
    const bg = h('canvas', { class: 'bg-prev' }); PX.drawBg(bg, d.theme);
    const theme = h('select', { onchange: (e) => { d.theme = e.target.value; PX.drawBg(bg, d.theme); } }, Object.entries(PX.THEMES).map(([v, l]) => h('option', { value: v, selected: d.theme === v }, l)));
    const medal = h('select', { onchange: (e) => (d.medal = e.target.value) }, Object.entries(PX.MEDALS).map(([v, l]) => h('option', { value: v, selected: d.medal === v }, l)));
    modal(w ? 'Editar mundo' : 'Nuevo mundo', h('div', {}, h('div', { class: 'grid2' }, fld('Nombre del mundo', name), fld('Descripción corta (ej. Sesiones 1 a 4)', desc),
      fld('Fondo / escenario', theme), fld('Premio al terminar', medal)), bg,
      fld('Mensaje del check-point', cp), h('h3', { style: 'margin-top:14px' }, 'Personaje guía de este mundo'),
      PX.avatarEditor(d.character, () => {}, { expr: true })),
      [['GUARDAR', async () => {
        const body = { name: name.value, description: desc.value, theme: d.theme, medal: d.medal, checkpoint_text: cp.value, character: d.character };
        if (w) await api('PUT', '/api/admin/worlds/' + w.id, body); else await api('POST', '/api/admin/worlds', body);
        toast('Mundo guardado'); render();
      }]]);
  }
  function questionModal(w, q) {
    const d = q ? JSON.parse(JSON.stringify(q)) : { label: '', objective: '', prompt: '', options: ['', '', ''], correct: 0 };
    if (!q) d.label = `Nivel ${w.id} - Reto ${w.questions.length + 1}`;
    const label = h('input', { type: 'text', value: d.label, maxlength: 80 }), obj = h('input', { type: 'text', value: d.objective, maxlength: 300 });
    const prompt = h('textarea', { rows: 3, maxlength: 500 }, d.prompt);
    const optsBox = h('div', {});
    const drawOpts = () => {
      optsBox.replaceChildren(...d.options.map((o, i) => h('div', { class: 'opt-row' },
        h('input', { type: 'radio', name: 'correct', checked: d.correct === i, onchange: () => (d.correct = i), title: 'Respuesta correcta' }),
        h('b', {}, String.fromCharCode(65 + i) + ']'), h('input', { type: 'text', value: o, maxlength: 200, oninput: (e) => (d.options[i] = e.target.value) }),
        d.options.length > 2 ? h('button', { type: 'button', class: 'px-btn small danger', onclick: () => { d.options.splice(i, 1); if (d.correct >= d.options.length) d.correct = 0; else if (d.correct > i) d.correct--; drawOpts(); } }, '✘') : null)));
      if (d.options.length < 4) optsBox.append(h('button', { type: 'button', class: 'px-btn small', onclick: () => { d.options.push(''); drawOpts(); } }, '+ OPCIÓN'));
    };
    drawOpts();
    modal(q ? 'Editar pregunta' : 'Nueva pregunta · ' + w.name, h('div', {}, h('div', { class: 'grid2' }, fld('Título del nivel', label), fld('Indicador de logro (texto del reto)', obj)),
      fld('Pregunta', prompt), h('p', {}, h('small', {}, 'Marca el círculo de la respuesta correcta (2 a 4 opciones).')), optsBox),
      [['GUARDAR', async () => {
        const body = { label: label.value, objective: obj.value, prompt: prompt.value, options: d.options, correct: d.correct };
        if (q) await api('PUT', '/api/admin/questions/' + q.id, body); else await api('POST', '/api/admin/questions', { ...body, world_id: w.id });
        toast('Pregunta guardada'); render();
      }]]);
  }

  /* ---------- textos ---------- */
  async function tabTexts(box) {
    const s = await api('GET', '/api/admin/settings');
    const f = { title: h('input', { type: 'text', value: s.title, maxlength: 100 }), subtitle: h('input', { type: 'text', value: s.subtitle, maxlength: 160 }),
      instructions: h('textarea', { rows: 5, maxlength: 600 }, s.instructions), final_message: h('textarea', { rows: 4, maxlength: 400 }, s.final_message) };
    box.append(h('div', { class: 'card' }, h('h3', {}, 'Textos del juego'), h('div', { class: 'controls' },
      fld('Título', f.title), fld('Subtítulo', f.subtitle), fld('Instrucciones (una línea por viñeta)', f.instructions), fld('Mensaje final de felicitación', f.final_message),
      h('button', { class: 'px-btn purple small', onclick: guard(async () => {
        await api('PUT', '/api/admin/settings', Object.fromEntries(Object.entries(f).map(([k, el]) => [k, el.value]))); toast('Textos guardados');
      }) }, 'GUARDAR'))));
  }

  /* ---------- administradores ---------- */
  async function tabUsers(box) {
    const users = await api('GET', '/api/admin/users');
    const newUser = () => {
      const u = h('input', { type: 'text', maxlength: 32 }), n = h('input', { type: 'text', maxlength: 80 }), p = h('input', { type: 'password' });
      modal('Nuevo administrador / profesora', h('div', { class: 'controls' }, fld('Nombre (ej. Prof. Ana Pérez)', n), fld('Usuario', u), fld('Contraseña (mín. 6)', p)),
        [['CREAR', async () => { await api('POST', '/api/admin/users', { username: u.value, display_name: n.value, password: p.value }); toast('Administrador creado'); render(); }]]);
    };
    const pass = (u) => {
      const p = h('input', { type: 'password' });
      modal('Nueva contraseña para ' + u.username, h('div', { class: 'controls' }, fld('Contraseña (mín. 6)', p)),
        [['GUARDAR', async () => { await api('PUT', `/api/admin/users/${u.id}/password`, { password: p.value }); toast('Contraseña actualizada'); await boot(); }]]);
    };
    box.append(h('div', { class: 'toolbar' }, h('button', { class: 'px-btn purple small', onclick: newUser }, '+ NUEVO ADMINISTRADOR')),
      h('div', { class: 'card tw' }, h('table', {}, h('thead', {}, h('tr', {}, ['Nombre', 'Usuario', 'Creado', ''].map((t) => h('th', {}, t)))),
        h('tbody', {}, users.map((u) => h('tr', {}, h('td', {}, u.display_name + (u.id === ME.id ? ' (tú)' : '')), h('td', {}, u.username), h('td', {}, fmt(u.created_at)),
          h('td', {}, h('div', { class: 'row-actions' }, h('button', { class: 'px-btn small pink', onclick: () => pass(u) }, 'CAMBIAR CLAVE'),
            u.id === ME.id ? null : h('button', { class: 'px-btn small danger', onclick: guard(async () => { if (!confirm('¿Eliminar a ' + u.username + '?')) return; await api('DELETE', '/api/admin/users/' + u.id); render(); }) }, 'ELIMINAR')))))))));
  }

  boot();
})();
