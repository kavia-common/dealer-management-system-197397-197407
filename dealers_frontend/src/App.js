import React from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppLayout from "./components/AppLayout";

import DealersPage from "./pages/DealersPage";
import StockPage from "./pages/StockPage";
import PayrollCreditsPage from "./pages/PayrollCreditsPage";
import PaymentsPage from "./pages/PaymentsPage";
import FinanceDashboardPage from "./pages/FinanceDashboardPage";

// PUBLIC_INTERFACE
export default function App() {
  const location = useLocation();
  const title = getTitleForPath(location.pathname);

  return (
    <AppLayout title={title}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<FinanceDashboardPage />} />
        <Route path="/dealers" element={<DealersPage />} />
        <Route path="/stock" element={<StockPage />} />
        <Route path="/payroll-credits" element={<PayrollCreditsPage />} />
        <Route path="/payments" element={<PaymentsPage />} />
        <Route
          path="*"
          element={<Navigate to="/dashboard" replace />}
        />
      </Routes>
    </AppLayout>
  );
}

function getTitleForPath(pathname) {
  switch (pathname) {
    case "/dashboard":
      return "Finance Dashboard";
    case "/dealers":
      return "Dealers";
    case "/stock":
      return "Stock";
    case "/payroll-credits":
      return "Payroll / Credits";
    case "/payments":
      return "Payments";
    default:
      return "Dealers Manager";
  }
}
