import { useEffect, useMemo, useState } from "react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Copy, Mail, Check } from "lucide-react";
import { boardApi } from "@/lib/api";
import { ErrorHandler } from "@/lib/errorHandler";
import { useToast } from "@/components/ui/use-toast";
import type { Collaborator } from "@/types";

interface ShareModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  boardTitle?: string;
  boardId?: string;
  currentUser?: { id: string; name: string; email: string };
  onShareChange?: (info?: { owner: Collaborator | null; collaborators: Collaborator[] }) => void;
}

function personAvatar(person: Collaborator) {
  return person.avatarUrl || person.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${person.name}`;
}

function permissionLabel(permission: Collaborator["permission"]) {
  if (permission === "owner") return "Owner";
  if (permission === "admin") return "Admin";
  if (permission === "edit") return "Editor";
  return "Viewer";
}

export default function ShareModal({
  open = false,
  onOpenChange,
  boardTitle = "Untitled Board",
  boardId,
  currentUser,
  onShareChange,
}: ShareModalProps) {
  const [invitePermission, setInvitePermission] = useState<"view" | "edit">("edit");
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [owner, setOwner] = useState<Collaborator | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const shareLink = useMemo(() => {
    if (!boardId || typeof window === "undefined") return "";
    return `${window.location.origin}/?boardId=${boardId}`;
  }, [boardId]);

  const applyInfo = (info: {
    owner: Collaborator | null;
    collaborators: Collaborator[];
    is_public?: boolean;
    can_manage?: boolean;
  }) => {
    setOwner(info.owner);
    setCollaborators(info.collaborators || []);
    if (typeof info.is_public === "boolean") setIsPublic(info.is_public);
    if (typeof info.can_manage === "boolean") setCanManage(info.can_manage);
    onShareChange?.(info);
  };

  const loadShare = async () => {
    if (!boardId) return;
    setLoading(true);
    try {
      const info = await boardApi.getCollaborators(boardId);
      applyInfo(info);
    } catch {
      try {
        const board = await boardApi.getBoard(boardId);
        applyInfo({
          owner: board.owner || (currentUser
            ? { id: currentUser.id, name: currentUser.name, email: currentUser.email, permission: "owner" }
            : null),
          collaborators: board.collaborators || [],
          is_public: board.is_public,
          can_manage: board.permission === "owner" || board.permission === "admin",
        });
      } catch (error) {
        if (currentUser) {
          setOwner({ id: currentUser.id, name: currentUser.name, email: currentUser.email, permission: "owner" });
        }
        toast(ErrorHandler.getToastConfig(ErrorHandler.createError(error, "Loading sharing")));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && boardId) {
      loadShare();
    }
  }, [open, boardId]);

  const handleCopyLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link copied", description: "Anyone you invite, or anyone with the link if the board is public, can open it." });
    } catch {
      toast({ title: "Could not copy", description: shareLink, variant: "destructive" });
    }
  };

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!boardId || !email.trim() || !canManage) return;
    setSaving(true);
    try {
      const person = await boardApi.addCollaborator(boardId, email.trim(), invitePermission);
      const next = [...collaborators.filter((item) => item.id !== person.id), person];
      setCollaborators(next);
      setEmail("");
      onShareChange?.({ owner, collaborators: next });
      toast({ title: "Access granted", description: `${person.email} can now open this board.` });
    } catch (error) {
      toast(ErrorHandler.getToastConfig(ErrorHandler.createError(error, "Inviting collaborator")));
    } finally {
      setSaving(false);
    }
  };

  const handlePermission = async (id: string, permission: "view" | "edit") => {
    if (!boardId || !canManage) return;
    setSaving(true);
    try {
      const person = await boardApi.updateCollaboratorPermission(boardId, id, permission);
      const next = collaborators.map((item) => (item.id === id ? person : item));
      setCollaborators(next);
      onShareChange?.({ owner, collaborators: next });
      toast({ title: "Permission updated", description: `${person.name} is now a ${permissionLabel(permission).toLowerCase()}.` });
    } catch (error) {
      toast(ErrorHandler.getToastConfig(ErrorHandler.createError(error, "Updating permission")));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (!boardId || !canManage) return;
    setSaving(true);
    try {
      await boardApi.removeCollaborator(boardId, id);
      const next = collaborators.filter((item) => item.id !== id);
      setCollaborators(next);
      onShareChange?.({ owner, collaborators: next });
      toast({ title: "Access removed", description: "They will no longer see this board in Shared." });
    } catch (error) {
      toast(ErrorHandler.getToastConfig(ErrorHandler.createError(error, "Removing collaborator")));
    } finally {
      setSaving(false);
    }
  };

  const handlePublic = async (next: boolean) => {
    if (!boardId || !canManage) return;
    const previous = isPublic;
    setIsPublic(next);
    setSaving(true);
    try {
      await boardApi.updateBoard(boardId, { is_public: next });
      onShareChange?.();
      toast({
        title: next ? "Link sharing on" : "Link sharing off",
        description: next
          ? "Anyone signed in with this link can view the board."
          : "Only invited people can open the board.",
      });
    } catch (error) {
      setIsPublic(previous);
      toast(ErrorHandler.getToastConfig(ErrorHandler.createError(error, "Updating link sharing")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-white max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share "{boardTitle}"</DialogTitle>
          <DialogDescription>
            Invite people who already have a Collaboard account, or turn on a view link.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col space-y-4">
          <div className="flex flex-col space-y-2" aria-label="Collaborator list">
            <Label>People with access</Label>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading people…</p>
            ) : (
              <div className="flex flex-col space-y-3 rounded-md border border-gray-200 p-3 max-h-64 overflow-y-auto">
                {owner && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Avatar>
                        <AvatarImage src={personAvatar(owner)} />
                        <AvatarFallback>{owner.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{owner.name}</p>
                        <p className="text-xs text-muted-foreground">{owner.email}</p>
                      </div>
                    </div>
                    <Badge variant="secondary">Owner</Badge>
                  </div>
                )}
                {collaborators.map((person) => (
                  <div key={person.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 min-w-0">
                      <Avatar>
                        <AvatarImage src={personAvatar(person)} />
                        <AvatarFallback>{person.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{person.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{person.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant={person.permission === "view" ? "secondary" : "default"}>
                        {permissionLabel(person.permission)}
                      </Badge>
                      {canManage && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={saving}
                            onClick={() => handlePermission(person.id, person.permission === "edit" ? "view" : "edit")}
                          >
                            {person.permission === "edit" ? "Make viewer" : "Make editor"}
                          </Button>
                          <Button variant="ghost" size="sm" disabled={saving} onClick={() => handleRemove(person.id)}>
                            Remove
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {!loading && !owner && collaborators.length === 0 && (
                  <p className="text-sm text-muted-foreground">No people loaded yet.</p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md border border-gray-200 p-3">
            <div>
              <Label htmlFor="public-link">Anyone with the link</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Signed-in users can view. They cannot edit unless you invite them.
              </p>
            </div>
            <Switch
              id="public-link"
              checked={isPublic}
              disabled={!canManage || saving || loading}
              onCheckedChange={handlePublic}
              aria-label="Anyone with the link can view"
            />
          </div>

          <div className="flex flex-col space-y-2">
            <Label htmlFor="share-link">Board link</Label>
            <div className="flex space-x-2">
              <Input id="share-link" value={shareLink} readOnly className="flex-1" />
              <Button type="button" size="icon" onClick={handleCopyLink} aria-label="Copy board link">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {canManage && (
            <form onSubmit={handleInvite} className="flex flex-col space-y-2">
              <Label htmlFor="email-invite">Invite by email</Label>
              <RadioGroup
                value={invitePermission}
                onValueChange={(value) => setInvitePermission(value as "view" | "edit")}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="view" id="invite-view" />
                  <Label htmlFor="invite-view">Can view</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="edit" id="invite-edit" />
                  <Label htmlFor="invite-edit">Can edit</Label>
                </div>
              </RadioGroup>
              <div className="flex space-x-2">
                <Input
                  id="email-invite"
                  type="email"
                  placeholder="teammate@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="flex-1"
                  required
                />
                <Button type="submit" disabled={saving || !email.trim()} aria-label="Send invite">
                  <Mail className="h-4 w-4" />
                </Button>
              </div>
            </form>
          )}

        </div>

        <DialogFooter className="sm:justify-start">
          <Button type="button" variant="secondary" onClick={() => onOpenChange?.(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
