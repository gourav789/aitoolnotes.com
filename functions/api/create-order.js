// =====================================================
// aitoolnotes.com — Create Razorpay Order
// Cloudflare Pages Function. Served at: /api/create-order
//
// Env vars (set in Cloudflare → Pages → Settings → Environment variables):
//   RAZORPAY_KEY_ID
//   RAZORPAY_KEY_SECRET
//
// Course price: ₹499 (one-time, lifetime access).
// =====================================================

export async function onRequestPost(context) {
  const { env } = context;

  const keyId = env.RAZORPAY_KEY_ID;
  const keySecret = env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return json({ error: "Payment not configured (missing keys)." }, 500);
  }

  try {
    const amountPaise = 499 * 100; // ₹499 in paise

    const auth = btoa(`${keyId}:${keySecret}`);

    const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${auth}`
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: "aitoolnotes_" + Date.now(),
        notes: { product: "aitoolnotes.com — AI Course Lifetime Access" }
      })
    });

    if (!orderRes.ok) {
      const errText = await orderRes.text();
      console.error("Razorpay order error:", orderRes.status, errText);
      return json({ error: "Could not create order." }, 502);
    }

    const order = await orderRes.json();

    // Send back order id + PUBLIC key id (safe to expose)
    return json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: keyId
    }, 200);

  } catch (err) {
    console.error("create-order error:", err);
    return json({ error: "Something went wrong." }, 500);
  }
}

// Reject non-POST methods cleanly
export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }
  return onRequestPost(context);
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
