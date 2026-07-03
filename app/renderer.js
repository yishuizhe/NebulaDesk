(function () {
  'use strict';

  const api = window.nebulaDesk || {};
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d', { alpha: false });
  const isWallpaper = new URLSearchParams(location.search).get('wallpaper') === '1';

  const els = {
    prompt: document.getElementById('prompt-input'),
    generate: document.getElementById('generate-btn'),
    random: document.getElementById('random-btn'),
    presets: document.getElementById('preset-strip'),
    intensity: document.getElementById('intensity'),
    velocity: document.getElementById('velocity'),
    gravity: document.getElementById('gravity'),
    grain: document.getElementById('grain'),
    seed: document.getElementById('seed-label'),
    palette: document.getElementById('palette-label'),
    title: document.getElementById('scene-title'),
    kicker: document.getElementById('scene-kicker'),
    fps: document.getElementById('fps-label'),
    particles: document.getElementById('particle-label'),
    mode: document.getElementById('mode-label'),
    toast: document.getElementById('toast'),
    wallpaper: document.getElementById('wallpaper-btn'),
    export: document.getElementById('export-btn'),
    save: document.getElementById('save-btn'),
    load: document.getElementById('load-btn'),
    copy: document.getElementById('copy-btn'),
    min: document.getElementById('min-btn'),
    max: document.getElementById('max-btn'),
    close: document.getElementById('close-btn'),
  };

  const presetPrompts = [
    ['Aurora Ocean', 'midnight aurora above a quiet cyberpunk ocean, golden dust, cinematic calm, slow drift'],
    ['Solar Bloom', 'solar flare garden, liquid chrome petals, warm bloom, heroic sunrise, high energy'],
    ['Lofi Orbit', 'lofi moon station, violet haze, tiny satellites, soft grain, study mode'],
    ['Deep Signal', 'deep space signal, emerald radar rings, black glass, slow breathing stars'],
    ['Candy Thunder', 'electric candy storm, pink lightning, arcade clouds, fast particles'],
    ['Zen Reactor', 'silent fusion reactor, teal plasma, incense smoke, precise symmetry'],
  ];

  const randomWords = [
    'aurora', 'velvet', 'reactor', 'ocean', 'prism', 'midnight', 'signal', 'golden',
    'orbit', 'garden', 'cyberpunk', 'glass', 'storm', 'quiet', 'cinematic', 'plasma',
    'lotus', 'comet', 'neon', 'ember', 'rain', 'temple', 'hologram', 'moon'
  ];

  let width = 1;
  let height = 1;
  let dpr = 1;
  let particles = [];
  let stars = [];
  let scene = null;
  let raf = 0;
  let lastTime = performance.now();
  let fpsTick = performance.now();
  let fpsFrames = 0;
  let wallpaperRunning = false;
  let toastTimer = 0;

  if (api.isMac) document.body.classList.add('mac');
  if (isWallpaper) document.body.classList.add('wallpaper-mode');

  function hashString(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a += 0x6D2B79F5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function hexToRgb(hex) {
    const value = String(hex || '#ffffff').replace('#', '');
    return {
      r: parseInt(value.slice(0, 2), 16) || 255,
      g: parseInt(value.slice(2, 4), 16) || 255,
      b: parseInt(value.slice(4, 6), 16) || 255,
    };
  }

  function rgba(hex, alpha) {
    const c = hexToRgb(hex);
    return `rgba(${c.r},${c.g},${c.b},${alpha})`;
  }

  function choosePalette(prompt, rand) {
    const p = prompt.toLowerCase();
    const palettes = [
      { name: 'aurora', bg: '#030814', colors: ['#79ffe1', '#72a7ff', '#f6d06f', '#f16ba6'] },
      { name: 'solar', bg: '#100705', colors: ['#ffcc66', '#ff6f59', '#fff1bd', '#7ef5ff'] },
      { name: 'violet', bg: '#080615', colors: ['#b38cff', '#ff7ccf', '#80e7ff', '#f4f0ff'] },
      { name: 'emerald', bg: '#03100c', colors: ['#8dffd3', '#39d98a', '#d5ff85', '#86a8ff'] },
      { name: 'candy', bg: '#100615', colors: ['#ff6ee7', '#82f7ff', '#ffe477', '#9f7bff'] },
      { name: 'mono gold', bg: '#070706', colors: ['#f6d06f', '#fff3c4', '#8defff', '#e6a84f'] },
    ];
    if (/solar|sun|flare|gold|ember|warm/.test(p)) return palettes[1];
    if (/violet|purple|lofi|moon|dream/.test(p)) return palettes[2];
    if (/green|emerald|forest|matrix|signal|zen/.test(p)) return palettes[3];
    if (/pink|candy|arcade|thunder|electric/.test(p)) return palettes[4];
    if (/gold|temple|ancient|champagne/.test(p)) return palettes[5];
    return palettes[Math.floor(rand() * palettes.length)] || palettes[0];
  }

  function promptTitle(prompt) {
    const words = String(prompt || 'living nebula').replace(/[^a-z0-9\u4e00-\u9fa5 ]/gi, ' ').split(/\s+/).filter(Boolean);
    const useful = words.filter((word) => !/^(a|an|the|and|or|with|above|slow|fast|soft|mode)$/i.test(word)).slice(0, 3);
    return useful.length ? useful.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') : 'Living Nebula';
  }

  function buildScene(prompt, overrides) {
    const seed = hashString(`${prompt}|${Date.now() % 9973}`);
    const stableSeed = hashString(prompt);
    const rand = mulberry32(stableSeed);
    const palette = choosePalette(prompt, rand);
    const lower = prompt.toLowerCase();
    const energyWords = (lower.match(/storm|flare|electric|fast|hero|thunder|reactor|plasma|arcade/g) || []).length;
    const calmWords = (lower.match(/calm|quiet|soft|lofi|zen|study|slow|ambient|dream/g) || []).length;
    const baseIntensity = clamp(0.92 + energyWords * 0.16 - calmWords * 0.08 + rand() * 0.22, 0.35, 1.8);
    const baseVelocity = clamp(0.62 + energyWords * 0.18 - calmWords * 0.09 + rand() * 0.36, 0.08, 2.2);
    const next = {
      prompt,
      seed: stableSeed,
      volatileSeed: seed,
      slug: promptTitle(prompt).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'nebula-scene',
      title: promptTitle(prompt),
      palette,
      intensity: Number(overrides && overrides.intensity) || baseIntensity,
      velocity: Number(overrides && overrides.velocity) || baseVelocity,
      gravity: Number(overrides && overrides.gravity) || clamp((rand() - 0.42) * 0.7, -1, 1),
      grain: Number(overrides && overrides.grain) || clamp(0.2 + rand() * 0.34, 0, 1),
      swirl: (rand() * 2 - 1) * (lower.includes('orbit') || lower.includes('spiral') ? 1.4 : 0.72),
      horizon: 0.44 + rand() * 0.22,
    };
    return next;
  }

  function resize() {
    dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    width = Math.max(1, Math.floor(window.innerWidth));
    height = Math.max(1, Math.floor(window.innerHeight));
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rebuildParticles();
  }

  function rebuildParticles() {
    if (!scene) return;
    const rand = mulberry32(scene.seed);
    const count = Math.floor(clamp((width * height) / 5200, 110, 460) * scene.intensity);
    particles = new Array(count).fill(0).map((_, i) => {
      const radius = 0.45 + rand() * 2.8;
      const angle = rand() * Math.PI * 2;
      const dist = Math.pow(rand(), 0.72);
      return {
        x: width * (0.5 + Math.cos(angle) * dist * 0.46),
        y: height * (scene.horizon + Math.sin(angle) * dist * 0.38),
        vx: (rand() - 0.5) * 0.8,
        vy: (rand() - 0.5) * 0.8,
        size: radius,
        color: scene.palette.colors[i % scene.palette.colors.length],
        life: rand() * 1000,
        orbit: 0.6 + rand() * 2.6,
      };
    });
    stars = new Array(Math.floor(clamp((width * height) / 6200, 120, 620))).fill(0).map(() => ({
      x: rand() * width,
      y: rand() * height,
      r: 0.35 + rand() * 1.4,
      a: 0.22 + rand() * 0.75,
      t: rand() * 100,
    }));
    if (els.particles) els.particles.textContent = String(particles.length);
  }

  function drawBackground(time) {
    const p = scene.palette;
    const t = time * 0.00004 * scene.velocity;
    const g = ctx.createLinearGradient(0, 0, width, height);
    g.addColorStop(0, p.bg);
    g.addColorStop(0.46, '#050815');
    g.addColorStop(1, '#010207');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 4; i += 1) {
      const color = p.colors[i % p.colors.length];
      const x = width * (0.24 + i * 0.19 + Math.sin(t * (i + 1) + i) * 0.09);
      const y = height * (0.22 + Math.cos(t * (i + 2)) * 0.08 + i * 0.09);
      const r = Math.max(width, height) * (0.22 + i * 0.055) * scene.intensity;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, rgba(color, 0.2));
      grad.addColorStop(0.42, rgba(color, 0.06));
      grad.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }
  }

  function drawStars(time) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const star of stars) {
      const twinkle = 0.55 + Math.sin(time * 0.0012 + star.t) * 0.45;
      ctx.fillStyle = `rgba(238,245,255,${star.a * twinkle})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawNebula(time, dt) {
    const cx = width * 0.5;
    const cy = height * scene.horizon;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const p of particles) {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const dist = Math.max(24, Math.sqrt(dx * dx + dy * dy));
      const spin = scene.swirl / dist * 18;
      const pull = (0.0008 + scene.gravity * 0.0007) * dt;
      p.vx += (-dy * spin + -dx * pull) * scene.velocity;
      p.vy += (dx * spin + -dy * pull + scene.gravity * 0.012) * scene.velocity;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx * dt * 0.055 * p.orbit;
      p.y += p.vy * dt * 0.055 * p.orbit;
      p.life += dt;
      if (p.x < -60 || p.x > width + 60 || p.y < -60 || p.y > height + 60 || dist < 20) {
        const rand = mulberry32((scene.seed + Math.floor(p.life) + p.size * 999) >>> 0);
        const a = rand() * Math.PI * 2;
        const d = 0.18 + rand() * 0.76;
        p.x = cx + Math.cos(a) * d * width * 0.42;
        p.y = cy + Math.sin(a) * d * height * 0.38;
        p.vx = (rand() - 0.5) * 0.5;
        p.vy = (rand() - 0.5) * 0.5;
      }
      const pulse = 0.72 + Math.sin(time * 0.002 + p.life * 0.004) * 0.28;
      const r = p.size * (2.8 + scene.intensity * 1.8) * pulse;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 7);
      grad.addColorStop(0, rgba(p.color, 0.38));
      grad.addColorStop(0.25, rgba(p.color, 0.13));
      grad.addColorStop(1, rgba(p.color, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgba('#ffffff', 0.55 * pulse);
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.6, r * 0.23), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawRings(time) {
    const cx = width * 0.5;
    const cy = height * scene.horizon;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.translate(cx, cy);
    ctx.rotate(Math.sin(time * 0.00012) * 0.08 + scene.swirl * 0.02);
    for (let i = 0; i < 5; i += 1) {
      const color = scene.palette.colors[i % scene.palette.colors.length];
      const rx = width * (0.14 + i * 0.07) * (0.92 + scene.intensity * 0.12);
      const ry = height * (0.035 + i * 0.015);
      ctx.strokeStyle = rgba(color, 0.12 - i * 0.012);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawGrain() {
    if (scene.grain <= 0.01) return;
    const step = 3;
    const alpha = 0.018 * scene.grain;
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let y = 0; y < height; y += step) {
      for (let x = (y / step) % 2; x < width; x += step * 2) {
        ctx.fillStyle = ((x + y) % 7) > 3 ? '#ffffff' : '#000000';
        ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.restore();
  }

  function animate(time) {
    const dt = Math.min(48, time - lastTime || 16);
    lastTime = time;
    drawBackground(time);
    drawStars(time);
    drawRings(time);
    drawNebula(time, dt);
    drawGrain();
    fpsFrames += 1;
    if (time - fpsTick > 600) {
      const fps = Math.round((fpsFrames * 1000) / (time - fpsTick));
      if (els.fps) els.fps.textContent = String(fps);
      fpsTick = time;
      fpsFrames = 0;
    }
    raf = requestAnimationFrame(animate);
  }

  function applyScene(next, silent) {
    scene = next;
    els.prompt.value = scene.prompt;
    els.intensity.value = scene.intensity.toFixed(2);
    els.velocity.value = scene.velocity.toFixed(2);
    els.gravity.value = scene.gravity.toFixed(2);
    els.grain.value = scene.grain.toFixed(2);
    els.seed.textContent = scene.seed.toString(36);
    els.palette.textContent = scene.palette.name;
    els.title.textContent = scene.title;
    els.kicker.textContent = scene.prompt.slice(0, 54);
    document.documentElement.style.setProperty('--accent', scene.palette.colors[0]);
    document.documentElement.style.setProperty('--accent-2', scene.palette.colors[2] || scene.palette.colors[1]);
    rebuildParticles();
    syncWallpaper();
    if (!silent) showToast(`Generated ${scene.title}`);
  }

  function currentOverrides() {
    return {
      intensity: Number(els.intensity.value),
      velocity: Number(els.velocity.value),
      gravity: Number(els.gravity.value),
      grain: Number(els.grain.value),
    };
  }

  function regenerate() {
    applyScene(buildScene(els.prompt.value.trim() || 'ambient nebula desk', currentOverrides()));
  }

  function randomPrompt() {
    const rand = mulberry32(Date.now() >>> 0);
    const count = 6 + Math.floor(rand() * 6);
    const words = [];
    for (let i = 0; i < count; i += 1) words.push(randomWords[Math.floor(rand() * randomWords.length)]);
    els.prompt.value = words.join(' ');
    applyScene(buildScene(els.prompt.value));
  }

  function showToast(text) {
    if (!els.toast) return;
    clearTimeout(toastTimer);
    els.toast.textContent = text;
    els.toast.classList.add('show');
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 1800);
  }

  function presetPayload() {
    return {
      type: 'nebuladesk-preset',
      version: 1,
      prompt: scene.prompt,
      slug: scene.slug,
      controls: currentOverrides(),
      seed: scene.seed,
    };
  }

  function sceneShareText() {
    return `NebulaDesk scene: ${scene.prompt}\nseed=${scene.seed.toString(36)} intensity=${scene.intensity.toFixed(2)} velocity=${scene.velocity.toFixed(2)}`;
  }

  function syncWallpaper() {
    if (!wallpaperRunning || isWallpaper || !api.updateWallpaper) return;
    api.updateWallpaper({
      prompt: scene.prompt,
      controls: currentOverrides(),
    }).catch(() => {});
  }

  function bindEvents() {
    els.generate && els.generate.addEventListener('click', regenerate);
    els.random && els.random.addEventListener('click', randomPrompt);
    [els.intensity, els.velocity, els.gravity, els.grain].forEach((input) => {
      input && input.addEventListener('input', () => applyScene(buildScene(els.prompt.value, currentOverrides()), true));
    });
    els.prompt && els.prompt.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') regenerate();
    });
    els.wallpaper && els.wallpaper.addEventListener('click', async () => {
      if (!api.startWallpaper) return;
      wallpaperRunning = !wallpaperRunning;
      if (wallpaperRunning) {
        await api.startWallpaper({ prompt: scene.prompt, controls: currentOverrides() });
        els.wallpaper.classList.add('active');
        showToast('Wallpaper window started');
      } else {
        await api.stopWallpaper();
        els.wallpaper.classList.remove('active');
        showToast('Wallpaper stopped');
      }
    });
    els.export && els.export.addEventListener('click', async () => {
      if (!api.exportPng) return;
      const result = await api.exportPng({ dataUrl: canvas.toDataURL('image/png'), fileName: scene.slug });
      if (result && result.ok) showToast('PNG exported');
    });
    els.save && els.save.addEventListener('click', async () => {
      if (!api.savePreset) return;
      const result = await api.savePreset(presetPayload());
      if (result && result.ok) showToast('Preset saved');
    });
    els.load && els.load.addEventListener('click', async () => {
      if (!api.loadPreset) return;
      const result = await api.loadPreset();
      if (result && result.ok && result.preset) {
        const preset = result.preset;
        applyScene(buildScene(preset.prompt || 'loaded nebula', preset.controls || {}));
      }
    });
    els.copy && els.copy.addEventListener('click', async () => {
      if (api.copyText) await api.copyText(sceneShareText());
      else navigator.clipboard && await navigator.clipboard.writeText(sceneShareText());
      showToast('Scene seed copied');
    });
    els.min && els.min.addEventListener('click', () => api.windowControl && api.windowControl('minimize'));
    els.max && els.max.addEventListener('click', () => api.windowControl && api.windowControl('maximize'));
    els.close && els.close.addEventListener('click', () => api.windowControl && api.windowControl('close'));
    window.addEventListener('resize', resize);
  }

  function renderPresetChips() {
    if (!els.presets) return;
    els.presets.innerHTML = presetPrompts.map((item, index) => (
      `<button class="preset-chip" data-preset="${index}">${item[0]}</button>`
    )).join('');
    els.presets.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-preset]');
      if (!btn) return;
      const item = presetPrompts[Number(btn.dataset.preset)];
      if (!item) return;
      els.prompt.value = item[1];
      applyScene(buildScene(item[1]));
    });
  }

  function initWallpaperReceiver() {
    if (!isWallpaper || !api.onWallpaperState) return;
    if (els.mode) els.mode.textContent = 'Wallpaper';
    api.onWallpaperState((state) => {
      if (!state || !state.prompt) return;
      applyScene(buildScene(state.prompt, state.controls || {}), true);
    });
  }

  function init() {
    renderPresetChips();
    bindEvents();
    initWallpaperReceiver();
    resize();
    const initialPrompt = isWallpaper ? 'aurora wallpaper drift, calm cinematic particles' : els.prompt.value;
    applyScene(buildScene(initialPrompt), true);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(animate);
  }

  init();
}());
