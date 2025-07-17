import React from "react";
import { Button } from "./button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "./alert";

interface RetryProps {
  error: string;
  onRetry: () => void;
  isLoading?: boolean;
}

export const RetryButton: React.FC<RetryProps> = ({ error, onRetry, isLoading = false }) => {
  return (
    <Alert className="border-red-200 bg-red-50">
      <div className="flex items-center">
        <AlertTriangle className="h-4 w-4 text-red-600 mr-2" />
        <AlertDescription className="text-red-800 flex-1">
          {error}
        </AlertDescription>
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={isLoading}
          className="ml-2 border-red-300 text-red-700 hover:bg-red-100"
        >
          {isLoading ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-1">Retry</span>
        </Button>
      </div>
    </Alert>
  );
}; 