# AI Tool Notes (aitoolnotes.com) — Setup & Deploy Guide

A static site (HTML + CSS + a little JS) with two serverless API functions for
Razorpay payments. Firebase handles login + "who has paid". Course videos stay
locked until a user buys (₹499, lifetime).

---

## 📁 Files overview

| File | What it is |
|------|-----------|
| `index.html` | Landing page — demo videos, earnings proof, testimonials, pricing, Buy button |
| `login.html` | Signup / Login (Firebase email+password) |
| `course.html` | Gated page — shows FULL course videos only to paid users |
| `styles.css` | All styling (custom, no Tailwind) |
| `app.js` | Buy flow on the landing page (login → order → Razorpay → verify → unlock) |
| `firebase-config.js` | Firebase web config (⚠️ replace with YOUR keys) |
| `firestore.rules` | Security rules (user can't make themselves "paid") |
| `api/create-order.js` | Creates a ₹499 Razorpay order (server-side) |
| `api/verify-payment.js` | Verifies payment + marks user paid in Firestore |
| Policy pages | `about-us`, `contact-us`, `privacy-policy`, `terms-and-conditions`, `refund-policy`, `shipping-policy`, `disclaimer` |

### Media folders (put your uploaded videos here)
- `Earning Show/earning.mp4` — earning proof video
- `43$ RPM/rpm.mp4` — high RPM proof video
- `Testimonial/testimonial.mp4`, `testimonial2.mp4`, `testimonial3.mp4` — review videos

> If your file names differ, update the `<source src="...">` paths in `index.html`.

---

## 🎬 Course video IDs (already wired in)

| Course | Demo (public, landing) | Full (locked, course.html) |
|--------|------------------------|-----------------------------|
| AI Geography | 3jhks3H10Y8 | udqhHNoOyPw |
| Synthesia AI | byLJ5XI1xoY | UBCsiYk7eVo |
| Faceless History | M8-de5J7oaA | qDLQI5FL8_8 |
| Seedance 2.5 Alts | 43pyduDQSZE | gxWPnSJxi38 |
| CapCut Tool (bonus) | uGQUuqegsRI | uGQUuqegsRI |

---

## STEP 1 — Firebase project (login + paid tracking)

1. Go to https://console.firebase.google.com/ → **Add project** (name it anything).
2. **Build → Authentication → Sign-in method → Email/Password → Enable**.
3. **Build → Firestore Database → Create database** (Production mode).
4. **Firestore → Rules tab** → paste contents of `firestore.rules` → **Publish**.
5. **Project settings → Your apps → Web app (</>)** → copy the config values.
6. Open `firebase-config.js` and replace the `REPLACE_...` placeholders with your real config.

### Service account (lets the server mark users paid)
1. **Project settings → Service accounts → Generate new private key** → downloads a JSON.
2. From that JSON you need: `project_id`, `client_email`, `private_key`.

---

## STEP 2 — Push to GitHub

Create a repo and push all these files (keep the folder structure, incl. `api/`).

## STEP 3 — Deploy

This uses Vercel-style serverless functions (`api/*.js`). Easiest path:

### Option A — Vercel (recommended, functions work out of the box)
1. https://vercel.com → **Import** your GitHub repo.
2. Framework Preset: **Other**.
3. Deploy.

### Option B — Cloudflare
- Cloudflare Pages serves the static files, but the `/api/*` functions are written
  in Vercel's style. To run them on Cloudflare you'd convert them to Cloudflare
  **Pages Functions** (`/functions/api/create-order.js` etc).
- Simplest working setup: **deploy the app on Vercel**, then in **Cloudflare** just
  manage your DNS for `aitoolnotes.com` and point it to Vercel (CNAME). This gives
  you Cloudflare DNS/CDN + working payment functions.

## STEP 4 — Add Environment Variables (in Vercel → Settings → Environment Variables)

| Name | Value |
|------|-------|
| `RAZORPAY_KEY_ID` | Razorpay Key Id (`rzp_test_...` first, then `rzp_live_...`) |
| `RAZORPAY_KEY_SECRET` | Razorpay Key Secret |
| `FIREBASE_API_KEY` | your Firebase web `apiKey` |
| `FIREBASE_PROJECT_ID` | `project_id` from the service-account JSON |
| `FIREBASE_CLIENT_EMAIL` | `client_email` from the JSON |
| `FIREBASE_PRIVATE_KEY` | the full `private_key` (paste as-is with line breaks) |

Then **Redeploy**.

> Get Razorpay keys: Razorpay Dashboard → Account & Settings → API Keys → Generate.
> Test with `rzp_test_...` first (no real money), then switch to live keys.

---

## 🔄 Payment flow

1. User clicks **Buy ₹499** → if not logged in, sent to `login.html`.
2. Signs up / logs in (Firebase). A `users/{uid}` doc is created with `paid:false`.
3. `/api/create-order` makes a ₹499 Razorpay order (secret stays on server).
4. Razorpay Checkout opens; user pays.
5. `/api/verify-payment` checks the Razorpay signature + Firebase ID token,
   then sets `paid:true` in Firestore (server-side, secure).
6. User is sent to `course.html`, which checks login + `paid` and unlocks all
   full course videos.
7. On any device, logging in unlocks the course (no re-payment).

---

## ✅ Razorpay website approval checklist

Razorpay reviews your site before activating live payments. These are all present:
- About Us, Contact Us (with support email)
- Privacy Policy
- Terms & Conditions
- Refund & Cancellation Policy
- Shipping & Delivery Policy (digital — instant delivery)
- Clear product + price (₹499) shown on the site

Make sure the domain `aitoolnotes.com` is live and all footer links open correctly
before submitting for approval.
