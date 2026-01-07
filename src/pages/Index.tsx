import { MadeWithDyad } from "@/components/made-with-dyad";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center bg-background text-foreground p-4">
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl font-extrabold mb-6 text-primary">Bienvenido a Finanzas 360</h1>
        <p className="text-xl text-muted-foreground mb-8">
          Tu solución integral para consolidar y analizar tus finanzas desde múltiples fuentes.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" asChild>
            <Link to="/upload">Empezar a Cargar Datos</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/dashboard">Ver Dashboard (Próximamente)</Link>
          </Button>
        </div>
      </div>
      <div className="mt-auto">
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Index;