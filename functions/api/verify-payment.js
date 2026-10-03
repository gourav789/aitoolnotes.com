// =====================================================
// aitoolnotes.com — Verify Razorpay Payment + mark user paid in Firestore
// Cloudflare Pages Function. Served at: /api/verify-payment
//
// Uses Web Crypto (Cloudflare has no Node "crypto" module).
//
//  1) Verify the Razorpay signature (HMAC-SHA256) — payment is genuine.
//  2) Verify the Firebase ID token (who is the user).
//  3) Write paid:true to Firestore users/{uid} using a service account JWT.
//
// Env vars (Cloudflare → Pages → Settings → Environment variables):
//   RAZORPAY_KEY_SECRET
//   FIREBASE_API_KEY        (your web apiKey — public web key)
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY    (paste full key; \n or real newlines both OK)
// =====================================================

export async function onRequestPost(context) {
  const { request, env } = context;

  const keySecret = env.RAZORPAY_KEY_SECRET;
  const FIREBASE_API_KEY = env.FIREBASE_API_KEY || "";
  const PROJECT_ID = env.FIREBASE_PROJECT_ID || "";

  if (!keySecret) return json({ error: "Payment not configured." }, 500);
  if (!FIREBASE_API_KEY || !PROJECT_ID) return json({ error: "Firebase not configured." }, 500);

  try {
    const body = await request.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      idToken
    } = body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return json({ error: "Missing payment details." }, 400);
    }
    if (!idToken) {
      return json({ error: "Missing user token. Please login again." }, 400);
    }

    // ---- 1) Verify Razorpay signature (HMAC-SHA256) ----
    const expected = await hmacSha256Hex(keySecret, `${razorpay_order_id}|${razorpay_payment_id}`);
    if (expected !== razorpay_signature) {
      return json({ verified: false, error: "Invalid payment signature." }, 400);
    }

    // ---- 2) Verify Firebase ID token, get uid + email ----
    const lookupRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken })
      }
    );
    const lookup = await lookupRes.json();
    const userInfo = lookup && lookup.users && lookup.users[0];
    if (!lookupRes.ok || !userInfo) {
      return json({ verified: false, error: "Invalid user token." }, 401);
    }
    const uid = userInfo.localId;
    const email = userInfo.email || "";

    // ---- 3) Write paid:true to Firestore via service account ----
    const accessToken = await getAccessToken(env);

    const fsUrl =
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}` +
      `?updateMask.fieldPaths=paid&updateMask.fieldPaths=email&updateMask.fieldPaths=paidAt&updateMask.fieldPaths=lastPaymentId`;

    const fsRes = await fetch(fsUrl, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fields: {
          paid: { booleanValue: true },
          email: { stringValue: email },
          paidAt: { integerValue: String(Date.now()) },
          lastPaymentId: { stringValue: razorpay_payment_id }
        }
      })
    });

    if (!fsRes.ok) {
      const errText = await fsRes.text();
      console.error("Firestore write error:", fsRes.status, errText);
      return json({
        verified: true,
        dbUpdated: false,
        error: "Payment ho gaya par access set nahi hua. Support se contact karein (payment id: " + razorpay_payment_id + ")."
      }, 500);
    }

    return json({ verified: true, dbUpdated: true }, 200);

  } catch (err) {
    console.error("verify-payment error:", err);
    return json({ error: "Verification failed: " + (err.message || String(err)) }, 500);
  }
}

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }
  return onRequestPost(context);
}

// -----------------------------------------------------
// Helpers (Web Crypto)
// -----------------------------------------------------

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

const enc = new TextEncoder();

// HMAC-SHA256 → lowercase hex (matches Razorpay signature format)
async function hmacSha256Hex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// base64url for a string
function b64url(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
// base64url for raw bytes
function b64urlBytes(bytes) {
  let bin = "";
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Create a Google OAuth access token from the service account.
// Signs a JWT with RS256 using the service-account private key, then
// exchanges it for an access token (scope: datastore).
async function getAccessToken(env) {
  const clientEmail = env.FIREBASE_CLIENT_EMAIL;
  let privateKeyPem = env.FIREBASE_PRIVATE_KEY || "";

  privateKeyPem = privateKeyPem.replace(/\\n/g, "\n").replace(/^["']|["']$/g, "").trim();

  if (!clientEmail || !privateKeyPem) {
    throw new Error("Missing Firebase service account env vars.");
  }
  if (!privateKeyPem.includes("BEGIN PRIVATE KEY")) {
    throw new Error("FIREBASE_PRIVATE_KEY looks malformed (no BEGIN marker).");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  };

  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;

  const key = await importPkcs8(privateKeyPem);
  const sigBuf = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    enc.encode(unsigned)
  );
  const jwt = `${unsigned}.${b64urlBytes(sigBuf)}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error("Failed to get access token: " + JSON.stringify(tokenData));
  }
  return tokenData.access_token;
}

// Import a PEM PKCS#8 private key for RS256 signing
async function importPkcs8(pem) {
  const b64 = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    raw.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}
