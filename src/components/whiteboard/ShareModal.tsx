import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Copy, Mail, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useEffect } from "react";
import { boardApi } from "@/lib/api";
import { ErrorHandler } from "@/lib/errorHandler";
import { useToast } from "@/components/ui/use-toast";
import { inviteCollaboratorSchema } from "@/lib/validation";
import { validateAndToast } from "@/lib/validationUtils";
import { Spinner, RetryButton, LoadingOverlay } from "@/components/ui/loading";

interface ShareModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  boardTitle?: string;
  boardId?: string;
}

interface Collaborator {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  permission: "view" | "edit";
}

const ShareModal = ({
  open = true,
  onOpenChange,
  boardTitle = "Untitled Board",
  boardId = "123456",
}: ShareModalProps) => {
  const [permission, setPermission] = useState<"view" | "edit">("view");
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [updatePermissionError, setUpdatePermissionError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const { toast } = useToast();
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState<string | null>(null);
  const [selectedPermission, setSelectedPermission] = useState<"view" | "edit" | null>(null);

  // Helper to map Supabase collaborator to Collaborator
  function mapSupabaseCollaborator(c: any): Collaborator {
    return {
      id: c.user?.id || c.id || "",
      name: c.user?.name || c.name || "Unknown",
      email: c.user?.email || c.email || "",
      avatarUrl: c.user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.user?.name || c.name || "user"}`,
      permission: c.permission === "edit" ? "edit" : "view",
    };
  }
  // Fetch collaborators on mount/boardId change
  useEffect(() => {
    const fetchCollaborators = async () => {
      setLoading(true);
      try {
        const board = await boardApi.getBoard(boardId);
        const collaboratorsArray = (board && Array.isArray((board as any).collaborators)) ? (board as any).collaborators : [];
        setCollaborators(collaboratorsArray.map(mapSupabaseCollaborator));
        setError(null);
      } catch (error) {
        const appError = ErrorHandler.createError(error, "Fetching collaborators");
        ErrorHandler.logError(appError, "Fetching collaborators");
        toast(ErrorHandler.getToastConfig(appError));
        setError(appError.message);
      } finally {
        setLoading(false);
      }
    };
    if (boardId) fetchCollaborators();
  }, [boardId, toast]);

  const shareLink = `https://example.com/board/${boardId}?access=${permission}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Invite collaborator
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email && boardId) {
      setLoading(true);
      setInviteError(null);
      try {
        // Validate invite data
        const inviteData = {
          boardId,
          email,
          permission,
        };
        const validated = validateAndToast(inviteCollaboratorSchema, inviteData, "Invite");
        if (!validated) {
          setLoading(false);
          return;
        }

        await boardApi.addCollaborator(validated.boardId, validated.email, validated.permission);
        
        // Refetch collaborators
        const board = await boardApi.getBoard(boardId);
        const collaboratorsArray = (board && Array.isArray((board as any).collaborators)) ? (board as any).collaborators : [];
        setCollaborators(collaboratorsArray.map(mapSupabaseCollaborator));
        setEmail("");
        
        toast({
          title: "Invitation sent",
          description: `Invitation sent to ${validated.email}`,
        });
      } catch (error) {
        const appError = ErrorHandler.createError(error, "Inviting collaborator");
        ErrorHandler.logError(appError, "Inviting collaborator");
        toast(ErrorHandler.getToastConfig(appError));
        setInviteError(appError.message);
      } finally {
        setLoading(false);
      }
    }
  };
  // Update collaborator permission
  const updateCollaboratorPermission = async (
    id: string,
    newPermission: "view" | "edit",
  ) => {
    if (boardId) {
      setLoading(true);
      setUpdatePermissionError(null);
      setSelectedCollaboratorId(id);
      setSelectedPermission(newPermission);
      try {
        await boardApi.updateCollaboratorPermission(boardId, id, newPermission);
        // Refetch collaborators
        const board = await boardApi.getBoard(boardId);
        const collaboratorsArray = (board && Array.isArray((board as any).collaborators)) ? (board as any).collaborators : [];
        setCollaborators(collaboratorsArray.map(mapSupabaseCollaborator));
        
        toast({
          title: "Permission updated",
          description: `Permission updated to ${newPermission}`,
        });
      } catch (error) {
        const appError = ErrorHandler.createError(error, "Updating collaborator permission");
        ErrorHandler.logError(appError, "Updating collaborator permission");
        toast(ErrorHandler.getToastConfig(appError));
        setUpdatePermissionError(appError.message);
      } finally {
        setLoading(false);
      }
    }
  };
  // Remove collaborator
  const removeCollaborator = async (id: string) => {
    if (boardId) {
      setLoading(true);
      setRemoveError(null);
      setSelectedCollaboratorId(id);
      setSelectedPermission(null); // No permission to revert to
      try {
        await boardApi.removeCollaborator(boardId, id);
        // Refetch collaborators
        const board = await boardApi.getBoard(boardId);
        const collaboratorsArray = (board && Array.isArray((board as any).collaborators)) ? (board as any).collaborators : [];
        setCollaborators(collaboratorsArray.map(mapSupabaseCollaborator));
        
        toast({
          title: "Collaborator removed",
          description: "Collaborator has been removed from the board",
        });
      } catch (error) {
        const appError = ErrorHandler.createError(error, "Removing collaborator");
        ErrorHandler.logError(appError, "Removing collaborator");
        toast(ErrorHandler.getToastConfig(appError));
        setRemoveError(appError.message);
      } finally {
        setLoading(false);
      }
    }
  };

  // Add error state UI
  if (error && !loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RetryButton
          error={error}
          onRetry={() => window.location.reload()}
          isLoading={loading}
        />
      </div>
    );
  }
  // Add loading state UI
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle>Share "{boardTitle}"</DialogTitle>
          <DialogDescription>
            Invite others to collaborate on this whiteboard.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col space-y-4">
          <div className="flex flex-col space-y-2">
            <Label htmlFor="link-permission">Permission</Label>
            <RadioGroup
              id="link-permission"
              value={permission}
              onValueChange={(value) => setPermission(value as "view" | "edit")}
              className="flex flex-col space-y-1"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="view" id="view" />
                <Label htmlFor="view">Can view</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="edit" id="edit" />
                <Label htmlFor="edit">Can edit</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex flex-col space-y-2">
            <Label htmlFor="share-link">Share link</Label>
            <div className="flex space-x-2">
              <Input
                id="share-link"
                value={shareLink}
                readOnly
                className="flex-1"
              />
              <Button
                type="button"
                size="icon"
                onClick={handleCopyLink}
                className="flex-shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <form onSubmit={handleInvite} className="flex flex-col space-y-2">
            <Label htmlFor="email-invite">Invite by email</Label>
            <div className="flex space-x-2">
              <Input
                id="email-invite"
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" size="icon" className="flex-shrink-0">
                <Mail className="h-4 w-4" />
              </Button>
            </div>
          </form>

          {collaborators.length > 0 && (
            <>
              <Separator />
              <div className="flex flex-col space-y-2">
                <Label>People with access</Label>
                <div className="flex flex-col space-y-2">
                  {collaborators.map((collaborator) => (
                    <div
                      key={collaborator.id}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2">
                        <Avatar>
                          <AvatarImage src={collaborator.avatarUrl} />
                          <AvatarFallback>
                            {collaborator.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">
                            {collaborator.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {collaborator.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant={
                            collaborator.permission === "edit"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {collaborator.permission === "edit"
                            ? "Editor"
                            : "Viewer"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newPermission =
                              collaborator.permission === "edit"
                                ? "view"
                                : "edit";
                            updateCollaboratorPermission(
                              collaborator.id,
                              newPermission,
                            );
                          }}
                        >
                          {collaborator.permission === "edit"
                            ? "Make viewer"
                            : "Make editor"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCollaborator(collaborator.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="sm:justify-start">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange?.(false)}
          >
            Done
          </Button>
        </DialogFooter>
        <LoadingOverlay isVisible={loading} message="Processing..." />
        {/* Error overlays for async actions */}
        {inviteError && (
          <div className="fixed top-4 right-4 z-50">
            <RetryButton
              error={inviteError}
              onRetry={() => handleInvite({ preventDefault: () => {} } as React.FormEvent)}
              isLoading={loading}
            />
          </div>
        )}
        {updatePermissionError && selectedCollaboratorId && selectedPermission && (
          <div className="fixed top-4 right-4 z-50">
            <RetryButton
              error={updatePermissionError}
              onRetry={() => updateCollaboratorPermission(selectedCollaboratorId, selectedPermission)}
              isLoading={loading}
            />
          </div>
        )}
        {removeError && selectedCollaboratorId && (
          <div className="fixed top-4 right-4 z-50">
            <RetryButton
              error={removeError}
              onRetry={() => removeCollaborator(selectedCollaboratorId)}
              isLoading={loading}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ShareModal;
