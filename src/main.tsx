import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Initialize Tempo devtools only if explicitly enabled
if (import.meta.env.VITE_TEMPO === "true") {
  import("tempo-devtools")
    .then(({ TempoDevtools }) => {
      TempoDevtools.init();
    })
    .catch((error) => {
    });
}

const basename = import.meta.env.BASE_URL;

// Suppress specific warnings/errors in development (expected with React StrictMode)
if (import.meta.env.DEV) {
  const originalError = console.error;
  const originalWarn = console.warn;
  
  // Suppress console.error for expected issues
  // Note: React logs warnings as console.error in development mode
  console.error = (...args: any[]) => {
    const errorMessage = args[0]?.toString() || '';
    const fullMessage = args.join(' ') || '';
    
    // Suppress WebSocket errors from socket.io during React StrictMode cleanup
    if (
      errorMessage.includes('WebSocket is closed before the connection is established') ||
      (fullMessage.includes('useSocket.ts') && fullMessage.includes('WebSocket'))
    ) {
      return;
    }
    
    // Suppress Radix UI ref warning (React logs warnings as console.error in dev mode)
    if (
      errorMessage.includes('Function components cannot be given refs') ||
      errorMessage.includes('Did you mean to use React.forwardRef') ||
      fullMessage.includes('Primitive.button.SlotClone') ||
      fullMessage.includes('SlotClone')
    ) {
      return;
    }
    
    originalError.apply(console, args);
  };
  
  // Suppress console.warn for known library issues
  console.warn = (...args: any[]) => {
    const warningMessage = args[0]?.toString() || '';
    const fullMessage = args.join(' ') || '';
    
    // Suppress Radix UI ref warning (known library issue, doesn't affect functionality)
    if (
      warningMessage.includes('Function components cannot be given refs') ||
      warningMessage.includes('Did you mean to use React.forwardRef') ||
      fullMessage.includes('Primitive.button.SlotClone')
    ) {
      return;
    }
    
    originalWarn.apply(console, args);
  };
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <TooltipProvider>
          <BrowserRouter 
            basename={basename}
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <App />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
