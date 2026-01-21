import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { NotificationProvider } from "@/contexts/NotificationContext";
import Index from "./pages/Index";
import Parts from "./pages/Parts";
import ItemsList from "./pages/ItemsList";
import Attributes from "./pages/Attributes";
import Models from "./pages/Models";
import Inventory from "./pages/Inventory";
import Sales from "./pages/Sales";
import Manage from "./pages/Manage";
import PricingCostingPage from "./pages/PricingCosting";
import Reports from "./pages/Reports";
import Expenses from "./pages/Expenses";
import Settings from "./pages/Settings";
import Accounting from "./pages/Accounting";
import FinancialStatements from "./pages/FinancialStatements";
import BalanceSheet from "./pages/BalanceSheet";
import Vouchers from "./pages/Vouchers";
import Store from "./pages/Store";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import AIChatBot from "./components/chatbot/AIChatBot";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <NotificationProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename="/dev-koncepts">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Index />} />
            <Route path="/partentry" element={<Parts />} />
            <Route path="/partentry/itemslist" element={<ItemsList />} />
            <Route path="/partentry/attributes" element={<Attributes />} />
            <Route path="/partentry/models" element={<Models />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/inventory/:tab" element={<Inventory />} />
            <Route path="/pricing-costing" element={<PricingCostingPage />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/sales/:tab" element={<Sales />} />
            <Route path="/manage" element={<Manage />} />
            <Route path="/manage/:tab" element={<Manage />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/accounting" element={<Accounting />} />
            <Route path="/financial-statements" element={<FinancialStatements />} />
            <Route path="/balance-sheet" element={<BalanceSheet />} />
            <Route path="/vouchers" element={<Vouchers />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/:tab" element={<Settings />} />
            <Route path="/store" element={<Store />} />
            <Route path="/store/:tab" element={<Store />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <AIChatBot />
        </BrowserRouter>
      </TooltipProvider>
    </NotificationProvider>
  </QueryClientProvider>
);

export default App;
