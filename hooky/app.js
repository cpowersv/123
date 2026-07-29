/* ============================================================
   Hooky — signup form
   Validates, posts the signup to whatever endpoint is configured
   below, then swaps the form for the thank-you card.
   ============================================================ */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     STEP 1 — paste your form endpoint here before sharing the link.
     Any service that accepts a POST of JSON works. Easiest is Formspree:
     make a free form at formspree.io and drop the URL in below.

         const ENDPOINT = 'https://formspree.io/f/abcdwxyz';

     Left null, the page runs in DEMO MODE: it looks like it works but
     only keeps signups in this browser (window.hooky.csv() dumps them).
     ------------------------------------------------------------------ */
  const ENDPOINT = null;

  const $ = (id) => document.getElementById(id);

  const form   = $('signup');
  const done   = $('done');
  const btn    = $('submitBtn');
  const note   = $('formNote');
  const email  = $('email');
  const zip    = $('zip');

  const NOTE_DEFAULT = note.textContent;
  const STORE_KEY = 'hooky.signups';

  /* ---------------- Validation ---------------- */

  function looksLikeEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
  }

  function looksLikeZip(v) {
    return /^\d{5}$/.test(v.trim());
  }

  function fail(field, message) {
    field.classList.add('bad');
    note.textContent = message;
    note.classList.add('err');
    field.focus();
  }

  function clearErrors() {
    [email, zip].forEach((f) => f.classList.remove('bad'));
    note.textContent = NOTE_DEFAULT;
    note.classList.remove('err');
  }

  /* ---------------- Demo-mode storage ---------------- */

  function stash(signup) {
    let all = [];
    try {
      all = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
    } catch (e) { /* corrupt or unavailable — start fresh */ }
    all.push(signup);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(all));
    } catch (e) { /* private browsing — nothing we can do */ }
    return all;
  }

  /* Handy in the console: window.hooky.csv() */
  window.hooky = {
    csv() {
      let all = [];
      try {
        all = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
      } catch (e) { /* ignore */ }
      const cols = ['at', 'email', 'zip', 'kids', 'style'];
      return [cols.join(',')]
        .concat(all.map((s) => cols.map((c) => JSON.stringify(s[c] || '')).join(',')))
        .join('\n');
    },
    clear() { localStorage.removeItem(STORE_KEY); }
  };

  /* ---------------- Submit ---------------- */

  function showDone(signup) {
    $('doneZip').textContent = signup.zip ? signup.zip : 'you';
    form.hidden = true;
    done.hidden = false;
    done.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    if (!looksLikeEmail(email.value)) {
      return fail(email, 'That email doesn’t look right — mind checking it?');
    }
    if (!looksLikeZip(zip.value)) {
      return fail(zip, 'We need a 5-digit ZIP to find moms near you.');
    }

    const signup = {
      at:    new Date().toISOString(),
      email: email.value.trim(),
      zip:   zip.value.trim(),
      kids:  $('kids').value.trim(),
      style: $('style').value
    };

    btn.disabled = true;
    btn.textContent = 'Saving…';

    if (!ENDPOINT) {
      console.warn(
        '[Hooky] DEMO MODE — no ENDPOINT set in app.js, so this signup was ' +
        'only saved in this browser. Set ENDPOINT before sharing the link. ' +
        'Run hooky.csv() to see what\'s been collected here.'
      );
      stash(signup);
      showDone(signup);
      return;
    }

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(signup)
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      showDone(signup);
    } catch (err) {
      console.error('[Hooky] signup failed:', err);
      btn.disabled = false;
      btn.textContent = 'Save my seat';
      note.textContent = 'Something went wrong on our end. Try once more?';
      note.classList.add('err');
    }
  });

  /* Typing in a flagged field clears the complaint. */
  [email, zip].forEach((f) => {
    f.addEventListener('input', () => {
      if (f.classList.contains('bad')) clearErrors();
    });
  });
})();
