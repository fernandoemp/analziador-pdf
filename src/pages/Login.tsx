import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type Props = {
  authStorageKey: string;
};

type DemoUser = {
  email: string;
  password: string;
};

const DEMO_USERS: DemoUser[] = [
  { email: "testing1@openix.com.ar", password: "Openix2026#T1X" },
  { email: "testing2@openix.com.ar", password: "Openix2026#T2Y" },
  { email: "testing3@openix.com.ar", password: "Openix2026#T3Z" },
];

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export default function Login({ authStorageKey }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const fromPath = (location.state as { from?: string } | null)?.from;
  const redirectTo = fromPath && fromPath !== "/login" ? fromPath : "/pdf-extract";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);

  const progressTimerRef = useRef<number | null>(null);

  const isValidCandidate = useMemo(() => {
    return email.trim().length > 0 && password.length > 0;
  }, [email, password]);

  useEffect(() => {
    const existing = localStorage.getItem(authStorageKey);
    if (existing) {
      try {
        const parsed: unknown = JSON.parse(existing);
        const parsedEmail =
          typeof parsed === "object" &&
          parsed !== null &&
          "email" in parsed &&
          typeof (parsed as { email: unknown }).email === "string"
            ? (parsed as { email: string }).email
            : null;
        const isAllowed =
          typeof parsedEmail === "string" &&
          DEMO_USERS.some((u) => u.email.toLowerCase() === parsedEmail.toLowerCase());
        if (isAllowed) {
          navigate("/pdf-extract", { replace: true });
        } else {
          localStorage.removeItem(authStorageKey);
        }
      } catch {
        localStorage.removeItem(authStorageKey);
      }
    }
  }, [authStorageKey, navigate]);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current !== null) {
        window.clearInterval(progressTimerRef.current);
      }
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setProgress(8);

    if (progressTimerRef.current !== null) {
      window.clearInterval(progressTimerRef.current);
    }

    progressTimerRef.current = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 92) return p;
        const step = p < 40 ? 10 : p < 70 ? 6 : 3;
        return Math.min(92, p + step);
      });
    }, 220);

    const baseDelay = 900;
    const jitter = Math.floor(Math.random() * 700);
    await sleep(baseDelay + jitter);

    const normalizedEmail = email.trim().toLowerCase();
    const match = DEMO_USERS.find(
      (u) => u.email.toLowerCase() === normalizedEmail && u.password === password,
    );

    if (!match) {
      if (progressTimerRef.current !== null) {
        window.clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      setProgress(0);
      setIsSubmitting(false);
      toast({
        title: "No se pudo iniciar sesión",
        description: "Usuario o contraseña inválidos.",
        variant: "destructive",
      });
      return;
    }

    localStorage.setItem(
      authStorageKey,
      JSON.stringify({ email: match.email, issuedAt: Date.now() }),
    );

    if (progressTimerRef.current !== null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setProgress(100);

    toast({
      title: "Sesión iniciada",
      description: `Bienvenido ${match.email}`,
    });

    navigate(redirectTo, { replace: true });
  }

  return (
    <div className="min-h-[calc(100vh-0px)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Login</CardTitle>
            <CardDescription>
              Iniciá sesión para acceder al extractor de PDF.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  disabled={isSubmitting}
                  placeholder="testing1@openix.com.ar"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  placeholder="••••••••••"
                />
              </div>

              {isSubmitting ? <Progress value={progress} /> : null}

              <Button
                type="submit"
                className="w-full"
                disabled={!isValidCandidate || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  "Ingresar"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
