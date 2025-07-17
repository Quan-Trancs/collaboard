import React, { useState } from "react";
import AuthForm from "@/components/auth/AuthForm";
import BoardsList from "@/components/dashboard/BoardsList";
import Whiteboard from "@/components/whiteboard/Whiteboard";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

type AppState = "auth" | "dashboard" | "whiteboard";

function Home() {
  const { user, profile, loading, signOut } = useAuth();
  const [currentState, setCurrentState] = useState<AppState>("auth");
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);

  // Update state based on authentication
  React.useEffect(() => {
    if (loading) return;
    
    if (user && profile) {
      setCurrentState("dashboard");
    } else {
      setCurrentState("auth");
    }
  }, [user, profile, loading]);

  const handleCreateBoard = () => {
    setCurrentState("whiteboard");
    setCurrentBoardId(Math.random().toString(36).substr(2, 9));
  };

  const handleOpenBoard = (boardId: string) => {
    setCurrentBoardId(boardId);
    setCurrentState("whiteboard");
  };

  const handleBackToDashboard = () => {
    setCurrentState("dashboard");
    setCurrentBoardId(null);
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setCurrentState("auth");
      setCurrentBoardId(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (loading) {
    return (
      <div className="w-screen h-screen bg-white flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-white">
      {currentState === "auth" && (
        <AuthForm />
      )}

      {currentState === "dashboard" && user && profile && (
        <BoardsList
          user={{ id: user.id, email: user.email!, name: profile.name }}
          onCreateBoard={handleCreateBoard}
          onOpenBoard={handleOpenBoard}
          onLogout={handleLogout}
        />
      )}

      {currentState === "whiteboard" && user && profile && currentBoardId && (
        <Whiteboard
          boardId={currentBoardId}
          user={{ id: user.id, email: user.email!, name: profile.name }}
          onBackToDashboard={handleBackToDashboard}
          onLogout={handleLogout}
        />
      )}

      <Toaster />
    </div>
  );
}

export default Home;
