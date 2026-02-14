import axios from "axios";

const AUTH_BASE_URL =
  import.meta.env.VITE_AUTH_API_BASE_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8001";
const BOOKS_BASE_URL =
  import.meta.env.VITE_BOOKS_API_BASE_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8002";

const authApi = axios.create({
  baseURL: AUTH_BASE_URL,
});

const booksApi = axios.create({
  baseURL: BOOKS_BASE_URL,
});

const attachAuth = (config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

const handleUnauthorized = (error) => {
  if (error?.response?.status === 401) {
    localStorage.removeItem("token");
    if (window.location.pathname !== "/") {
      window.location = "/";
    }
  }
  return Promise.reject(error);
};

authApi.interceptors.request.use(attachAuth);
booksApi.interceptors.request.use(attachAuth);
authApi.interceptors.response.use((r) => r, handleUnauthorized);
booksApi.interceptors.response.use((r) => r, handleUnauthorized);

export { authApi, booksApi, BOOKS_BASE_URL };
