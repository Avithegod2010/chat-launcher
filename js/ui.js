/**
 * Shared UI helpers: safe storage wrapper, toasts, ripple ink, particle burst,
 * shake, dialog/sheet openers. No business logic lives here.
 */

/** @returns {boolean} */
export function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * localStorage behind a feature test. In private modes where storage throws,
 * we fall back to an in-memory Map so the app still works for the session.
 * @returns {{ok: boolean, backend: Storage}}
 */
export function safeStorage() {
  try {
    const k = '__chatlauncher_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return { ok: true, backend: localStorage };
  } catch {
    const mem = new Map();
    return {
      ok: false,
      backend: {
        getItem: (k) => mem.get(k) ?? null,
        setItem: (k, v) => void mem.set(k, String(v)),
        removeItem: (k) => void mem.delete(k),
      },
    };
  }
}

let warnedNoStorage = false;

/**
 * @param {string} message
 * @param {{kind?: 'info'|'warn'|'good', actionLabel?: string,
 *          onAction?: () => void, timeout?: number}} [opts]
 */
export function toast(message, opts = {}) {
  const layer = document.getElementById('toasts');
  if (!layer) return;
  const el = document.createElement('div');
  el.className = `toast toast-${opts.kind ?? 'info'}`;
  const span = document.createElement('span');
  span.textContent = message;
  el.append(span);
  const dismiss = () => {
    el.classList.add('toast-out');
    setTimeout(() => el.remove(), prefersReducedMotion() ? 0 : 240);
  };
  if (opts.actionLabel) {
    const btn = document.createElement('button');
    btn.className = 'toast-action';
    btn.type = 'button';
    btn.textContent = opts.actionLabel;
    btn.addEventListener('click', () => {
      opts.onAction?.();
      dismiss();
    });
    el.append(btn);
  }
  el.addEventListener('click', (e) => {
    if (e.target === el || e.target === span) dismiss();
  });
  layer.append(el);
  setTimeout(dismiss, opts.timeout ?? 3400);
}

/** Warn once per session when persistence is unavailable. */
export function warnStorageOnce() {
  if (warnedNoStorage) return;
  warnedNoStorage = true;
  toast('Storage is blocked — history and settings won’t be saved', {
    kind: 'warn',
    timeout: 5000,
  });
}

/** Ripple ink on every element carrying `.ripple` (delegated, passive). */
export function attachRipples(root = document) {
  root.addEventListener('pointerdown', (e) => {
    const host = e.target.closest('.ripple');
    if (!host || prefersReducedMotion()) return;
    const r = host.getBoundingClientRect();
    const ink = document.createElement('span');
    ink.className = 'ripple-ink';
    const size = Math.max(r.width, r.height) * 1.15;
    ink.style.width = ink.style.height = `${size}px`;
    ink.style.left = `${e.clientX - r.left - size / 2}px`;
    ink.style.top = `${e.clientY - r.top - size / 2}px`;
    host.append(ink);
    ink.addEventListener('animationend', () => ink.remove(), { once: true });
  });
}

/**
 * Small particle burst from a screen point.
 * @param {number} x screen x
 * @param {number} y screen y
 * @param {string} [color] base color for the particles
 */
export function burst(x, y, color = '#7c3aed') {
  if (prefersReducedMotion()) return;
  const palette = [color, '#ffffff', '#ffd166', '#22d3ee'];
  const n = 14;
  for (let i = 0; i < n; i++) {
    const p = document.createElement('span');
    p.className = 'spark';
    p.style.background = palette[i % palette.length];
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    document.body.append(p);
    const angle = (Math.PI * 2 * i) / n + Math.random() * 0.5;
    const dist = 56 + Math.random() * 78;
    p.animate(
      [
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
        {
          transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px)) scale(.15)`,
          opacity: 0,
        },
      ],
      { duration: 620 + Math.random() * 260, easing: 'cubic-bezier(.16,.84,.44,1)' },
    ).onfinish = () => p.remove();
  }
}

/** One-shot horizontal shake (invalid input feedback). */
export function shake(el) {
  if (!el || prefersReducedMotion()) return;
  el.classList.remove('shake');
  void el.offsetWidth; // restart the animation
  el.classList.add('shake');
  el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true });
}

/** Best-effort haptics; silently ignored where unsupported. */
export function vibrate(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* no-op */
  }
}

/** @param {string} id of a <dialog> element */
export function openDialog(id) {
  const d = document.getElementById(id);
  d?.showModal?.();
  return d ?? null;
}

/**
 * Ask the user for a short text value via the shared text dialog.
 * Resolves with the trimmed value, or null when cancelled.
 * @param {{title: string, value?: string, placeholder?: string,
 *          confirmLabel?: string}} opts
 * @returns {Promise<string|null>}
 */
export function askText(opts) {
  return new Promise((resolve) => {
    const dlg = document.getElementById('textDialog');
    if (!dlg) return resolve(null);
    const title = dlg.querySelector('.dialog-title');
    const input = dlg.querySelector('input');
    const confirmBtn = dlg.querySelector('.dialog-confirm');
    const cancelBtn = dlg.querySelector('.dialog-cancel');
    title.textContent = opts.title;
    input.value = opts.value ?? '';
    input.placeholder = opts.placeholder ?? '';
    confirmBtn.textContent = opts.confirmLabel ?? 'Save';
    let settled = false;
    const done = (val) => {
      if (settled) return;
      settled = true;
      cleanup();
      dlg.close();
      resolve(val);
    };
    const onSubmit = (e) => {
      e.preventDefault();
      done(input.value.trim());
    };
    const onCancel = () => done(null);
    function cleanup() {
      dlg.querySelector('form').removeEventListener('submit', onSubmit);
      cancelBtn.removeEventListener('click', onCancel);
      dlg.removeEventListener('close', onCancel);
    }
    dlg.querySelector('form').addEventListener('submit', onSubmit);
    cancelBtn.addEventListener('click', onCancel);
    dlg.addEventListener('close', onCancel);
    dlg.showModal();
    input.focus();
    input.select();
  });
}
