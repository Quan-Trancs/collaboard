import React, { useState, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Whiteboard, BoardsList, AuthForm } from "@/components/LazyComponents";

type AppState = "auth" | "dashboard" | "whiteboard";

function Home() {
  const { user, profile, loading, signOut } = useAuth();
  
  // Get boardId from URL on initial load
  const getBoardIdFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('boardId') || params.get('board');
  };
  
  const [currentState, setCurrentState] = useState<AppState>(() => {
    // If there's a boardId in URL, start in whiteboard state
    const urlBoardId = getBoardIdFromUrl();
    return urlBoardId ? "whiteboard" : "auth";
  });
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(() => {
    // Initialize with boardId from URL if present
    return getBoardIdFromUrl();
  });
  const [configError, setConfigError] = useState<string | null>(null);

  // Update state based on authentication
  React.useEffect(() => {
    if (loading) {
      return;
    }
    
    if (user) {
      // Check if there's a boardId in URL - if so, go to whiteboard
      const urlBoardId = getBoardIdFromUrl();
      if (urlBoardId) {
        setCurrentBoardId(urlBoardId);
        setCurrentState("whiteboard");
      } else {
        // If user exists but no board in URL, navigate to dashboard
        setCurrentState("dashboard");
      }
    } else {
      setCurrentState("auth");
      // Clear URL if user is not logged in
      if (getBoardIdFromUrl()) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [user, loading]);

  // Update URL when navigating to board
  const updateUrlForBoard = (boardId: string | null) => {
    if (boardId) {
      const newUrl = `${window.location.pathname}?boardId=${boardId}`;
      window.history.pushState({ boardId }, '', newUrl);
    } else {
      window.history.pushState({}, '', window.location.pathname);
    }
  };

  const handleCreateBoard = (boardId?: string) => {
    if (boardId) {
      setCurrentBoardId(boardId);
      setCurrentState("whiteboard");
      updateUrlForBoard(boardId);
    } else {
      // Fallback: create board first, then navigate
      const newBoardId = Math.random().toString(36).substr(2, 9);
      setCurrentState("whiteboard");
      setCurrentBoardId(newBoardId);
      updateUrlForBoard(newBoardId);
    }
  };

  const handleOpenBoard = (boardId: string) => {
    setCurrentBoardId(boardId);
    setCurrentState("whiteboard");
    updateUrlForBoard(boardId);
  };

  const handleBackToDashboard = () => {
    setCurrentState("dashboard");
    setCurrentBoardId(null);
    updateUrlForBoard(null);
  };
  
  // Handle browser back/forward buttons
  React.useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const urlBoardId = getBoardIdFromUrl();
      if (urlBoardId && user) {
        setCurrentBoardId(urlBoardId);
        setCurrentState("whiteboard");
      } else if (user) {
        setCurrentBoardId(null);
        setCurrentState("dashboard");
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut();
      setCurrentState("auth");
      setCurrentBoardId(null);
    } catch (error) {
      // Logout error handled silently
    }
  };


  if (loading) {
    return (
      <div className="w-screen h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-md text-center px-4">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="font-medium">Initializing application...</span>
        </div>
      </div>
    );
  }

  const LoadingFallback = () => (
    <div className="w-screen h-screen bg-white flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="font-medium">Loading...</span>
      </div>
    </div>
  );

  return (
    <ErrorBoundary>
      <div className="w-screen h-screen bg-white">
        {currentState === "auth" && (
          <Suspense fallback={<LoadingFallback />}>
            <AuthForm />
          </Suspense>
        )}

        {currentState === "dashboard" && user && (
          <Suspense fallback={<LoadingFallback />}>
            <BoardsList
              user={{ id: user.id, email: user.email!, name: profile?.name || user.email!.split('@')[0] }}
              onCreateBoard={handleCreateBoard}
              onOpenBoard={handleOpenBoard}
              onLogout={handleLogout}
            />
          </Suspense>
        )}

        {currentState === "whiteboard" && user && currentBoardId && (
          <Suspense fallback={<LoadingFallback />}>
            <Whiteboard
              boardId={currentBoardId}
              user={{ id: user.id, email: user.email!, name: profile?.name || user.email!.split('@')[0] }}
              onBackToDashboard={handleBackToDashboard}
              onLogout={handleLogout}
            />
          </Suspense>
        )}

        <Toaster />
      </div>
    </ErrorBoundary>
  );
}

export default Home;
