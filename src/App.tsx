import { Suspense, useState, useEffect } from "react";
import { useRoutes, Routes, Route } from "react-router-dom";
import Home from "./components/home";
import { ErrorBoundary } from "./components/ErrorBoundary";

function App() {
  const [tempoRoutes, setTempoRoutes] = useState<ReturnType<typeof useRoutes> | null>(null);

  useEffect(() => {
    if (import.meta.env.VITE_TEMPO === "true") {
      import("tempo-routes")
        .then((routes) => {
          setTempoRoutes(useRoutes(routes.default || routes));
        })
        .catch(() => {
          // Tempo routes not available, ignore
        });
    }
  }, []);

  return (
    <ErrorBoundary>
    <Suspense fallback={<p>Loading...</p>}>
      <>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
          {tempoRoutes}
      </>
    </Suspense>
    </ErrorBoundary>
  );
}

export default App;
