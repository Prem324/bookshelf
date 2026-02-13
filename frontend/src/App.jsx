import { BrowserRouter, Navigate, Outlet, Routes, Route } from "react-router-dom";
import "./App.css";

import Login from "./Login";
import Register from "./Register";
import Books from "./Books";

function hasToken() {
  return Boolean(localStorage.getItem("token"));
}

function ProtectedRoute() {
  return hasToken() ? <Outlet /> : <Navigate to="/" replace />;
}

function PublicOnlyRoute() {
  return hasToken() ? <Navigate to="/books" replace /> : <Outlet />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/books" element={<Books />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
