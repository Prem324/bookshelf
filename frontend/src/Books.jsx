import { useEffect, useState } from "react";
import api from "./api";
import Toast from "./Toast";

const emptyBookForm = {
  title: "",
  author: "",
  year: "",
  isbn: "",
  description: "",
  imageFile: null,
};

const emptyFilters = {
  title: "",
  author: "",
  year: "",
  isbn: "",
};

function buildParams(filters) {
  const params = {};

  if (filters.title.trim()) params.title = filters.title.trim();
  if (filters.author.trim()) params.author = filters.author.trim();
  if (filters.year.trim()) params.year = Number(filters.year.trim());
  if (filters.isbn.trim()) params.isbn = filters.isbn.trim();

  return params;
}

function toPayload(form) {
  return {
    title: form.title.trim(),
    author: form.author.trim(),
    year: form.year.trim() ? Number(form.year.trim()) : null,
    isbn: form.isbn.trim() ? form.isbn.trim() : null,
    description: form.description.trim() ? form.description.trim() : null,
  };
}

function resolveImageUrl(imageUrl) {
  if (!imageUrl) return "";
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) return imageUrl;
  return `${api.defaults.baseURL}${imageUrl}`;
}

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

export default function Books() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [submitting, setSubmitting] = useState(false);
  const [bookForm, setBookForm] = useState(emptyBookForm);
  const [filters, setFilters] = useState(emptyFilters);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyBookForm);

  const fetchBooks = async (nextFilters = filters) => {
    setLoading(true);
    setFeedback({ type: "", text: "" });

    try {
      const res = await api.get("/books", { params: buildParams(nextFilters) });
      setBooks(res.data);
      return true;
    } catch (err) {
      setFeedback({ type: "error", text: getErrorMessage(err, "Could not load books") });
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks(emptyFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!feedback.text) return undefined;
    const timer = setTimeout(() => {
      setFeedback({ type: "", text: "" });
    }, 3000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const uploadImage = async (bookId, file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("image", file);
    await api.post(`/books/${bookId}/image`, formData);
  };

  const onChangeBookForm = (key, value) => {
    setBookForm((prev) => ({ ...prev, [key]: value }));
  };

  const onChangeFilters = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const onChangeEditForm = (key, value) => {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  };

  const addBook = async (e) => {
    e.preventDefault();
    setFeedback({ type: "", text: "" });
    setSubmitting(true);

    try {
      const res = await api.post("/books", toPayload(bookForm));
      await uploadImage(res.data.id, bookForm.imageFile);
      setBookForm(emptyBookForm);
      await fetchBooks();
      setFeedback({ type: "success", text: "Book added successfully." });
    } catch (err) {
      setFeedback({ type: "error", text: getErrorMessage(err, "Could not add book") });
    } finally {
      setSubmitting(false);
    }
  };

  const searchBooks = async (e) => {
    e.preventDefault();
    setFeedback({ type: "", text: "" });
    const ok = await fetchBooks(filters);
    if (ok) {
      setFeedback({ type: "success", text: "Search completed." });
    }
  };

  const resetSearch = async () => {
    setFeedback({ type: "", text: "" });
    setFilters(emptyFilters);
    const ok = await fetchBooks(emptyFilters);
    if (ok) {
      setFeedback({ type: "success", text: "Search reset." });
    }
  };

  const startEdit = (book) => {
    setEditingId(book.id);
    setEditForm({
      title: book.title || "",
      author: book.author || "",
      year: book.year != null ? String(book.year) : "",
      isbn: book.isbn || "",
      description: book.description || "",
      imageFile: null,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(emptyBookForm);
  };

  const saveEdit = async (bookId) => {
    setFeedback({ type: "", text: "" });
    setSubmitting(true);

    try {
      await api.put(`/books/${bookId}`, toPayload(editForm));
      await uploadImage(bookId, editForm.imageFile);
      setEditingId(null);
      setEditForm(emptyBookForm);
      await fetchBooks();
      setFeedback({ type: "success", text: "Book updated successfully." });
    } catch (err) {
      setFeedback({ type: "error", text: getErrorMessage(err, "Could not update book") });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteBook = async (bookId) => {
    setFeedback({ type: "", text: "" });

    try {
      await api.delete(`/books/${bookId}`);
      setBooks((prev) => prev.filter((book) => book.id !== bookId));
      setFeedback({ type: "success", text: "Book deleted successfully." });
    } catch (err) {
      setFeedback({ type: "error", text: getErrorMessage(err, "Could not delete book") });
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    window.location = "/";
  };

  return (
    <main className="page page-books">
      <section className="panel shelf-header fade-in">
        <div className="shelf-header-top">
          <div>
            <p className="eyebrow">Your collection</p>
            <h1>My Bookshelf</h1>
          </div>
          <button className="btn btn-secondary" type="button" onClick={logout}>
            Logout
          </button>
        </div>
        <p className="subtitle">Add, edit, delete, search, and upload book covers.</p>
      </section>

      <section className="panel shelf-body slide-up">
        <form className="book-form" onSubmit={addBook}>
          <label className="field">
            <span>Title</span>
            <input
              value={bookForm.title}
              onChange={(e) => onChangeBookForm("title", e.target.value)}
              placeholder="Atomic Habits"
              required
            />
          </label>
          <label className="field">
            <span>Author</span>
            <input
              value={bookForm.author}
              onChange={(e) => onChangeBookForm("author", e.target.value)}
              placeholder="James Clear"
              required
            />
          </label>
          <label className="field">
            <span>Year</span>
            <input
              type="number"
              value={bookForm.year}
              onChange={(e) => onChangeBookForm("year", e.target.value)}
              placeholder="2018"
            />
          </label>
          <label className="field">
            <span>ISBN</span>
            <input
              value={bookForm.isbn}
              onChange={(e) => onChangeBookForm("isbn", e.target.value)}
              placeholder="9780735211292"
            />
          </label>
          <label className="field field-wide">
            <span>Description</span>
            <textarea
              value={bookForm.description}
              onChange={(e) => onChangeBookForm("description", e.target.value)}
              placeholder="Short description about this book"
              rows={3}
            />
          </label>
          <label className="field">
            <span>Cover Image</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onChangeBookForm("imageFile", e.target.files?.[0] || null)}
            />
          </label>
          <button className="btn btn-primary" disabled={submitting}>
            {submitting ? "Working..." : "Add Book"}
          </button>
        </form>

        <form className="search-form" onSubmit={searchBooks}>
          <label className="field">
            <span>Search Title</span>
            <input
              value={filters.title}
              onChange={(e) => onChangeFilters("title", e.target.value)}
              placeholder="Title contains"
            />
          </label>
          <label className="field">
            <span>Search Author</span>
            <input
              value={filters.author}
              onChange={(e) => onChangeFilters("author", e.target.value)}
              placeholder="Author contains"
            />
          </label>
          <label className="field">
            <span>Search Year</span>
            <input
              type="number"
              value={filters.year}
              onChange={(e) => onChangeFilters("year", e.target.value)}
              placeholder="Exact year"
            />
          </label>
          <label className="field">
            <span>Search ISBN</span>
            <input
              value={filters.isbn}
              onChange={(e) => onChangeFilters("isbn", e.target.value)}
              placeholder="ISBN contains"
            />
          </label>
          <div className="search-actions">
            <button className="btn btn-primary" disabled={loading}>
              Search
            </button>
            <button className="btn btn-secondary" type="button" onClick={resetSearch}>
              Reset
            </button>
          </div>
        </form>

        {loading && <p className="message">Loading books...</p>}
        <Toast message={feedback.text} type={feedback.type === "error" ? "error" : "success"} />
        {!loading && feedback.type !== "error" && books.length === 0 && (
          <p className="message">No matching books found.</p>
        )}

        <div className="book-grid">
          {books.map((b) => {
            const isEditing = editingId === b.id;
            const imageSrc = resolveImageUrl(b.image_url);

            return (
              <article key={b.id} className="book-card">
                <p className="book-label">Book #{b.id}</p>

                {isEditing ? (
                  <div className="edit-grid">
                    <input
                      value={editForm.title}
                      onChange={(e) => onChangeEditForm("title", e.target.value)}
                      placeholder="Title"
                    />
                    <input
                      value={editForm.author}
                      onChange={(e) => onChangeEditForm("author", e.target.value)}
                      placeholder="Author"
                    />
                    <input
                      type="number"
                      value={editForm.year}
                      onChange={(e) => onChangeEditForm("year", e.target.value)}
                      placeholder="Year"
                    />
                    <input
                      value={editForm.isbn}
                      onChange={(e) => onChangeEditForm("isbn", e.target.value)}
                      placeholder="ISBN"
                    />
                    <textarea
                      rows={3}
                      value={editForm.description}
                      onChange={(e) => onChangeEditForm("description", e.target.value)}
                      placeholder="Description"
                    />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => onChangeEditForm("imageFile", e.target.files?.[0] || null)}
                    />
                    <div className="card-actions">
                      <button
                        className="btn btn-primary"
                        type="button"
                        disabled={submitting}
                        onClick={() => saveEdit(b.id)}
                      >
                        Save
                      </button>
                      <button className="btn btn-secondary" type="button" onClick={cancelEdit}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="book-card-main">
                    {imageSrc ? (
                      <img className="book-image" src={imageSrc} alt={b.title} />
                    ) : (
                      <div className="book-image-placeholder">No Image</div>
                    )}

                    <div className="book-content">
                      <h3>{b.title}</h3>
                      <p>{b.author}</p>
                      <p className="book-meta">Year: {b.year ?? "-"}</p>
                      <p className="book-meta">ISBN: {b.isbn ?? "-"}</p>
                      <p className="book-description">{b.description || "No description"}</p>
                      <div className="card-actions">
                        <button
                          className="btn btn-secondary"
                          type="button"
                          onClick={() => startEdit(b)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-danger"
                          type="button"
                          onClick={() => deleteBook(b.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
