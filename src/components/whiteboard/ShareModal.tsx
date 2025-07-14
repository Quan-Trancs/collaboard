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
  const [collaborators, setCollaborators] = useState<Collaborator[]>([
    {
      id: "1",
      name: "Jane Smith",
      email: "jane@example.com",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=jane",
      permission: "edit",
    },
    {
      id: "2",
      name: "John Doe",
      email: "john@example.com",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=john",
      permission: "view",
    },
  ]);

  const shareLink = `https://example.com/board/${boardId}?access=${permission}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      // In a real app, this would send an invitation
      // For now, just add to the collaborators list
      const newCollaborator: Collaborator = {
        id: `${Date.now()}`,
        name: email.split("@")[0],
        email,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
        permission,
      };
      setCollaborators([...collaborators, newCollaborator]);
      setEmail("");
    }
  };

  const updateCollaboratorPermission = (
    id: string,
    newPermission: "view" | "edit",
  ) => {
    setCollaborators(
      collaborators.map((c) =>
        c.id === id ? { ...c, permission: newPermission } : c,
      ),
    );
  };

  const removeCollaborator = (id: string) => {
    setCollaborators(collaborators.filter((c) => c.id !== id));
  };

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
      </DialogContent>
    </Dialog>
  );
};

export default ShareModal;
