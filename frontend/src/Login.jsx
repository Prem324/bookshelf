import { useEffect, useState } from "react";
import api from "./api";
import Toast from "./Toast";

function getErrorMessage(err, fallback) {
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => (typeof item?.msg === "string" ? item.msg : ""))
      .filter(Boolean);
    if (messages.length) return messages.join(", ");
  }
  return fallback;
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState({ type: "", text: "" });

  useEffect(() => {
    if (!toast.text) return undefined;
    const timer = setTimeout(() => {
      setToast({ type: "", text: "" });
    }, 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const submit = async (e) => {
    e.preventDefault();
    setToast({ type: "", text: "" });
    setSubmitting(true);

    try {
      const res = await api.post("/users/login", {
        email,
        password,
      });

      localStorage.setItem("token", res.data.token);
      setToast({ type: "success", text: "Login successful. Redirecting..." });
      setTimeout(() => {
        window.location = "/books";
      }, 900);
    } catch (err) {
      setToast({ type: "error", text: getErrorMessage(err, "Login failed") });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="page page-auth">
      <section className="auth-hero fade-in">
        <p className="eyebrow">Books API</p>
        <h1>Welcome Back</h1>
        <p className="subtitle">Sign in to manage your personal shelf.</p>
      </section>

      <form className="panel form-panel slide-up" onSubmit={submit}>
        <h2>Login</h2>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            required
          />
        </label>

        <div className="actions">
          <button className="btn btn-primary" disabled={submitting}>
            {submitting ? "Logging in..." : "Login"}
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            disabled={submitting}
            onClick={() => (window.location = "/register")}
          >
            Create account
          </button>
        </div>

        <Toast message={toast.text} type={toast.type} />
      </form>
    </main>
  );
}
