import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import PdfExtract from "./pages/PdfExtract";
import Login from "./pages/Login";
import Navbar from "./components/layout/Navbar";

const queryClient = new QueryClient();

const AUTH_STORAGE_KEY = "openix_pdfextract_session_v1";
const ALLOWED_EMAILS = new Set([
  "testing1@openix.com.ar",
  "testing2@openix.com.ar",
  "testing3@openix.com.ar",
]);

type AuthSession = {
  email: string;
  issuedAt: number;
};

function getAuthSession(): AuthSession | null {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "email" in parsed &&
      "issuedAt" in parsed &&
      typeof (parsed as { email: unknown }).email === "string" &&
      typeof (parsed as { issuedAt: unknown }).issuedAt === "number"
    ) {
      const session = parsed as AuthSession;
      if (!ALLOWED_EMAILS.has(session.email.toLowerCase())) return null;
      return session;
    }
    return null;
  } catch {
    return null;
  }
}

function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const session = getAuthSession();

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

const AppShell = () => {
  const location = useLocation();
  const showNavbar = location.pathname !== "/login";

  return (
    <>
      {showNavbar ? <Navbar authStorageKey={AUTH_STORAGE_KEY} /> : null}
      <Routes>
        <Route path="/login" element={<Login authStorageKey={AUTH_STORAGE_KEY} />} />
        <Route
          path="/pdf-extract"
          element={
            <RequireAuth>
              <PdfExtract />
            </RequireAuth>
          }
        />
        <Route path="/" element={<Navigate to="/pdf-extract" replace />} />
        <Route path="*" element={<Navigate to="/pdf-extract" replace />} />
      </Routes>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
