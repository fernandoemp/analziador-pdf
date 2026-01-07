import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import PdfStructuredExtractor from '@/components/PdfStructuredExtractor';

const PdfExtract: React.FC = () => {
  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <Card className="w-full mb-4">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">Extractor PDF</CardTitle>
          <CardDescription className="text-center">
            Extrae tablas de extractos bancarios en PDF usando posiciones del texto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PdfStructuredExtractor />
        </CardContent>
      </Card>
    </div>
  );
};

export default PdfExtract;
