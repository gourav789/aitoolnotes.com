# AI Tool Notes (aitoolnotes.com) — Setup & Deploy Guide (Cloudflare)

A static site (HTML + CSS + a little JS) with two **Cloudflare Pages Functions**
for Razorpay payments. Firebase handles login + "who has paid". Course videos stay
locked until a user buys (₹499, lifetime).

---

## 📁 Files overview

| File | What it is |
|------|-----------|
| `index.html` | Landing page — demo videos, earnings proof, testimonials, pricing, Buy button |
| `login.html` | Signup / Login (Firebase email+password) |
| `course.html` | Course page — shows FULL course videos |
| `styles.css` | All styling (custom, no Tailwind) |
| `app.js` | Buy flow (login → order → Razorpay → verify → unlock) |
| `firebase-config.js` | Firebase web config (⚠️ replace with YOUR keys) |
| `firestore.rules` | Security rules (user can't make themselves "paid") |
| `functions/api/create-order.js` | Creates a ₹499 Razorpay order (served at `/api/create-order`) |
| `functions/api/verify-payment.js` | Verifies payment + marks user paid in Firestore (served at `/api/verify-payment`) |
| Policy pages | `about-us`, `contact-us`, `privacy-policy`, `terms-and-conditions`, `refund-policy`, `shipping-policy`, `disclaimer` |

### Media (videos)
All proof + testimonial videos are in the `Testimonial/` folder and are already
wired into `index.html`.

---

## ⚠️ IMPORTANT: course page is currently UNLOCKED

For Razorpay review, `course.html` is open to everyone right now.
In `course.html` there is this line:

```js
const PREVIEW_MODE = true;
```

**After Razorpay approves you and payments go live, change it to:**

```js
const PREVIEW_MODE = false;
```

Then the course only unlocks for logged-in + paid users.

---

## STEP 1 — Firebase project (login + paid tracking)

1. Go to https://console.firebase.google.com/ → **Add project**.
2. **Build → Authentication → Sign-in method → Email/Password → Enable**.
3. **Build → Firestore Database → Create database** (Production mode).
4. **Firestore → Rules tab** → paste contents of `firestore.rules` → **Publish**.
5. **Project settings → Your apps → Web app (</>)** → copy the config values.
6. Open `firebase-config.js` and replace the `REPLACE_...` placeholders with your real config.
   (These are public keys — safe to commit. Security is enforced by the rules + server.)

### Service account (lets the server mark users as paid)
1. **Project settings → Service accounts → Generate new private key** → downloads a JSON file.
2. From that JSON you'll need three values: `project_id`, `client_email`, `private_key`.

---

## STEP 2 — Push to GitHub

Create a repo and push ALL files, keeping the folder structure — especially the
`functions/api/` folder (Cloudflare needs it there).

---

## STEP 3 — Deploy on Cloudflare Pages

1. Go to https://dash.cloudflare.com → **Workers & Pages → Create → Pages**.
2. **Connect to Git** → pick your repo.
3. Build settings:
   - **Framework preset:** None
   - **Build command:** (leave empty)
   - **Build output directory:** `/`  (the repo root — the HTML files live there)
4. Click **Save and Deploy**.

Cloudflare automatically turns the `functions/` folder into serverless routes:
- `functions/api/create-order.js`  → `https://your-site/api/create-order`
- `functions/api/verify-payment.js` → `https://your-site/api/verify-payment`

(No extra config needed — the frontend already calls these paths.)

### Custom domain
After the first deploy, in the Pages project → **Custom domains** → add
`aitoolnotes.com`. Since your DNS is on Cloudflare, it links automatically.

---

## STEP 4 — Environment variables (Cloudflare)

Cloudflare → your **Pages project → Settings → Environment variables → Production**.
Add these (and also to **Preview** if you use preview deployments):

| Name | Value |
|------|-------|
| `RAZORPAY_KEY_ID` | Razorpay Key Id (`rzp_test_...` first, then `rzp_live_...`) |
| `RAZORPAY_KEY_SECRET` | Razorpay Key Secret |
| `FIREBASE_API_KEY` | your Firebase web `apiKey` |
| `FIREBASE_PROJECT_ID` | `project_id` from the service-account JSON |
| `FIREBASE_CLIENT_EMAIL` | `client_email` from the JSON |
| `FIREBASE_PRIVATE_KEY` | the full `private_key` from the JSON (paste as-is, including the BEGIN/END lines) |

> Mark the secret ones (`RAZORPAY_KEY_SECRET`, `FIREBASE_PRIVATE_KEY`) as **Encrypt**
> in Cloudflare if the option is shown.
>
> The code accepts the private key with real line breaks **or** with `\n`.

After adding variables, **re-deploy** (Deployments → Retry/redeploy) so they take effect.

> Get Razorpay keys: Razorpay Dashboard → Account & Settings → API Keys → Generate.
> Test with `rzp_test_...` first (no real money), then switch to live keys.

---

## 🔄 Payment flow

1. User clicks **Buy ₹499** → if not logged in, sent to `login.html`.
2. Signs up / logs in (Firebase). A `users/{uid}` doc is created with `paid:false`.
3. `/api/create-order` makes a ₹499 Razorpay order (secret stays on the server).
4. Razorpay Checkout opens; user pays.
5. `/api/verify-payment` checks the Razorpay signature (HMAC) + the Firebase ID
   token, then sets `paid:true` in Firestore (server-side, secure).
6. User is sent to `course.html`, which unlocks all full course videos.
7. On any device, logging in unlocks the course (no re-payment).

---

## ✅ Razorpay website approval checklist

These are all present on the site:
- About Us, Contact Us (with support email)
- Privacy Policy
- Terms & Conditions
- Refund & Cancellation Policy
- Shipping & Delivery Policy (digital — instant delivery)
- Clear product + price (₹499)

Make sure `aitoolnotes.com` is live and all footer links open before submitting.

---

## 🧪 Local testing note

The payment functions only run on Cloudflare (or `wrangler pages dev`). Opening the
HTML files directly / with a simple server will show the site, but the Buy button
needs the deployed `/api/*` functions to actually process a payment.
