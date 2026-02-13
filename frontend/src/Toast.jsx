export default function Toast({ message, type = "info" }) {
  if (!message) return null;

  return (
    <div className={`toast toast-${type}`} role="status" aria-live="polite">
      {message}
    </div>
  );
}
