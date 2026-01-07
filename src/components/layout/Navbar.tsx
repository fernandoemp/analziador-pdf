import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, UploadCloud, BarChart2, Table, FolderOpen, User, FileType } from 'lucide-react';

const Navbar: React.FC = () => {
  return (
    <nav className="bg-primary text-primary-foreground p-4 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold">
          Finanzas 360
        </Link>
        <div className="flex space-x-4">
          <Button variant="ghost" asChild>
            <Link to="/">
              <Home className="mr-2 h-4 w-4" /> Dashboard
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/upload">
              <UploadCloud className="mr-2 h-4 w-4" /> Cargar
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/analysis">
              <Table className="mr-2 h-4 w-4" /> Análisis
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/files">
              <FolderOpen className="mr-2 h-4 w-4" /> Archivos
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/pdf-extract">
              <FileType className="mr-2 h-4 w-4" /> Extractor PDF
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/account">
              <User className="mr-2 h-4 w-4" /> Cuenta
            </Link>
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
