import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Calendar, Users, MoreVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";

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
}

const BoardsList = ({
  user = { id: "1", email: "user@example.com", name: "John Doe" },
  onCreateBoard,
  onOpenBoard,
}: BoardsListProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [boards, setBoards] = useState<Board[]>([
    {
      id: "1",
      title: "Project Planning",
      description: "Initial brainstorming and project roadmap",
      createdAt: new Date(2024, 0, 15),
      updatedAt: new Date(2024, 0, 20),
      collaborators: 3,
      isShared: true,
      thumbnail:
        "https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=400&q=80",
    },
    {
      id: "2",
      title: "Design System",
      description: "UI components and design guidelines",
      createdAt: new Date(2024, 0, 10),
      updatedAt: new Date(2024, 0, 18),
      collaborators: 2,
      isShared: true,
      thumbnail:
        "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=400&q=80",
    },
    {
      id: "3",
      title: "Personal Notes",
      description: "Quick sketches and ideas",
      createdAt: new Date(2024, 0, 5),
      updatedAt: new Date(2024, 0, 16),
      collaborators: 1,
      isShared: false,
      thumbnail:
        "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&q=80",
    },
  ]);
  const { toast } = useToast();

  const filteredBoards = boards.filter(
    (board) =>
      board.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      board.description?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleCreateBoard = () => {
    const newBoard: Board = {
      id: Math.random().toString(36).substr(2, 9),
      title: "Untitled Board",
      description: "New whiteboard",
      createdAt: new Date(),
      updatedAt: new Date(),
      collaborators: 1,
      isShared: false,
    };
    setBoards([newBoard, ...boards]);
    toast({
      title: "Board created!",
      description: `A new board has been added to your dashboard.`,
    });
    onCreateBoard?.();
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

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
