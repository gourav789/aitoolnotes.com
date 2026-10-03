// =====================================================
// aitoolnotes.com — Verify Razorpay Payment + mark user paid in Firestore
//
//  1) Verify the Razorpay signature (payment is genuine).
//  2) Verify the Firebase ID token (who is the user).
//  3) Write paid:true to Firestore users/{uid} using a service account.
//
// Environment Variables needed:
//  - RAZORPAY_KEY_SECRET
//  - FIREBASE_API_KEY        (your web apiKey — public web key)
//  - FIREBASE_PROJECT_ID
//  - FIREBASE_CLIENT_EMAIL
//  - FIREBASE_PRIVATE_KEY    (paste with real newlines or \n; both handled)
// =====================================================

import crypto from "crypto";

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || "";
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return res.status(500).json({ error: "Payment not configured." });
  }
  if (!FIREBASE_API_KEY || !PROJECT_ID) {
    return res.status(500).json({ error: "Firebase not configured." });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      idToken
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing payment details." });
    }
    if (!idToken) {
      return res.status(400).json({ error: "Missing user token. Please login again." });
    }

    // ---- 1) Verify Razorpay signature ----
    const expected = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return res.status(400).json({ verified: false, error: "Invalid payment signature." });
    }

    // ---- 2) Verify Firebase ID token, get the user's uid + email ----
    const lookupRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken })
      }
    );
    const lookup = await lookupRes.json();
    const userInfo = lookup?.users?.[0];
    if (!lookupRes.ok || !userInfo) {
      return res.status(401).json({ verified: false, error: "Invalid user token." });
    }
    const uid = userInfo.localId;
    const email = userInfo.email || "";

    // ---- 3) Write paid:true to Firestore via service account ----
    const accessToken = await getAccessToken();

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
      return res.status(500).json({
        verified: true,
        dbUpdated: false,
        error: "Payment ho gaya par access set nahi hua. Support se contact karein (payment id: " + razorpay_payment_id + ")."
      });
    }

    return res.status(200).json({ verified: true, dbUpdated: true });

  } catch (err) {
    console.error("verify-payment error:", err);
    return res.status(500).json({ error: "Verification failed: " + (err.message || String(err)) });
  }
}

// -----------------------------------------------------
// Create a Google OAuth access token from the service account
// (signs a JWT and exchanges it — no external library needed)
// -----------------------------------------------------
async function getAccessToken() {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";

  privateKey = privateKey.replace(/\\n/g, "\n");
  privateKey = privateKey.replace(/^["']|["']$/g, "");
  privateKey = privateKey.trim();

  if (!clientEmail || !privateKey) {
    throw new Error("Missing Firebase service account env vars.");
  }
  if (!privateKey.includes("BEGIN PRIVATE KEY")) {
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

  const enc = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");

  const unsigned = `${enc(header)}.${enc(claim)}`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(unsigned)
    .sign(privateKey, "base64url");

  const jwt = `${unsigned}.${signature}`;

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
