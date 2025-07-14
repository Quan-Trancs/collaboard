import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { BrowserRouter } from "react-router-dom";

import { TempoDevtools } from "tempo-devtools";
TempoDevtools.init();
import { TooltipProvider } from "@/components/ui/tooltip";

const basename = import.meta.env.BASE_URL;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TooltipProvider>
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
    </TooltipProvider>
  </React.StrictMode>,
);
