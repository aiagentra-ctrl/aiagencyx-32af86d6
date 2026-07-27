import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import REPreview from "@/pages/__REPreview";
import { BrowserRouter, Route, Routes, Navigate, useParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AdminDashboard from "./pages/AdminDashboard";
import DemoPage from "./pages/DemoPage";
import ChatbotPage from "./pages/ChatbotPage";
import ApiDocsPage from "./pages/ApiDocsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ChatbotLegacyRedirect = () => {
  const { slug } = useParams();
  return <Navigate to={`/chatbot/${slug}`} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="/__re-preview" element={<REPreview />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/demo/:slug" element={<DemoPage />} />
          <Route path="/chatbot/:slug" element={<ChatbotPage />} />
          <Route path="/api-docs" element={<ApiDocsPage />} />
          <Route path="/:slug/chatbot" element={<ChatbotLegacyRedirect />} />
          <Route path="/:slug" element={<DemoPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
