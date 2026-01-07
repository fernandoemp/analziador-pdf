import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { BarChart2, DollarSign, TrendingUp, Building2, TrendingDown, RefreshCw, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { localDb } from '@/lib/localDb';
import { FileRecord, Transaction, Bank } from '@/types/finanzas';
import { formatMoney } from '@/lib/formatters';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface BankSummary {
  bankId: string;
  bankName: string;
  balance: number;
  income: number;
  expenses: number;
  transactionCount: number;
}

const Dashboard: React.FC = () => {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const loadedFiles = localDb.getFiles();
    const loadedTransactions = localDb.getTransactions();
    setFiles(loadedFiles);
    setTransactions(loadedTransactions);
  };

  // Calcular KPIs avanzados
  const kpis = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    // KPI 1: Saldo Total Consolidado
    const totalBalance = transactions.reduce((sum, t) => sum + t.amount, 0);
    
    // Saldo del mes anterior
    const lastMonthBalance = transactions
      .filter(t => {
        const date = new Date(t.date);
        return date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear;
      })
      .reduce((sum, t) => sum + t.amount, 0);
    
    const balanceChange = lastMonthBalance !== 0 
      ? ((totalBalance - lastMonthBalance) / Math.abs(lastMonthBalance)) * 100 
      : 0;

    // KPI 2: Ingresos del Mes
    const monthlyIncome = transactions
      .filter(t => {
        const date = new Date(t.date);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear && t.amount > 0;
      })
      .reduce((sum, t) => sum + t.amount, 0);

    // Promedio de ingresos últimos 6 meses
    const last6MonthsIncome = [];
    for (let i = 0; i < 6; i++) {
      const month = currentMonth - i < 0 ? 12 + (currentMonth - i) : currentMonth - i;
      const year = currentMonth - i < 0 ? currentYear - 1 : currentYear;
      const income = transactions
        .filter(t => {
          const date = new Date(t.date);
          return date.getMonth() === month && date.getFullYear() === year && t.amount > 0;
        })
        .reduce((sum, t) => sum + t.amount, 0);
      last6MonthsIncome.push(income);
    }
    const avgIncome = last6MonthsIncome.reduce((a, b) => a + b, 0) / 6;
    const incomeChange = avgIncome !== 0 ? ((monthlyIncome - avgIncome) / avgIncome) * 100 : 0;

    // KPI 3: Egresos del Mes
    const monthlyExpenses = transactions
      .filter(t => {
        const date = new Date(t.date);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear && t.amount < 0;
      })
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const lastMonthExpenses = transactions
      .filter(t => {
        const date = new Date(t.date);
        return date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear && t.amount < 0;
      })
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const expensesChange = lastMonthExpenses !== 0 
      ? ((monthlyExpenses - lastMonthExpenses) / lastMonthExpenses) * 100 
      : 0;

    // KPI 4: Balance Mensual
    const monthlyBalance = monthlyIncome - monthlyExpenses;

    return {
      totalBalance,
      balanceChange,
      monthlyIncome,
      incomeChange,
      monthlyExpenses,
      expensesChange,
      monthlyBalance,
    };
  }, [transactions]);

  // Calcular resúmenes por banco
  const bankSummaries = useMemo(() => {
    const summaryMap = new Map<string, BankSummary>();

    files.forEach(file => {
      if (!file.bank_id) return;

      const bank = localDb.getBankById(file.bank_id);
      if (!bank) return;

      const fileTransactions = transactions.filter(t => t.file_id === file.id);
      const balance = fileTransactions.reduce((sum, t) => sum + t.amount, 0);
      const income = fileTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
      const expenses = fileTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);

      if (summaryMap.has(file.bank_id)) {
        const existing = summaryMap.get(file.bank_id)!;
        summaryMap.set(file.bank_id, {
          bankId: file.bank_id,
          bankName: bank.name,
          balance: existing.balance + balance,
          income: existing.income + income,
          expenses: existing.expenses + expenses,
          transactionCount: existing.transactionCount + fileTransactions.length,
        });
      } else {
        summaryMap.set(file.bank_id, {
          bankId: file.bank_id,
          bankName: bank.name,
          balance,
          income,
          expenses,
          transactionCount: fileTransactions.length,
        });
      }
    });

    return Array.from(summaryMap.values()).sort((a, b) => b.balance - a.balance);
  }, [files, transactions]);

  // Datos para gráfico de evolución mensual (últimos 12 meses)
  const monthlyEvolutionData = useMemo(() => {
    const now = new Date();
    const data = [];

    for (let i = 11; i >= 0; i--) {
      const month = now.getMonth() - i < 0 ? 12 + (now.getMonth() - i) : now.getMonth() - i;
      const year = now.getMonth() - i < 0 ? now.getFullYear() - 1 : now.getFullYear();

      const monthTransactions = transactions.filter(t => {
        const date = new Date(t.date);
        return date.getMonth() === month && date.getFullYear() === year;
      });

      const income = monthTransactions
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);

      const expenses = Math.abs(
        monthTransactions
          .filter(t => t.amount < 0)
          .reduce((sum, t) => sum + t.amount, 0)
      );

      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      
      data.push({
        month: `${monthNames[month]} ${year}`,
        ingresos: Math.round(income),
        egresos: Math.round(expenses),
      });
    }

    return data;
  }, [transactions]);

  // Datos para gráfico de composición por fuente
  const sourceCompositionData = useMemo(() => {
    return bankSummaries.map(summary => ({
      name: summary.bankName,
      value: Math.round(Math.abs(summary.balance)),
      percentage: 0, // Se calculará después
    }));
  }, [bankSummaries]);

  // Calcular porcentajes
  const totalAbsoluteBalance = sourceCompositionData.reduce((sum, item) => sum + item.value, 0);
  sourceCompositionData.forEach(item => {
    item.percentage = totalAbsoluteBalance > 0 ? (item.value / totalAbsoluteBalance) * 100 : 0;
  });

  // Colores para el gráfico de dona
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658'];

  return (
    <div className="container mx-auto p-4 min-h-[calc(100vh-64px)] flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-4xl font-bold text-primary">Tu Dashboard Financiero</h1>
          <p className="text-lg text-muted-foreground mt-2">
            Resumen de tus finanzas consolidadas
          </p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* KPIs Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* KPI 1: Saldo Total Consolidado */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Total Consolidado</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${kpis.totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatMoney(kpis.totalBalance)}
            </div>
            <div className="flex items-center text-xs mt-1">
              {kpis.balanceChange >= 0 ? (
                <ArrowUp className="h-3 w-3 text-green-600 mr-1" />
              ) : (
                <ArrowDown className="h-3 w-3 text-red-600 mr-1" />
              )}
              <span className={kpis.balanceChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                {Math.abs(kpis.balanceChange).toFixed(1)}%
              </span>
              <span className="text-muted-foreground ml-1">vs mes anterior</span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Ingresos del Mes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos del Mes</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatMoney(kpis.monthlyIncome)}
            </div>
            <div className="flex items-center text-xs mt-1">
              {kpis.incomeChange >= 0 ? (
                <ArrowUp className="h-3 w-3 text-green-600 mr-1" />
              ) : (
                <ArrowDown className="h-3 w-3 text-red-600 mr-1" />
              )}
              <span className={kpis.incomeChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                {Math.abs(kpis.incomeChange).toFixed(1)}%
              </span>
              <span className="text-muted-foreground ml-1">vs promedio 6 meses</span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: Egresos del Mes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Egresos del Mes</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatMoney(kpis.monthlyExpenses)}
            </div>
            <div className="flex items-center text-xs mt-1">
              {kpis.expensesChange >= 0 ? (
                <ArrowUp className="h-3 w-3 text-red-600 mr-1" />
              ) : (
                <ArrowDown className="h-3 w-3 text-green-600 mr-1" />
              )}
              <span className={kpis.expensesChange >= 0 ? 'text-red-600' : 'text-green-600'}>
                {Math.abs(kpis.expensesChange).toFixed(1)}%
              </span>
              <span className="text-muted-foreground ml-1">vs mes anterior</span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Balance Mensual */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance Mensual</CardTitle>
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${kpis.monthlyBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {kpis.monthlyBalance >= 0 ? '+' : ''}{formatMoney(kpis.monthlyBalance)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Ingresos - Egresos (mes actual)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Gráfico 1: Evolución Mensual */}
        <Card>
          <CardHeader>
            <CardTitle>Evolución Mensual</CardTitle>
            <CardDescription>Ingresos y egresos de los últimos 12 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyEvolutionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip 
                  formatter={(value: number) => formatMoney(value)}
                  contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #ccc' }}
                />
                <Legend />
                <Bar dataKey="ingresos" fill="#10b981" name="Ingresos" />
                <Bar dataKey="egresos" fill="#ef4444" name="Egresos" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico 2: Composición por Fuente */}
        <Card>
          <CardHeader>
            <CardTitle>Composición por Fuente</CardTitle>
            <CardDescription>Distribución del saldo por banco/entidad</CardDescription>
          </CardHeader>
          <CardContent>
            {sourceCompositionData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No hay datos para mostrar
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={sourceCompositionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {sourceCompositionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatMoney(value)}
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #ccc' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="w-full max-w-6xl mx-auto mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Resumen por Banco/Institución
          </CardTitle>
          <CardDescription>Balance y movimientos de cada banco cargado</CardDescription>
        </CardHeader>
        <CardContent>
          {bankSummaries.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No hay datos cargados. Sube tus archivos en la sección de Carga de Datos.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bankSummaries.map((summary) => (
                <Card key={summary.bankId} className="border-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center justify-between">
                      {summary.bankName}
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Balance:</span>
                      <span className={`font-bold ${summary.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatMoney(summary.balance)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Ingresos:</span>
                      <span className="font-semibold text-green-600">+{formatMoney(summary.income)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Gastos:</span>
                      <span className="font-semibold text-red-600">-{formatMoney(summary.expenses)}</span>
                    </div>
                    <div className="pt-2 border-t">
                      <span className="text-xs text-muted-foreground">
                        {summary.transactionCount} transacciones
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <div className="mt-auto">
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Dashboard;