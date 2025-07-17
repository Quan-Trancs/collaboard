import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Calendar, Users, MoreVertical, LogOut, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { boardApi } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { ErrorHandler, handleAsyncError } from "@/lib/errorHandler";

interface Board {
  id: string;
  title: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  collaborators: number;
  isShared: boolean;
  thumbnail?: string;
}

interface BoardsListProps {
  user?: { id: string; email: string; name: string };
  onCreateBoard?: () => void;
  onOpenBoard?: (boardId: string) => void;
  onLogout?: () => void;
}

const BoardsList = ({
  user = { id: "1", email: "user@example.com", name: "John Doe" },
  onCreateBoard,
  onOpenBoard,
  onLogout,
}: BoardsListProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch boards from Supabase
  useEffect(() => {
    const fetchBoards = async () => {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await handleAsyncError(
        async () => {
          const supabaseBoards = await boardApi.getBoards();
          // Map Supabase boards to local Board type
          return (supabaseBoards || []).map((b: any) => ({
            id: b.id,
            title: b.title,
            description: b.description,
            createdAt: b.created_at ? new Date(b.created_at) : new Date(),
            updatedAt: b.updated_at ? new Date(b.updated_at) : new Date(),
            collaborators: b.collaborators ? b.collaborators.length : 1,
            isShared: b.is_public || (b.collaborators && b.collaborators.length > 0),
            thumbnail: b.thumbnail_url,
          }));
        },
        "BoardsList.fetchBoards"
      );

      if (fetchError) {
        setError(fetchError.message);
        toast(ErrorHandler.getToastConfig(fetchError));
      } else if (data) {
        setBoards(data);
      }

      setLoading(false);
    };
    fetchBoards();
  }, []);

  const filteredBoards = boards.filter(
    (board) =>
      board.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      board.description?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Create board using Supabase
  const handleCreateBoard = async () => {
    const { data, error: createError } = await handleAsyncError(
      async () => {
        const newBoard = await boardApi.createBoard({
          title: "Untitled Board",
          description: "New whiteboard",
        });

        // Refetch boards after creation
        const supabaseBoards = await boardApi.getBoards();
        return (supabaseBoards || []).map((b: any) => ({
          id: b.id,
          title: b.title,
          description: b.description,
          createdAt: b.created_at ? new Date(b.created_at) : new Date(),
          updatedAt: b.updated_at ? new Date(b.updated_at) : new Date(),
          collaborators: b.collaborators ? b.collaborators.length : 1,
          isShared: b.is_public || (b.collaborators && b.collaborators.length > 0),
          thumbnail: b.thumbnail_url,
        }));
      },
      "BoardsList.createBoard"
    );

    if (createError) {
      toast(ErrorHandler.getToastConfig(createError));
    } else if (data) {
      setBoards(data);
      toast({
        title: "Board created!",
        description: "A new board has been added to your dashboard.",
      });
      onCreateBoard?.();
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Add error state UI
  if (error && !loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Failed to load boards
          </h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Welcome back, {user.name}!
              </h1>
              <p className="text-gray-600 mt-1">
                Manage your whiteboards and collaborate with your team
              </p>
            </div>
            <Button
              onClick={handleCreateBoard}
              className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Create new board"
            >
              <Plus className="h-4 w-4" />
              New Board
            </Button>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search boards..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Search boards"
            />
          </div>
        </div>

        {/* Stats */}
        <section aria-label="Board statistics" className="mb-8">
          <h2 className="sr-only">Board statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Total Boards
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {boards.length}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Plus className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Shared Boards
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {boards.filter((b) => b.isShared).length}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Users className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Collaborators
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {boards.reduce((sum, b) => sum + b.collaborators, 0)}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Users className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Boards Grid */}
        <section aria-label="Boards list">
          <h2 className="sr-only">Boards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredBoards.map((board) => (
              <Card
                key={board.id}
                className="bg-white hover:shadow-lg transition-shadow cursor-pointer group focus-within:ring-2 focus-within:ring-blue-500"
                tabIndex={0}
                role="button"
                aria-label={`Open board: ${board.title}`}
                onClick={() => onOpenBoard?.(board.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onOpenBoard?.(board.id);
                  }
                }}
              >
                <div className="relative">
                  {/* Thumbnail */}
                  <div className="aspect-video bg-gray-100 rounded-t-lg overflow-hidden">
                    {board.thumbnail ? (
                      <img
                        src={board.thumbnail}
                        alt={board.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                        <Plus className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 truncate flex-1">
                        {board.title}
                      </h3>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            aria-label="Board options"
                            tabIndex={0}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>More options</TooltipContent>
                      </Tooltip>
                    </div>

                    {board.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {board.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(board.updatedAt)}
                      </div>

                      <div className="flex items-center gap-2">
                        {board.isShared && (
                          <Badge variant="secondary" className="text-xs">
                            <Users className="h-3 w-3 mr-1" />
                            {board.collaborators}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </div>
              </Card>
            ))}

            {/* Create New Board Card */}
            <Card
              className="bg-white border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors cursor-pointer group focus-within:ring-2 focus-within:ring-blue-500"
              tabIndex={0}
              role="button"
              aria-label="Create new board"
              onClick={handleCreateBoard}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleCreateBoard();
                }
              }}
            >
              <CardContent className="p-6 flex flex-col items-center justify-center h-full min-h-[200px]">
                <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-gray-200 transition-colors">
                  <Plus className="h-6 w-6 text-gray-400" />
                </div>
                <h3 className="font-medium text-gray-900 mb-1">
                  Create New Board
                </h3>
                <p className="text-sm text-gray-500 text-center">
                  Start a new whiteboard for your next project
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {filteredBoards.length === 0 && searchTerm && (
          <div className="text-center py-12">
            <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No boards found
            </h3>
            <p className="text-gray-500">
              Try adjusting your search terms or create a new board.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BoardsList;
