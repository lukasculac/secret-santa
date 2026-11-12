# 🎁 Secret Santa

A one-link Secret Santa draw. You send the same link to the group chat,
each person taps their own name, unwraps a present, and sees who they got.

No server, no database, no sign-ups. It is three static files on GitHub Pages.

---

## How it works

`generate.mjs` draws the names **once** on your machine and writes `draw.js`,
in which every person's giftee is encrypted with a key derived from *their own
name*. The browser only decrypts the one entry belonging to the name that was
tapped.

The draw is a **single gift chain** (`A → B → C → D → E → A`), not a plain
shuffle. That structure guarantees two things for free:

- nobody ever draws themselves, and
- no two people draw each other, so you never get a boring mutual pair.

---

## Setup

### 1. Draw the names

Edit the `NAMES` list at the top of `generate.mjs` if the group changes, then:

```bash
node generate.mjs
```

Or pass them straight in:

```bash
node generate.mjs Lule Trdo Shuljo Erik Matej
```

This overwrites `draw.js`. Run it again any time you want to re-draw.

### 2. Check it without spoiling it

You are in this draw yourself, so `verify.mjs` deliberately never prints who
got whom. It only proves the draw is sound:

```bash
node verify.mjs
```

### 3. Publish

```bash
git add -A
git commit -m "Secret Santa draw"
git push
```

Then in the repo on GitHub: **Settings → Pages → Source: Deploy from a branch**,
pick `main` and `/ (root)`, and save. A minute later your link is live at:

```
https://lukasculac.github.io/secret-santa/
```

Paste that in the group chat. Done.

### Previewing locally first

`file://` will not work — the Web Crypto API needs a secure context, which
means `https://` or `localhost`. Serve it:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

---

## What your friends see

1. **Who are you?** — five buttons, they tap their name.
2. **A wrapped present** — it floats, wiggles impatiently, and says *tap me*.
3. **It shakes, the lid blows off, confetti erupts**, and their person's name
   rises out in gold.

Snow falls behind all of it. It is built mobile-first, since that link is
getting opened on a phone.

Their choice is remembered on their device, so reopening the link goes
straight back to their name instead of the picker. There is a *"Not you?
Start over"* link if someone taps wrong.

---

## About the secrecy

Being straight with you about the one tradeoff of a static site: **the
encrypted draw for all five people ships to every browser.** Each person can
only decrypt their own entry by tapping their name, and the file gives up
nothing to anyone reading the source — the names are not in it, the mapping is
not in it, and one person's key cannot open another's present (`verify.mjs`
checks exactly that).

But someone who opens devtools and deliberately replays the page's own
decryption function against the other four names *can* work out the whole
chain. That is unavoidable without a server: the data has to reach the browser
somehow.

In practice this stops every accidental spoiler and every casually curious
friend, which is the actual risk among five people. If one of your group is
the type to reverse-engineer a webpage to ruin their own Christmas present,
no static page will stop them.

---

## Files

| File | What it is |
|---|---|
| `generate.mjs` | Draws the names and writes `draw.js`. Run once, locally. |
| `verify.mjs` | Proves the draw is valid without revealing it. |
| `draw.js` | The generated, encrypted draw. Committed and served. |
| `index.html` | The page. |
| `styles.css` | Night sky, the present, the animations. |
| `app.js` | Snow, confetti, decryption, screen flow. |

No dependencies, no build step. Needs Node 18+ to generate; any modern
browser to open.
