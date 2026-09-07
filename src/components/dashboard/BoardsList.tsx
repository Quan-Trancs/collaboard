/**
 * Boards List Component
 * Optimized with React.memo and better error handling
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FolderKanban, LogOut, Loader2, Plus, Search, Trash2, Users } from 'lucide-react';
import { boardApi } from '@/lib/api';
import { ErrorHandler, handleAsyncError } from '@/lib/errorHandler';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { BoardPermission } from '@/types';

interface BoardsListProps {
  user: { id: string; email: string; name: string };
  onCreateBoard: (boardId?: string) => void;
  onOpenBoard: (boardId: string) => void;
  onLogout: () => void;
}

interface LocalBoard {
  id: string;
  title: string;
  description?: string;
  owner_id: string;
  thumbnail_url?: string;
  is_public: boolean;
  permission?: BoardPermission;
  created_at: string;
  updated_at: string;
}

function permissionLabel(permission?: BoardPermission) {
  if (permission === 'admin') return 'Admin';
  if (permission === 'edit') return 'Can edit';
  return 'Can view';
}

const BoardCard = React.memo<{
  board: LocalBoard;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  isOwner: boolean;
}>(({ board, onOpen, onDelete, isOwner }) => {
  const handleClick = useCallback(() => {
    onOpen(board.id);
  }, [board.id, onOpen]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    onDelete(board.id);
  }, [board.id, onDelete]);

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-shadow relative"
      onClick={handleClick}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg pr-8">{board.title}</CardTitle>
          <div className="flex items-center gap-2">
            {isOwner ? (
              <Badge variant="secondary">Owned</Badge>
            ) : (
              <Badge variant="outline">{permissionLabel(board.permission)}</Badge>
            )}
            {board.is_public && <Badge variant="outline">Public</Badge>}
            {isOwner && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={handleDelete}
                aria-label={`Delete ${board.title}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        {board.description && (
          <CardDescription className="mt-2">{board.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500">
          Updated {new Date(board.updated_at).toLocaleDateString()}
        </p>
      </CardContent>
    </Card>
  );
});

BoardCard.displayName = 'BoardCard';

const BoardSection = ({
  title,
  count,
  icon: Icon,
  emptyText,
  boards,
  onOpen,
  onDelete,
  isOwner,
}: {
  title: string;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
  emptyText: string;
  boards: LocalBoard[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  isOwner: boolean;
}) => (
  <section aria-label={title} className="mb-8">
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-5 w-5 text-gray-600" />
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <Badge variant="secondary">{count}</Badge>
    </div>
    {boards.length === 0 ? (
      <p className="text-sm text-gray-500 py-6">{emptyText}</p>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {boards.map((board) => (
          <BoardCard
            key={board.id}
            board={board}
            onOpen={onOpen}
            onDelete={onDelete}
            isOwner={isOwner}
          />
        ))}
      </div>
    )}
  </section>
);

const BoardsList: React.FC<BoardsListProps> = ({
  user,
  onCreateBoard,
  onOpenBoard,
  onLogout,
}) => {
  const [boards, setBoards] = useState<LocalBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [boardToDelete, setBoardToDelete] = useState<LocalBoard | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const { user: authUser } = useAuth();

  const fetchBoards = useCallback(async () => {
    setLoading(true);
    try {
      const fetchedBoards = await boardApi.getBoards();
      setBoards(fetchedBoards as LocalBoard[]);
    } catch (error) {
      setBoards([]);
      handleAsyncError(() => Promise.reject(error), 'BoardsList.fetchBoards');
      toast({
        title: 'Error',
        description: 'Failed to load boards. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setBoards([]);
    fetchBoards();
  }, [user.id, fetchBoards]);

  const handleCreateBoard = useCallback(async () => {
    if (isCreating) return;
    
    // Check if user is authenticated
    if (!authUser) {
      toast({
        title: 'Authentication Required',
        description: 'Please log in to create a board.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsCreating(true);
    try {
      const result = await handleAsyncError(
        async () => {
          const board = await boardApi.createBoard({
            title: 'Untitled Board',
            description: '',
            is_public: false,
          });
          return board;
        },
        'BoardsList.createBoard'
      );

      if (result?.data) {
        setBoards((prev) => {
          if (prev.some((board) => board.id === result.data!.id)) return prev;
          return [result.data as LocalBoard, ...prev];
        });
        onCreateBoard(result.data.id);
      } else if (result?.error) {
        // Show error toast with specific message
        const errorMessage = result.error.message || 'Failed to create board. Please try again.';
        toast({
          title: result.error.code === 'NO_TOKEN' ? 'Authentication Required' : 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
        
        // If no token, user needs to log in - could redirect here if needed
        if (result.error.code === 'NO_TOKEN') {
          // Optionally redirect to login or refresh auth
          // User needs to log in
        }
      }
    } catch (error) {
      const appError = ErrorHandler.createError(error, 'BoardsList.createBoard');
      toast({
        title: 'Error',
        description: appError.message || 'Failed to create board. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  }, [isCreating, onCreateBoard, fetchBoards, toast, authUser]);

  const isOwner = useCallback(
    (board: LocalBoard) => board.permission === 'owner' || board.owner_id === user.id,
    [user.id]
  );

  const filteredBoards = useMemo(() => {
    if (!searchQuery.trim()) return boards;
    const query = searchQuery.toLowerCase();
    return boards.filter(
      (board) =>
        board.title.toLowerCase().includes(query) ||
        board.description?.toLowerCase().includes(query)
    );
  }, [boards, searchQuery]);

  const ownedBoards = useMemo(
    () => filteredBoards.filter((board) => isOwner(board)),
    [filteredBoards, isOwner]
  );
  const sharedBoards = useMemo(
    () => filteredBoards.filter((board) => !isOwner(board)),
    [filteredBoards, isOwner]
  );

  const handleDeleteClick = useCallback((boardId: string) => {
    const board = boards.find(b => b.id === boardId);
    if (board) {
      setBoardToDelete(board);
    }
  }, [boards]);

  const handleConfirmDelete = useCallback(async () => {
    if (!boardToDelete || isDeleting) return;

    setIsDeleting(true);
    try {
      await boardApi.deleteBoard(boardToDelete.id);
      
      // Remove board from local state
      setBoards(prev => prev.filter(b => b.id !== boardToDelete.id));
      
      toast({
        title: 'Board deleted',
        description: `"${boardToDelete.title}" has been deleted successfully.`,
      });
      
      setBoardToDelete(null);
    } catch (error) {
      handleAsyncError(() => Promise.reject(error), 'BoardsList.deleteBoard');
      toast({
        title: 'Error',
        description: 'Failed to delete board. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  }, [boardToDelete, isDeleting, toast]);

  if (loading) {
    return (
      <div className="w-screen h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="text-lg font-medium">Loading your boards...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Boards</h1>
            <p className="text-sm text-gray-600 mt-1">Welcome back, {user.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleCreateBoard} disabled={isCreating}>
              <Plus className="h-4 w-4 mr-2" />
              {isCreating ? 'Creating...' : 'New Board'}
            </Button>
            <Button variant="outline" onClick={onLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Search */}
      <div className="px-6 py-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search boards..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {filteredBoards.length === 0 && boards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-lg text-gray-600 mb-4">You don't have any boards yet.</p>
            <Button onClick={handleCreateBoard} disabled={isCreating}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Board
            </Button>
          </div>
        ) : filteredBoards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-lg text-gray-600">No boards found matching your search.</p>
          </div>
        ) : (
          <>
            <BoardSection
              title="Owned"
              count={ownedBoards.length}
              icon={FolderKanban}
              emptyText={searchQuery ? 'No owned boards match this search.' : "You don't own any boards yet."}
              boards={ownedBoards}
              onOpen={onOpenBoard}
              onDelete={handleDeleteClick}
              isOwner
            />
            <BoardSection
              title="Shared"
              count={sharedBoards.length}
              icon={Users}
              emptyText={searchQuery ? 'No shared boards match this search.' : 'No boards have been shared with you.'}
              boards={sharedBoards}
              onOpen={onOpenBoard}
              onDelete={handleDeleteClick}
              isOwner={false}
            />
          </>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!boardToDelete} onOpenChange={(open) => !open && setBoardToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Board</DialogTitle>
          </DialogHeader>
          <p>
            Are you sure you want to delete <strong>"{boardToDelete?.title}"</strong>? 
            This action cannot be undone and all data will be permanently removed.
          </p>
          <DialogFooter>
            <Button 
              variant="secondary" 
              onClick={() => setBoardToDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Board'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default React.memo(BoardsList);
