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

function isValidEmail(value) {
  const email = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [resetting, setResetting] = useState(false);
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
      const res = await authApi.post("/users/login", {
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

  const sendOtp = async () => {
    const targetEmail = (resetEmail || email).trim();
    if (!targetEmail) {
      setToast({ type: "error", text: "Enter your email to receive the OTP." });
      return;
    }
    if (!isValidEmail(targetEmail)) {
      setToast({ type: "error", text: "Enter a valid email address." });
      return;
    }

    setSendingOtp(true);
    setToast({ type: "", text: "" });
    try {
      await authApi.post("/users/forgot-password", { email: targetEmail });
      setResetEmail(targetEmail);
      setToast({ type: "success", text: "OTP sent. Check your email." });
    } catch (err) {
      setToast({ type: "error", text: getErrorMessage(err, "Failed to send OTP") });
    } finally {
      setSendingOtp(false);
    }
  };

  const resetPassword = async () => {
    const targetEmail = (resetEmail || email).trim();
    if (!targetEmail) {
      setToast({ type: "error", text: "Enter your email." });
      return;
    }
    if (!isValidEmail(targetEmail)) {
      setToast({ type: "error", text: "Enter a valid email address." });
      return;
    }

    if (!otp || !newPassword) {
      setToast({ type: "error", text: "Enter the OTP and a new password." });
      return;
    }

    setResetting(true);
    setToast({ type: "", text: "" });
    try {
      await authApi.post("/users/reset-password", {
        email: targetEmail,
        otp,
        new_password: newPassword,
      });
      setToast({ type: "success", text: "Password updated. You can log in now." });
      setShowForgot(false);
      setOtp("");
      setNewPassword("");
    } catch (err) {
      setToast({ type: "error", text: getErrorMessage(err, "Password reset failed") });
    } finally {
      setResetting(false);
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
            autoComplete="email"
            autoFocus
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
            autoComplete="current-password"
            minLength={6}
          />
        </label>

        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => setShowForgot((prev) => !prev)}
          disabled={submitting || sendingOtp || resetting}
        >
          {showForgot ? "Hide forgot password" : "Forgot password?"}
        </button>

        {showForgot ? (
          <div className="panel form-panel">
            <h3>Reset Password</h3>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>
            <div className="actions">
              <button
                className="btn btn-secondary"
                type="button"
                disabled={sendingOtp || resetting}
                onClick={sendOtp}
              >
                {sendingOtp ? "Sending..." : "Send OTP"}
              </button>
            </div>
            <label className="field">
              <span>OTP</span>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="6-digit code"
                minLength={4}
                maxLength={10}
              />
            </label>
            <label className="field">
              <span>New Password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                minLength={6}
              />
            </label>
            <div className="actions">
              <button
                className="btn btn-primary"
                type="button"
                disabled={resetting || sendingOtp}
                onClick={resetPassword}
              >
                {resetting ? "Updating..." : "Update password"}
              </button>
            </div>
          </div>
        ) : null}

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
        <p className="helper">We only use your email to sign you in.</p>

        <Toast message={toast.text} type={toast.type} />
      </form>
    </main>
  );
}
