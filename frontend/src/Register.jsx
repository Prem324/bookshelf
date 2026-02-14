import { useEffect, useState } from "react";
import { authApi } from "./api";
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

export default function Register() {
  const [name, setName] = useState("");
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
      await authApi.post("/users/register", {
        name,
        email,
        password,
      });
      setToast({ type: "success", text: "Registration successful. Redirecting to login..." });
      setTimeout(() => {
        window.location = "/";
      }, 1000);
    } catch (err) {
      setToast({ type: "error", text: getErrorMessage(err, "Registration failed") });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="page page-auth">
      <section className="auth-hero fade-in">
        <p className="eyebrow">Books API</p>
        <h1>Create Account</h1>
        <p className="subtitle">Start building your own digital library.</p>
      </section>

      <form className="panel form-panel slide-up" onSubmit={submit}>
        <h2>Register</h2>

        <label className="field">
          <span>Name</span>
          <input
            placeholder="Your full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            autoFocus
          />
        </label>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={6}
          />
        </label>

        <div className="actions">
          <button className="btn btn-primary" disabled={submitting}>
            {submitting ? "Registering..." : "Register"}
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            disabled={submitting}
            onClick={() => (window.location = "/")}
          >
            Back to login
          </button>
        </div>
        <p className="helper">Use a strong password. You can change it later.</p>

        <Toast message={toast.text} type={toast.type} />
      </form>
    </main>
  );
}
