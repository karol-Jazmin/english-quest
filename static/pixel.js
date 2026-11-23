/* Motor pixel art compartido: personaje editable, fondos, islas, medallas y editor de avatar */
(function () {
  const PX = (window.PX = {});

  PX.h = function (tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat(Infinity)) {
      if (c == null || c === false) continue;
      e.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return e;
  };
  const h = PX.h;

  PX.THEMES = { cielo: 'Cielo de día', ciudad: 'Ciudad', noche: 'Noche estrellada', atardecer: 'Atardecer', bosque: 'Bosque' };
  PX.MEDALS = { bronce: 'Medalla de bronce', plata: 'Medalla de plata', oro: 'Medalla de oro', trofeo: 'Trofeo' };
  PX.SKINS = ['#fbe0c3', '#f2c9a0', '#e0ac7e', '#c68642', '#8d5524', '#5a3825'];
  PX.HAIR_STYLES = { bun: 'Moño', short: 'Corto', long: 'Largo', spiky: 'Puntas', cap: 'Gorra' };
  PX.OUTFIT_STYLES = { robe: 'Bata', tshirt: 'Polo', hoodie: 'Hoodie' };
  PX.ACCESSORIES = { none: 'Ninguno', glasses: 'Lentes', headphones: 'Audífonos', book: 'Libro' };
  PX.EXPRESSIONS = { neutral: 'Normal', wave: 'Saludando', think: 'Pensando', cheer: 'Celebrando', sad: 'Triste', write: 'Anotando', explain: 'Explicando' };
  PX.DEFAULT_GUIDE = { skin: '#f2c9a0', hair: '#8a4b2d', hairStyle: 'bun', outfit: '#a3237c', outfitStyle: 'robe', accessory: 'none' };
  PX.DEFAULT_STUDENT = { skin: '#e0ac7e', hair: '#2b2b3a', hairStyle: 'short', outfit: '#2b7bd1', outfitStyle: 'hoodie', accessory: 'none' };

  PX.shade = function (hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.max(0, Math.min(255, v + amt));
    return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, '0')).join('');
  };

  /* ---------------- personaje (22x28 pixeles lógicos) ---------------- */
  PX.drawChar = function (canvas, cfg, expr = 'neutral', scale = 8) {
    cfg = Object.assign({}, PX.DEFAULT_GUIDE, cfg || {});
    const W = 24, H = 30;
    const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H;
    const g = tmp.getContext('2d');
    const r = (x, y, w, hh, c) => { g.fillStyle = c; g.fillRect(x + 2, y + 1, w, hh); };
    const { skin, hair, outfit } = cfg;
    const eye = '#2b1b3a', mouth = '#b5524a';
    const oD = PX.shade(outfit, -45), oL = PX.shade(outfit, 45);
    const closed = expr === 'wave' || expr === 'cheer';
    const leftUp = expr === 'cheer';

    // pelo trasero
    if (cfg.hairStyle === 'long') r(5, 4, 10, 12, hair);
    if (cfg.hairStyle === 'bun') { r(8, 0, 5, 3, hair); r(9, 0, 3, 1, PX.shade(hair, 30)); }
    // piernas
    r(6, 22, 3, 5, '#3b3b66'); r(11, 22, 3, 5, '#3b3b66');
    r(5, 27, 4, 1, '#1d1d2b'); r(11, 27, 4, 1, '#1d1d2b');
    // torso
    r(5, 13, 10, 9, outfit);
    r(9, 12, 2, 1, skin);
    if (cfg.outfitStyle === 'robe') { r(8, 13, 4, 1, '#fff'); r(9, 14, 2, 1, '#fff'); r(5, 19, 10, 1, oD); }
    else if (cfg.outfitStyle === 'tshirt') { r(8, 13, 4, 1, oD); r(5, 21, 10, 1, oD); }
    else { r(6, 12, 3, 2, oL); r(11, 12, 3, 2, oL); r(7, 18, 6, 3, oD); }

    // brazos
    const armDown = (x) => { r(x, 13, 2, 7, outfit); r(x, 20, 2, 2, skin); };
    const armUp = (x, hx) => { r(x, 13, 2, 2, outfit); r(hx, 8, 2, 6, outfit); r(hx, 6, 2, 2, skin); };
    if (leftUp) armUp(3, 2); else if (expr === 'write') { r(3, 13, 2, 5, outfit); r(3, 17, 2, 2, skin); } else armDown(3);
    if (expr === 'wave' || expr === 'cheer') armUp(15, 16);
    else if (expr === 'think') { r(15, 13, 2, 3, outfit); r(12, 14, 4, 2, outfit); }
    else if (expr === 'explain') { r(15, 13, 2, 2, outfit); r(17, 13, 2, 2, outfit); r(19, 12, 2, 3, skin); }
    else armDown(15);
    if (cfg.accessory === 'book' && !leftUp && expr !== 'write') { r(0, 18, 6, 5, '#6b3f2a'); r(1, 19, 4, 3, '#f5e6c8'); }
    if (expr === 'write') { r(0, 16, 5, 6, '#ffffff'); r(0, 16, 5, 1, '#9aa'); r(5, 17, 1, 4, '#2b5a9a'); }

    // cabeza
    r(6, 5, 8, 7, skin);
    const st = cfg.hairStyle;
    if (st === 'cap') {
      r(5, 2, 10, 3, outfit); r(5, 5, 11, 1, oD); r(5, 6, 1, 3, hair); r(14, 6, 1, 3, hair);
    } else if (st === 'spiky') {
      r(5, 3, 10, 2, hair); r(6, 1, 2, 2, hair); r(9, 0, 2, 3, hair); r(12, 1, 2, 2, hair);
      r(6, 5, 3, 1, hair); r(11, 5, 3, 1, hair); r(5, 5, 1, 3, hair); r(14, 5, 1, 3, hair);
    } else {
      r(5, 3, 10, 3, hair); r(7, 3, 3, 1, PX.shade(hair, 35));
      if (st === 'short') { r(5, 6, 1, 2, hair); r(14, 6, 1, 2, hair); }
      else { r(5, 6, 2, 4, hair); r(13, 6, 2, 4, hair); }
    }
    // ojos
    if (closed) { r(7, 9, 2, 1, eye); r(11, 9, 2, 1, eye); }
    else { r(7, 8, 2, 2, eye); r(11, 8, 2, 2, eye); r(7, 8, 1, 1, '#fff'); r(11, 8, 1, 1, '#fff'); }
    // boca / gestos
    if (expr === 'wave' || expr === 'cheer') {
      r(8, 10, 4, 2, '#b3263b'); r(8, 10, 4, 1, '#fff'); r(6, 10, 1, 1, '#ff9aa8'); r(13, 10, 1, 1, '#ff9aa8');
    } else if (expr === 'sad') {
      r(9, 10, 2, 1, mouth); r(8, 11, 1, 1, mouth); r(11, 11, 1, 1, mouth); r(7, 10, 1, 2, '#7fd4ff'); r(7, 7, 2, 1, hair);
    } else if (expr === 'think') {
      r(10, 10, 1, 1, mouth); r(11, 7, 2, 1, hair); r(11, 12, 2, 3, skin);
    } else if (expr === 'write') {
      r(8, 10, 1, 1, mouth); r(9, 11, 2, 1, mouth); r(11, 10, 1, 1, mouth);
    } else {
      r(9, 10, 2, 1, mouth);
    }
    // accesorios
    if (cfg.accessory === 'glasses') {
      const fr = '#222';
      [6, 10].forEach((x) => { r(x, 7, 4, 1, fr); r(x, 10, 4, 1, fr); r(x, 8, 1, 2, fr); r(x + 3, 8, 1, 2, fr); });
    } else if (cfg.accessory === 'headphones') {
      r(5, 2, 10, 1, '#222'); r(5, 3, 1, 2, '#222'); r(14, 3, 1, 2, '#222'); r(4, 5, 2, 4, '#e74c3c'); r(14, 5, 2, 4, '#e74c3c');
    }
    // mejoras: mejillas, brillo de ojos, sombra bajo el pelo y zapatos
    if (!closed) { r(6, 10, 1, 1, '#ff9aa8'); r(13, 10, 1, 1, '#ff9aa8'); }
    r(6, 6, 8, 1, PX.shade(skin, -22)); r(5, 27, 4, 1, '#fff'); r(11, 27, 4, 1, '#fff');
    // contorno oscuro + sombra lateral y escalado nítido
    const img = g.getImageData(0, 0, W, H), d = img.data, src = new Uint8ClampedArray(d);
    const A = (x, y) => x >= 0 && y >= 0 && x < W && y < H && src[(y * W + x) * 4 + 3] > 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (A(x, y)) { if (!A(x + 1, y)) for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, src[i + k] - 28); }
      else if (A(x - 1, y) || A(x + 1, y) || A(x, y - 1) || A(x, y + 1)) { d[i] = 42; d[i + 1] = 16; d[i + 2] = 48; d[i + 3] = 255; }
    }
    g.putImageData(img, 0, 0);
    canvas.width = W * scale; canvas.height = H * scale;
    const out = canvas.getContext('2d'); out.imageSmoothingEnabled = false;
    out.clearRect(0, 0, canvas.width, canvas.height); out.drawImage(tmp, 0, 0, canvas.width, canvas.height);
  };

  /* ---------------- fondos (320x180) ---------------- */
  const bgCache = {};
  function bands(g, colors, y0, y1) {
    const hh = (y1 - y0) / colors.length;
    colors.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, Math.floor(y0 + i * hh), 320, Math.ceil(hh) + 1); });
  }
  function cloud(g, x, y, w, c, s) {
    g.fillStyle = c; g.fillRect(x + 6, y, w - 12, 5); g.fillRect(x, y + 5, w, 6); g.fillRect(x + 3, y - 3, w / 2, 4);
    g.fillStyle = s; g.fillRect(x, y + 9, w, 2);
  }
  function build(g, theme) {
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const ground = (y, a, b, dirt) => {
      g.fillStyle = a; g.fillRect(0, y, 320, 6); g.fillStyle = b; g.fillRect(0, y + 6, 320, 6);
      g.fillStyle = dirt; g.fillRect(0, y + 12, 320, 180 - y);
      g.fillStyle = PX.shade(dirt, -25);
      for (let i = 0; i < 60; i++) g.fillRect(Math.floor(rnd() * 320), y + 14 + Math.floor(rnd() * (160 - y)), 3, 2);
    };
    if (theme === 'ciudad') {
      bands(g, ['#6fbde8', '#85c8ea', '#a2d6f0', '#c6e6f6'], 0, 150);
      let x = -4;
      while (x < 320) {
        const w = 22 + Math.floor(rnd() * 16), hgt = 50 + Math.floor(rnd() * 60);
        const col = ['#9fb0c4', '#8197b3', '#b8c5d6'][Math.floor(rnd() * 3)];
        g.fillStyle = col; g.fillRect(x, 150 - hgt, w, hgt);
        g.fillStyle = PX.shade(col, 40);
        for (let yy = 150 - hgt + 5; yy < 144; yy += 8) for (let xx = x + 4; xx < x + w - 4; xx += 7) g.fillRect(xx, yy, 3, 4);
        x += w + 2;
      }
      g.fillStyle = '#7b8196'; g.fillRect(0, 150, 320, 6); g.fillStyle = '#4a4f66'; g.fillRect(0, 156, 320, 24);
      g.fillStyle = '#f2d36b'; for (let i = 0; i < 320; i += 28) g.fillRect(i, 167, 14, 2);
    } else if (theme === 'noche') {
      bands(g, ['#0f0f2e', '#17174a', '#232366', '#32307f', '#46439a'], 0, 140);
      g.fillStyle = '#fff';
      for (let i = 0; i < 55; i++) g.fillRect(Math.floor(rnd() * 320), Math.floor(rnd() * 120), rnd() > 0.8 ? 2 : 1, rnd() > 0.8 ? 2 : 1);
      g.fillStyle = '#fff6c9';
      for (let dy = -14; dy <= 14; dy++) { const dx = Math.floor(Math.sqrt(196 - dy * dy)); g.fillRect(262 - dx, 34 + dy, dx * 2, 1); }
      g.fillStyle = '#e4d9a0'; g.fillRect(256, 30, 4, 4); g.fillRect(268, 40, 3, 3);
      g.fillStyle = '#1a1a55'; for (let x = 0; x < 320; x += 4) g.fillRect(x, 100 + Math.round(Math.abs(Math.sin(x / 35)) * -26) + 26, 4, 50);
      ground(140, '#2d5f4e', '#1d3d3a', '#10282a');
    } else if (theme === 'atardecer') {
      bands(g, ['#f4a9e8', '#f7b6ee', '#f2a0e8', '#e48cf0', '#c978ec', '#b774e8', '#9a5be0', '#8a4fd6'], 0, 180);
      g.fillStyle = '#ffe27a'; for (let dy = -22; dy <= 22; dy++) { const dx = Math.floor(Math.sqrt(484 - dy * dy)); if (dy < 4 || dy % 6 < 4) g.fillRect(160 - dx, 92 + dy, dx * 2, 1); }
      for (let i = 0; i < 5; i++) cloud(g, Math.floor(rnd() * 300) - 10, 10 + Math.floor(rnd() * 60), 34 + Math.floor(rnd() * 40), '#efdcff', '#b794f0');
      g.fillStyle = '#5b2f9e'; for (let x = 0; x < 320; x += 4) g.fillRect(x, 112 + Math.round(Math.abs(Math.sin(x / 28)) * -22) + 18, 4, 70);
      g.fillStyle = '#3d1f73'; g.fillRect(0, 150, 320, 30);
    } else if (theme === 'bosque') {
      bands(g, ['#8fd6c8', '#a7e2d2', '#c3eedc', '#dcf7e8'], 0, 130);
      g.fillStyle = '#4faa6d'; for (let x = 0; x < 320; x += 4) g.fillRect(x, 96 + Math.round(Math.sin(x / 40) * 10), 4, 40);
      for (let i = 0; i < 14; i++) {
        const x = Math.floor(rnd() * 310), y = 110 + Math.floor(rnd() * 12), s = 20 + Math.floor(rnd() * 14);
        g.fillStyle = '#6b3f1d'; g.fillRect(x + s / 2 - 2, y + s, 4, 10);
        g.fillStyle = '#1f6f3a';
        for (let k = 0; k < 3; k++) g.fillRect(x + k * 3, y + k * (s / 3), s - k * 6, Math.ceil(s / 3));
      }
      ground(130, '#58c05a', '#3a9a3a', '#6b4a2a');
    } else { // cielo
      bands(g, ['#55b9ee', '#6cc3f1', '#86cff4', '#a9ddf8', '#cdeafb', '#e1f4fe'], 0, 125);
      for (let i = 0; i < 6; i++) cloud(g, Math.floor(rnd() * 290), 8 + Math.floor(rnd() * 80), 36 + Math.floor(rnd() * 40), '#ffffff', '#cfd8e6');
      g.fillStyle = '#4fcf4f'; for (let x = 0; x < 320; x += 8) g.fillRect(x, 112 + (x % 16 ? 4 : 0), 8, 14);
      g.fillStyle = '#fff3a0'; for (let dy = -12; dy <= 12; dy++) { const dx = Math.floor(Math.sqrt(144 - dy * dy)); g.fillRect(48 - dx, 28 + dy, dx * 2, 1); }
      g.fillStyle = '#ffd23f'; for (let dy = -8; dy <= 8; dy++) { const dx = Math.floor(Math.sqrt(64 - dy * dy)); g.fillRect(48 - dx, 28 + dy, dx * 2, 1); }
      g.fillStyle = '#7fe08a'; for (let x = 0; x < 320; x += 4) g.fillRect(x, 92 + Math.round(Math.sin(x / 30) * 8), 4, 30);
      ground(122, '#5fd35f', '#34a83a', '#b0763a');
      g.fillStyle = '#ff6b9d'; for (let i = 0; i < 18; i++) g.fillRect(Math.floor(rnd() * 316), 124 + Math.floor(rnd() * 8), 2, 2);
    }
  }
  PX.drawBg = function (canvas, theme) {
    canvas.width = 320; canvas.height = 180;
    if (!bgCache[theme]) {
      const c = document.createElement('canvas'); c.width = 320; c.height = 180;
      build(c.getContext('2d'), theme); bgCache[theme] = c;
    }
    canvas.getContext('2d').drawImage(bgCache[theme], 0, 0);
  };

  /* ---------------- isla y medalla ---------------- */
  PX.drawIsland = function (canvas, i) {
    canvas.width = 80; canvas.height = 60;
    const g = canvas.getContext('2d');
    const r = (x, y, w, hh, c) => { g.fillStyle = c; g.fillRect(x, y, w, hh); };
    const col = ['#4fbf4f', '#5ec8c0', '#e0a84a', '#b27be0', '#e06a6a', '#6aa8e0'][i % 6];
    r(8, 52, 64, 2, '#7fd4ff'); r(16, 55, 48, 1, '#a8e6ff');
    r(8, 20, 64, 8, col); r(6, 22, 68, 4, col); r(8, 18, 64, 2, PX.shade(col, 40)); r(6, 26, 68, 2, PX.shade(col, -50));
    for (let k = 0; k < 20; k++) r(8 + k, 28 + k, 64 - 2 * k, 1, k % 3 ? '#8a5a2b' : '#6e4520');
    r(36, 30, 3, 14, '#7fd4ff'); r(37, 44, 1, 6, '#c8f0ff');
    r(16, 8, 6, 10, '#2e8b3a'); r(14, 12, 10, 3, '#3fae4d'); r(18, 18, 2, 3, '#6b3f1d');
    r(54, 6, 6, 12, '#2e8b3a'); r(52, 10, 10, 3, '#3fae4d'); r(56, 18, 2, 3, '#6b3f1d');
    r(30, 8, 14, 10, '#f5e6c8'); r(28, 5, 18, 4, '#d33'); r(32, 5, 10, 1, '#ff7a7a'); r(35, 12, 4, 6, '#6b3f2a'); r(31, 10, 3, 3, '#7fd4ff'); r(41, 10, 3, 3, '#7fd4ff');
    r(66, 10, 1, 10, '#6b3f1d'); r(67, 10, 6, 4, '#ffd23f');
    const o = '#2a1030'; r(6, 29, 1, 1, o);
  };
  PX.drawMedal = function (canvas, kind) {
    canvas.width = 48; canvas.height = 48;
    const g = canvas.getContext('2d');
    const r = (x, y, w, hh, c) => { g.fillStyle = c; g.fillRect(x, y, w, hh); };
    const pal = { bronce: ['#c27a3a', '#8a4f1e'], plata: ['#cfd6de', '#8d98a6'], oro: ['#ffd23f', '#c9921a'], trofeo: ['#ffd23f', '#c9921a'] }[kind] || ['#ffd23f', '#c9921a'];
    if (kind === 'trofeo') {
      r(12, 6, 24, 16, pal[0]); r(14, 22, 20, 4, pal[0]); r(7, 9, 5, 10, pal[1]); r(36, 9, 5, 10, pal[1]);
      r(21, 26, 6, 8, pal[1]); r(14, 34, 20, 5, pal[0]); r(12, 39, 24, 4, pal[1]); r(16, 8, 4, 10, '#fff3b0');
    } else {
      r(17, 0, 5, 16, '#d33'); r(26, 0, 5, 16, '#36c');
      for (let dy = -14; dy <= 14; dy++) { const dx = Math.floor(Math.sqrt(196 - dy * dy)); r(24 - dx, 30 + dy, dx * 2, 1, pal[1]); }
      for (let dy = -11; dy <= 11; dy++) { const dx = Math.floor(Math.sqrt(121 - dy * dy)); r(24 - dx, 30 + dy, dx * 2, 1, pal[0]); }
      r(22, 24, 4, 12, '#fff8'); r(18, 28, 12, 4, '#fff8');
    }
    r(2, 6, 1, 3, '#fff'); r(1, 7, 3, 1, '#fff'); r(44, 20, 1, 3, '#fff'); r(43, 21, 3, 1, '#fff');
  };

  /* ---------------- efectos animados ---------------- */
  PX.fx = function (theme) {
    const box = h('div', { class: 'fx' });
    const R = (a, b) => a + Math.random() * (b - a);
    if (theme === 'noche') for (let i = 0; i < 26; i++) box.append(h('i', { class: 'star', style: `left:${R(0, 98)}%;top:${R(2, 60)}%;animation-delay:${R(0, 3)}s` }));
    else if (theme === 'bosque') for (let i = 0; i < 16; i++) box.append(h('i', { class: 'ff', style: `left:${R(2, 96)}%;top:${R(35, 85)}%;animation-delay:${R(0, 4)}s;animation-duration:${R(3, 6)}s` }));
    else for (let i = 0; i < 3; i++) {
      const c = h('canvas', { class: 'drift', style: `top:${R(4, 38)}%;animation-duration:${R(40, 75)}s;animation-delay:-${R(0, 60)}s` });
      c.width = 56; c.height = 20; cloud(c.getContext('2d'), 6, 6, 44, theme === 'atardecer' ? '#efdcff' : '#fff', theme === 'atardecer' ? '#b794f0' : '#cfd8e6');
      box.append(c);
    }
    return box;
  };
  PX.confetti = function () {
    const box = h('div', { class: 'fx confetti' }), cols = ['#ff6b9d', '#ffd23f', '#4fcf4f', '#5ec8f0', '#b27be0'];
    for (let i = 0; i < 40; i++) box.append(h('i', { style: `left:${Math.random() * 100}%;background:${cols[i % 5]};animation-delay:${Math.random() * 1.5}s;animation-duration:${2 + Math.random() * 2}s` }));
    return box;
  };

  /* ---------------- editor de personaje (jugador y administradora) ---------------- */
  PX.avatarEditor = function (cfg, onChange, opts = {}) {
    let expr = 'neutral';
    const prev = h('canvas', { class: 'char-prev' });
    const redraw = () => PX.drawChar(prev, cfg, expr, 8);
    const upd = (k, v) => { cfg[k] = v; redraw(); if (onChange) onChange(cfg); };
    const select = (k, map) => h('select', { onchange: (e) => upd(k, e.target.value) },
      Object.entries(map).map(([v, l]) => h('option', { value: v, selected: cfg[k] === v }, l)));
    const swatches = h('div', { class: 'swatches' });
    const paintSw = () => {
      swatches.replaceChildren(...PX.SKINS.map((c) => h('button', {
        type: 'button', class: 'sw' + (cfg.skin === c ? ' on' : ''), style: 'background:' + c, title: 'Tono de piel',
        onclick: () => { upd('skin', c); paintSw(); },
      })));
    };
    paintSw();
    const color = (k) => h('input', { type: 'color', value: cfg[k], oninput: (e) => upd(k, e.target.value) });
    const rand = () => {
      const pick = (a) => a[Math.floor(Math.random() * a.length)];
      const rc = () => '#' + Array.from({ length: 3 }, () => (40 + Math.floor(Math.random() * 180)).toString(16).padStart(2, '0')).join('');
      Object.assign(cfg, { skin: pick(PX.SKINS), hair: rc(), outfit: rc(), hairStyle: pick(Object.keys(PX.HAIR_STYLES)),
        outfitStyle: pick(Object.keys(PX.OUTFIT_STYLES)), accessory: pick(Object.keys(PX.ACCESSORIES)) });
      if (onChange) onChange(cfg);
      root.replaceWith((root = PX.avatarEditor(cfg, onChange, opts)));
    };
    const row = (label, el) => h('label', { class: 'fld' }, h('span', {}, label), el);
    const exprSel = opts.expr ? row('Expresión de vista previa', h('select', { onchange: (e) => { expr = e.target.value; redraw(); } },
      Object.entries(PX.EXPRESSIONS).map(([v, l]) => h('option', { value: v }, l)))) : null;
    let root = h('div', { class: 'avatar-editor' },
      h('div', { class: 'prev-wrap' }, prev),
      h('div', { class: 'controls' },
        row('Piel', swatches), row('Peinado', select('hairStyle', PX.HAIR_STYLES)), row('Color de pelo', color('hair')),
        row('Ropa', select('outfitStyle', PX.OUTFIT_STYLES)), row('Color de ropa', color('outfit')),
        row('Accesorio', select('accessory', PX.ACCESSORIES)), exprSel,
        h('button', { type: 'button', class: 'px-btn small', onclick: rand }, '🎲 AL AZAR')));
    redraw();
    return root;
  };
})();
