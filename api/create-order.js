// =====================================================
// aitoolnotes.com — Create Razorpay Order (Vercel Serverless Function)
//
// Runs on the server. Uses RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET from
// Environment Variables. Returns an order the browser can pay for.
// Course price: ₹499 (one-time, lifetime access).
// =====================================================

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return res.status(500).json({ error: "Payment not configured (missing keys)." });
  }

  try {
    const amountPaise = 499 * 100; // ₹499 in paise

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

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
      return res.status(502).json({ error: "Could not create order." });
    }

    const order = await orderRes.json();

    // Send back the order id + the PUBLIC key id (safe to expose)
    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: keyId
    });

  } catch (err) {
    console.error("create-order error:", err);
    return res.status(500).json({ error: "Something went wrong." });
  }
}
