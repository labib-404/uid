import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { SettingsProvider } from "@/hooks/useSettings";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import Import from "./pages/Import";
import Saved from "./pages/Saved";
import SettingsPage from "./pages/SettingsPage";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SettingsProvider>
      <TooltipProvider>
        <Sonner position="bottom-center" />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/" element={<Home />} />
                <Route path="/import" element={<Import />} />
                <Route path="/saved" element={<Saved />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/admin" element={<Admin />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </SettingsProvider>
  </QueryClientProvider>
);

export default App;
