# 👟 Hooky

**Screw Housework And Running Errands.**

A landing page for the mom-hangout idea: one Saturday a month, a small group of
local moms gets together and has fun. This page explains the idea and collects
email signups so you can find out whether anyone wants it — before building an
app.

Static HTML/CSS/JS. No build step, no dependencies. Open `index.html` and go.

---

## ⚠️ Do this before you share the link

Signups go nowhere until you connect a form endpoint. Right now the page is in
**demo mode**: it looks like it works, but addresses are only saved in the
visitor's own browser, which means you never see them.

1. Go to [formspree.io](https://formspree.io), make a free account, create a
   form. Free tier is 50 submissions/month, no code required.
2. Copy the form URL it gives you (looks like `https://formspree.io/f/abcdwxyz`).
3. Open `hooky/app.js`, find the line near the top:

   ```js
   const ENDPOINT = null;
   ```

   and change it to:

   ```js
   const ENDPOINT = 'https://formspree.io/f/abcdwxyz';
   ```

4. Submit the form once yourself and confirm the email lands in your inbox.

Any service that accepts a JSON `POST` works the same way — Formspree, Basin,
Getform, a Google Apps Script web app, or your own endpoint later.

While in demo mode, `hooky.csv()` in the browser console dumps whatever that
browser collected, and `hooky.clear()` empties it.

---

## What gets collected

| Field | Why it's there |
|---|---|
| Email | The only way to tell her a group has formed |
| ZIP | Grouping is geographic — this is the field that decides which town launches first |
| Kids' ages | A mom with a newborn and a mom with teenagers are in different worlds |
| Kids along / kid-free | The #1 question about any mom event, asked up front so nobody is surprised |

Deliberately **not** collected: kids' names, photos, birthdays, anything else
about the children. Don't gather data about minors you don't have a use for.

---

## Running it locally

```bash
cd hooky
python3 -m http.server 8000
# → http://localhost:8000
```

Opening `index.html` directly by double-clicking works too.

---

## Publishing it

The repo already has a GitHub Pages workflow (`.github/workflows/deploy.yml`),
but it only publishes on the `main` and Audivue branches. To put this page
online, add this branch to the `on.push.branches` list in that file — the page
will then be live at `<pages-url>/hooky/`, and Audivue stays where it is at the
root.

A custom domain is worth it before you post the link anywhere real. Check that
the name is free on the USPTO trademark search, the App Store, and Instagram
first.

---

## What this page is for

It is a **test**, not a product. The thing to watch:

- Signups per town. One ZIP with 15 signups is worth more than 200 scattered
  across the country — you need density in one place, not reach.
- Whether anyone forwards it. If moms don't share it with other moms
  unprompted, the idea needs work before any code gets written.

Run the actual meetup by hand for three months — group chat and a calendar
invite — before building anything with logins in it.

---

## Files

```
hooky/
├── index.html   ← copy and page structure
├── styles.css   ← all styling; brand colours are the vars at the top
├── app.js       ← form validation + submit (ENDPOINT lives here)
└── README.md
```
