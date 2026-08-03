import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import DemoPage from "./pages/DemoPage";

// The admin surface is huge and is never needed by a prospect opening a demo link,
// so it stays out of the initial bundle.
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const ChatbotPage = lazy(() => import("./pages/ChatbotPage"));
const ApiDocsPage = lazy(() => import("./pages/ApiDocsPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

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
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Navigate to="/admin" replace />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/demo/:slug" element={<DemoPage />} />
            <Route path="/chatbot/:slug" element={<ChatbotPage />} />
            <Route path="/api-docs" element={<ApiDocsPage />} />
            <Route path="/:slug/chatbot" element={<ChatbotLegacyRedirect />} />
            <Route path="/:slug" element={<DemoPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
