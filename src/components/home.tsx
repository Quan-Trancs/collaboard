import React, { useState } from "react";
import AuthForm from "@/components/auth/AuthForm";
import BoardsList from "@/components/dashboard/BoardsList";
import Whiteboard from "@/components/whiteboard/Whiteboard";
import { Toaster } from "@/components/ui/toaster";

interface User {
  id: string;
  email: string;
  name: string;
}

type AppState = "auth" | "dashboard" | "whiteboard";

function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [currentState, setCurrentState] = useState<AppState>("auth");
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);

  const handleAuthSuccess = (userData: User) => {
    setUser(userData);
    setCurrentState("dashboard");
  };

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

  const handleLogout = () => {
    setUser(null);
    setCurrentState("auth");
    setCurrentBoardId(null);
  };

  return (
    <div className="w-screen h-screen bg-white">
      {currentState === "auth" && (
        <AuthForm onAuthSuccess={handleAuthSuccess} />
      )}

      {currentState === "dashboard" && user && (
        <BoardsList
          user={user}
          onCreateBoard={handleCreateBoard}
          onOpenBoard={handleOpenBoard}
        />
      )}

      {currentState === "whiteboard" && user && currentBoardId && (
        <Whiteboard
          boardId={currentBoardId}
          user={user}
          onBackToDashboard={handleBackToDashboard}
          onLogout={handleLogout}
        />
      )}

      <Toaster />
    </div>
  );
}

export default Home;
