// =====================================================
// aitoolnotes.com — Landing page logic
//  - Shows Login/Account in nav based on auth state
//  - Buy button: login check → create order → Razorpay → verify → unlock
// =====================================================
import { auth, db, onAuthStateChanged, doc, getDoc } from "./firebase-config.js";

const navAuth = document.getElementById("navAuth");
const buyBtn = document.getElementById("buyBtn");

let currentUser = null;

// ---- Track auth state ----
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    if (navAuth) {
      navAuth.textContent = "My Course";
      navAuth.href = "course.html";
    }
    // If already paid, change buy button to "Go to Course"
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists() && snap.data().paid === true && buyBtn) {
        buyBtn.textContent = "✅ Already Purchased — Open My Course";
        buyBtn.onclick = () => (window.location.href = "course.html");
      }
    } catch (e) { /* ignore read errors on landing */ }
  } else {
    if (navAuth) {
      navAuth.textContent = "Login";
      navAuth.href = "login.html";
    }
  }
});

// ---- Buy flow ----
if (buyBtn) {
  buyBtn.addEventListener("click", async () => {
    // Not logged in → send to login (remember we wanted to buy)
    if (!currentUser) {
      sessionStorage.setItem("intent", "buy");
      window.location.href = "login.html";
      return;
    }

    buyBtn.disabled = true;
    const originalText = buyBtn.textContent;
    buyBtn.textContent = "Please wait…";

    try {
      // 1) Create order on the server
      const orderRes = await fetch("/api/create-order", { method: "POST" });
      const order = await orderRes.json();
      if (!orderRes.ok || !order.orderId) {
        throw new Error(order.error || "Order ban nahi paya.");
      }

      // 2) Get a fresh Firebase ID token for the user
      const idToken = await currentUser.getIdToken();

      // 3) Open Razorpay Checkout
      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "AI Tool Notes",
        description: "AI Course — Lifetime Access",
        order_id: order.orderId,
        prefill: { email: currentUser.email || "" },
        theme: { color: "#4f46e5" },
        handler: async function (response) {
          buyBtn.textContent = "Verifying payment…";
          try {
            const verifyRes = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                idToken: idToken
              })
            });
            const result = await verifyRes.json();
            if (result.verified && result.dbUpdated) {
              window.location.href = "course.html?paid=1";
            } else if (result.verified && !result.dbUpdated) {
              alert(result.error || "Payment ho gaya par access set nahi hua. Support se contact karein.");
            } else {
              alert(result.error || "Payment verify nahi hua.");
            }
          } catch (err) {
            alert("Verification error: " + err.message);
          } finally {
            buyBtn.disabled = false;
            buyBtn.textContent = originalText;
          }
        },
        modal: {
          ondismiss: function () {
            buyBtn.disabled = false;
            buyBtn.textContent = originalText;
          }
        }
      };

      const rzp = new Razorpay(options);
      rzp.open();
    } catch (err) {
      alert("Error: " + err.message);
      buyBtn.disabled = false;
      buyBtn.textContent = originalText;
    }
  });
}
