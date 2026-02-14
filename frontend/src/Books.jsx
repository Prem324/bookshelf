import { useEffect, useState } from "react";
import { booksApi, BOOKS_BASE_URL } from "./api";
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
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://"))
    return imageUrl;
  return `${BOOKS_BASE_URL}${imageUrl}`;
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
  const [meta, setMeta] = useState({
    page: 1,
    page_size: 10,
    total: 0,
    total_pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [submitting, setSubmitting] = useState(false);
  const [bookForm, setBookForm] = useState(emptyBookForm);
  const [bookPreview, setBookPreview] = useState("");
  const [bookFormAttempted, setBookFormAttempted] = useState(false);
  const [filters, setFilters] = useState(emptyFilters);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyBookForm);
  const [editPreview, setEditPreview] = useState("");
  const [editFormAttempted, setEditFormAttempted] = useState(false);
  const hasActiveFilters =
    Boolean(filters.title.trim()) ||
    Boolean(filters.author.trim()) ||
    Boolean(filters.year.trim()) ||
    Boolean(filters.isbn.trim());

  const fetchBooks = async (nextFilters = filters, page = 1) => {
    setLoading(true);
    setFeedback({ type: "", text: "" });

    try {
      const res = await booksApi.get("/books", {
        params: {
          ...buildParams(nextFilters),
          page,
          page_size: meta.page_size,
        },
      });
      const data = res.data;
      const items = Array.isArray(data) ? data : data?.items || [];
      setBooks(items);
      if (data?.meta) {
        setMeta(data.meta);
      } else {
        setMeta((prev) => ({
          ...prev,
          page,
          total: items.length,
          total_pages: 1,
        }));
      }
      return true;
    } catch (err) {
      setFeedback({
        type: "error",
        text: getErrorMessage(err, "Could not load books"),
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks(emptyFilters, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!feedback.text) return undefined;
    const timer = setTimeout(() => {
      setFeedback({ type: "", text: "" });
    }, 3000);
    return () => clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    if (!bookForm.imageFile) {
      setBookPreview("");
      return undefined;
    }
    const previewUrl = URL.createObjectURL(bookForm.imageFile);
    setBookPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [bookForm.imageFile]);

  useEffect(() => {
    if (!editForm.imageFile) {
      setEditPreview("");
      return undefined;
    }
    const previewUrl = URL.createObjectURL(editForm.imageFile);
    setEditPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [editForm.imageFile]);

  const uploadImage = async (bookId, file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("image", file);
    await booksApi.post(`/books/${bookId}/image`, formData);
  };

  const validation = {
    title: bookForm.title.trim().length > 0,
    author: bookForm.author.trim().length > 0,
    year:
      bookForm.year.trim().length === 0 ||
      (Number(bookForm.year) >= 0 && Number(bookForm.year) <= 9999),
    isbn:
      bookForm.isbn.trim().length === 0 || bookForm.isbn.trim().length <= 32,
    description: bookForm.description.trim().length <= 2000,
  };

  const editValidation = {
    title: editForm.title.trim().length > 0,
    author: editForm.author.trim().length > 0,
    year:
      editForm.year.trim().length === 0 ||
      (Number(editForm.year) >= 0 && Number(editForm.year) <= 9999),
    isbn:
      editForm.isbn.trim().length === 0 || editForm.isbn.trim().length <= 32,
    description: editForm.description.trim().length <= 2000,
  };

  const isBookFormValid = Object.values(validation).every(Boolean);
  const isEditFormValid = Object.values(editValidation).every(Boolean);

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
    setBookFormAttempted(true);
    if (!isBookFormValid) {
      setFeedback({
        type: "error",
        text: "Please fix the highlighted fields.",
      });
      return;
    }
    setSubmitting(true);

    try {
      const res = await booksApi.post("/books", toPayload(bookForm));
      await uploadImage(res.data.id, bookForm.imageFile);
      setBookForm(emptyBookForm);
      setBookPreview("");
      setBookFormAttempted(false);
      await fetchBooks(filters, meta.page);
      setFeedback({ type: "success", text: "Book added successfully." });
    } catch (err) {
      setFeedback({
        type: "error",
        text: getErrorMessage(err, "Could not add book"),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const searchBooks = async (e) => {
    e.preventDefault();
    setFeedback({ type: "", text: "" });
    const ok = await fetchBooks(filters, 1);
    if (ok) {
      setFeedback({ type: "success", text: "Search completed." });
    }
  };

  const resetSearch = async () => {
    setFeedback({ type: "", text: "" });
    setFilters(emptyFilters);
    const ok = await fetchBooks(emptyFilters, 1);
    if (ok) {
      setFeedback({ type: "success", text: "Search reset." });
    }
  };

  const startEdit = (book) => {
    setEditingId(book.id);
    setEditFormAttempted(false);
    setEditPreview("");
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
    setEditPreview("");
    setEditFormAttempted(false);
  };

  const saveEdit = async (bookId) => {
    setFeedback({ type: "", text: "" });
    setEditFormAttempted(true);
    if (!isEditFormValid) {
      setFeedback({
        type: "error",
        text: "Please fix the highlighted fields.",
      });
      return;
    }
    setSubmitting(true);

    try {
      await booksApi.put(`/books/${bookId}`, toPayload(editForm));
      await uploadImage(bookId, editForm.imageFile);
      setEditingId(null);
      setEditForm(emptyBookForm);
      setEditPreview("");
      setEditFormAttempted(false);
      await fetchBooks(filters, meta.page);
      setFeedback({ type: "success", text: "Book updated successfully." });
    } catch (err) {
      setFeedback({
        type: "error",
        text: getErrorMessage(err, "Could not update book"),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteBook = async (bookId) => {
    setFeedback({ type: "", text: "" });

    try {
      const shouldDelete = window.confirm(
        "Delete this book? This cannot be undone.",
      );
      if (!shouldDelete) return;
      await booksApi.delete(`/books/${bookId}`);
      setBooks((prev) => prev.filter((book) => book.id !== bookId));
      setFeedback({ type: "success", text: "Book deleted successfully." });
    } catch (err) {
      setFeedback({
        type: "error",
        text: getErrorMessage(err, "Could not delete book"),
      });
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    window.location = "/";
  };

  const clearAddForm = () => {
    setBookForm(emptyBookForm);
    setBookPreview("");
    setBookFormAttempted(false);
  };

  const activeFilters = [
    filters.title.trim() && `Title: "${filters.title.trim()}"`,
    filters.author.trim() && `Author: "${filters.author.trim()}"`,
    filters.year.trim() && `Year: ${filters.year.trim()}`,
    filters.isbn.trim() && `ISBN: "${filters.isbn.trim()}"`,
  ].filter(Boolean);

  return (
    <main className="page page-books">
      <Toast
        message={feedback.text}
        type={feedback.type === "error" ? "error" : "success"}
      />
      <section className="panel shelf-header fade-in">
        <div className="shelf-header-top">
          <div>
            <p className="eyebrow">Your collection</p>
            <h1>My Bookshelf</h1>
          </div>
          <div className="nav-chip">
            <span>Signed in</span>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={logout}
              aria-label="Log out"
            >
              Logout
            </button>
          </div>
        </div>
        <p className="subtitle">
          Add, edit, delete, search, and upload book covers.
        </p>
        <div className="shelf-meta">
          <span>{loading ? "Loading..." : `${meta.total} books`}</span>
          {activeFilters.length > 0 && (
            <span className="filter-pill">
              Filters: {activeFilters.join(", ")}
            </span>
          )}
        </div>
      </section>

      <section className="panel shelf-body slide-up">
        <div className="form-section">
          <div className="section-header">
            <div>
              <h2>Add a book</h2>
              <p className="helper">
                Fill out the details and optionally attach a cover image.
              </p>
            </div>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={clearAddForm}
            >
              Clear form
            </button>
          </div>
          <form className="book-form" onSubmit={addBook}>
            <label
              className={`field ${bookFormAttempted && !validation.title ? "field-invalid" : ""}`}
            >
              <span>Title</span>
              <input
                value={bookForm.title}
                onChange={(e) => onChangeBookForm("title", e.target.value)}
                placeholder="Atomic Habits"
                required
                autoComplete="off"
                aria-invalid={bookFormAttempted && !validation.title}
                aria-describedby="title-help"
              />
              <small className="hint" id="title-help">
                Required. Keep it short and clear.
              </small>
              {bookFormAttempted && !validation.title && (
                <small className="field-error">Title is required.</small>
              )}
            </label>
            <label
              className={`field ${bookFormAttempted && !validation.author ? "field-invalid" : ""}`}
            >
              <span>Author</span>
              <input
                value={bookForm.author}
                onChange={(e) => onChangeBookForm("author", e.target.value)}
                placeholder="James Clear"
                required
                autoComplete="off"
                aria-invalid={bookFormAttempted && !validation.author}
                aria-describedby="author-help"
              />
              <small className="hint" id="author-help">
                Required. Use full name if possible.
              </small>
              {bookFormAttempted && !validation.author && (
                <small className="field-error">Author is required.</small>
              )}
            </label>
            <label
              className={`field ${bookFormAttempted && !validation.year ? "field-invalid" : ""}`}
            >
              <span>Year</span>
              <input
                type="number"
                value={bookForm.year}
                onChange={(e) => onChangeBookForm("year", e.target.value)}
                placeholder="2018"
                min="0"
                max="9999"
                aria-invalid={bookFormAttempted && !validation.year}
                aria-describedby="year-help"
              />
              <small className="hint" id="year-help">
                Optional. 0–9999.
              </small>
              {bookFormAttempted && !validation.year && (
                <small className="field-error">Enter a valid year.</small>
              )}
            </label>
            <label
              className={`field ${bookFormAttempted && !validation.isbn ? "field-invalid" : ""}`}
            >
              <span>ISBN</span>
              <input
                value={bookForm.isbn}
                onChange={(e) => onChangeBookForm("isbn", e.target.value)}
                placeholder="9780735211292"
                autoComplete="off"
                aria-invalid={bookFormAttempted && !validation.isbn}
                aria-describedby="isbn-help"
              />
              <small className="hint" id="isbn-help">
                Optional. Up to 32 characters.
              </small>
              {bookFormAttempted && !validation.isbn && (
                <small className="field-error">ISBN is too long.</small>
              )}
            </label>
            <label
              className={`field field-wide ${bookFormAttempted && !validation.description ? "field-invalid" : ""}`}
            >
              <span>Description</span>
              <textarea
                value={bookForm.description}
                onChange={(e) =>
                  onChangeBookForm("description", e.target.value)
                }
                placeholder="Short description about this book"
                rows={3}
                aria-invalid={bookFormAttempted && !validation.description}
                aria-describedby="description-help"
              />
              <small className="hint" id="description-help">
                Optional. Up to 2000 characters.
              </small>
              {bookFormAttempted && !validation.description && (
                <small className="field-error">Description is too long.</small>
              )}
            </label>
            <label className="field">
              <span>Cover Image</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  onChangeBookForm("imageFile", e.target.files?.[0] || null)
                }
              />
            </label>
            <div className="field image-preview">
              <span>Preview</span>
              {bookPreview ? (
                <img
                  className="preview-image"
                  src={bookPreview}
                  alt="Selected cover preview"
                />
              ) : (
                <div className="preview-placeholder">No image selected</div>
              )}
            </div>
            <button className="btn btn-primary" disabled={submitting}>
              {submitting ? "Working..." : "Add Book"}
            </button>
          </form>
        </div>

        <div className="form-section">
          <div className="section-header">
            <div>
              <h2>Search your shelf</h2>
              <p className="helper">
                Use one or more filters to narrow results.
              </p>
            </div>
          </div>
          <form className="search-form" onSubmit={searchBooks}>
            <label className="field">
              <span>Search Title</span>
              <input
                value={filters.title}
                onChange={(e) => onChangeFilters("title", e.target.value)}
                placeholder="Title contains"
                autoComplete="off"
              />
            </label>
            <label className="field">
              <span>Search Author</span>
              <input
                value={filters.author}
                onChange={(e) => onChangeFilters("author", e.target.value)}
                placeholder="Author contains"
                autoComplete="off"
              />
            </label>
            <label className="field">
              <span>Search Year</span>
              <input
                type="number"
                value={filters.year}
                onChange={(e) => onChangeFilters("year", e.target.value)}
                placeholder="Exact year"
                min="0"
                max="9999"
              />
            </label>
            <label className="field">
              <span>Search ISBN</span>
              <input
                value={filters.isbn}
                onChange={(e) => onChangeFilters("isbn", e.target.value)}
                placeholder="ISBN contains"
                autoComplete="off"
              />
            </label>
            <div className="search-actions">
              <button
                className="btn btn-primary"
                disabled={loading || submitting}
              >
                Search
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={resetSearch}
                disabled={loading || submitting}
              >
                Reset
              </button>
            </div>
          </form>
        </div>

        {loading && (
          <div className="book-grid" aria-busy="true" aria-live="polite">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                className="book-card skeleton-card"
                key={`skeleton-${index}`}
              >
                <div className="skeleton-image" />
                <div className="skeleton-line short" />
                <div className="skeleton-line" />
                <div className="skeleton-line" />
                <div className="skeleton-line long" />
              </div>
            ))}
          </div>
        )}
        {!loading && feedback.type !== "error" && books.length === 0 && (
          <div className="empty-state">
            <h3>{hasActiveFilters ? "No matches found" : "No books yet"}</h3>
            <p>
              {hasActiveFilters
                ? "Try adjusting your filters or reset the search."
                : "Add your first book to start building your shelf."}
            </p>
            {!hasActiveFilters && (
              <p className="empty-tip">
                Tip: add an image to make your shelf pop.
              </p>
            )}
          </div>
        )}

        {!loading && (
          <div className="book-grid">
            {books.map((b) => {
              const isEditing = editingId === b.id;
              const imageSrc = resolveImageUrl(b.image_url);

              return (
                <article key={b.id} className="book-card">
                  <p className="book-label">Book #{b.id}</p>

                  <div className="book-card-main">
                    {imageSrc ? (
                      <img
                        className="book-image"
                        src={imageSrc}
                        alt={b.title}
                      />
                    ) : (
                      <div className="book-image-placeholder">No Image</div>
                    )}

                    <div className="book-content">
                      <h3>{b.title}</h3>
                      <p>{b.author}</p>
                      <p className="book-meta">Year: {b.year ?? "-"}</p>
                      <p className="book-meta">ISBN: {b.isbn ?? "-"}</p>
                      <p className="book-description">
                        {b.description || "No description"}
                      </p>
                      <div className="card-actions">
                        <button
                          className="btn btn-secondary"
                          type="button"
                          onClick={() =>
                            isEditing ? cancelEdit() : startEdit(b)
                          }
                          aria-expanded={isEditing}
                          aria-controls={`edit-panel-${b.id}`}
                        >
                          {isEditing ? "Close" : "Edit"}
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

                  {isEditing && (
                    <div className="edit-panel" id={`edit-panel-${b.id}`}>
                      <div className="edit-header">
                        <div>
                          <h4>Edit details</h4>
                          <p>Update the fields below and save your changes.</p>
                        </div>
                        <button
                          className="btn btn-secondary"
                          type="button"
                          onClick={cancelEdit}
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="edit-grid">
                        <label
                          className={`field ${editFormAttempted && !editValidation.title ? "field-invalid" : ""}`}
                        >
                          <span>Title</span>
                          <input
                            value={editForm.title}
                            onChange={(e) =>
                              onChangeEditForm("title", e.target.value)
                            }
                            placeholder="Title"
                            aria-invalid={
                              editFormAttempted && !editValidation.title
                            }
                          />
                          {editFormAttempted && !editValidation.title && (
                            <small className="field-error">
                              Title is required.
                            </small>
                          )}
                        </label>
                        <label
                          className={`field ${editFormAttempted && !editValidation.author ? "field-invalid" : ""}`}
                        >
                          <span>Author</span>
                          <input
                            value={editForm.author}
                            onChange={(e) =>
                              onChangeEditForm("author", e.target.value)
                            }
                            placeholder="Author"
                            aria-invalid={
                              editFormAttempted && !editValidation.author
                            }
                          />
                          {editFormAttempted && !editValidation.author && (
                            <small className="field-error">
                              Author is required.
                            </small>
                          )}
                        </label>
                        <label
                          className={`field ${editFormAttempted && !editValidation.year ? "field-invalid" : ""}`}
                        >
                          <span>Year</span>
                          <input
                            type="number"
                            value={editForm.year}
                            onChange={(e) =>
                              onChangeEditForm("year", e.target.value)
                            }
                            placeholder="Year"
                            min="0"
                            max="9999"
                            aria-invalid={
                              editFormAttempted && !editValidation.year
                            }
                          />
                          {editFormAttempted && !editValidation.year && (
                            <small className="field-error">
                              Enter a valid year.
                            </small>
                          )}
                        </label>
                        <label
                          className={`field ${editFormAttempted && !editValidation.isbn ? "field-invalid" : ""}`}
                        >
                          <span>ISBN</span>
                          <input
                            value={editForm.isbn}
                            onChange={(e) =>
                              onChangeEditForm("isbn", e.target.value)
                            }
                            placeholder="ISBN"
                            autoComplete="off"
                            aria-invalid={
                              editFormAttempted && !editValidation.isbn
                            }
                          />
                          {editFormAttempted && !editValidation.isbn && (
                            <small className="field-error">
                              ISBN is too long.
                            </small>
                          )}
                        </label>
                        <label
                          className={`field ${editFormAttempted && !editValidation.description ? "field-invalid" : ""}`}
                        >
                          <span>Description</span>
                          <textarea
                            rows={3}
                            value={editForm.description}
                            onChange={(e) =>
                              onChangeEditForm("description", e.target.value)
                            }
                            placeholder="Description"
                            aria-invalid={
                              editFormAttempted && !editValidation.description
                            }
                          />
                          {editFormAttempted && !editValidation.description && (
                            <small className="field-error">
                              Description is too long.
                            </small>
                          )}
                        </label>
                        <label className="field">
                          <span>Cover Image</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              onChangeEditForm(
                                "imageFile",
                                e.target.files?.[0] || null,
                              )
                            }
                          />
                        </label>
                        <div className="image-preview">
                          {editPreview ? (
                            <img
                              className="preview-image"
                              src={editPreview}
                              alt="Selected cover preview"
                            />
                          ) : imageSrc ? (
                            <img
                              className="preview-image"
                              src={imageSrc}
                              alt={`${b.title} cover`}
                            />
                          ) : (
                            <div className="preview-placeholder">
                              No image selected
                            </div>
                          )}
                        </div>
                        <div className="card-actions">
                          <button
                            className="btn btn-primary"
                            type="button"
                            disabled={submitting}
                            onClick={() => saveEdit(b.id)}
                          >
                            Save changes
                          </button>
                          <button
                            className="btn btn-secondary"
                            type="button"
                            onClick={cancelEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
