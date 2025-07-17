import React from "react";
import { cn } from "@/lib/utils";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "./button";

// Spinner component for inline loading
interface SpinnerProps {
  size?: "sm" | "lg";
  className?: string;
}

export const Spinner = ({ size = "sm", className }: SpinnerProps) => {
  const sizeClasses = {
    sm: "h-4 w-4",
    lg: "h-8 w-8"
  };

  return (
    <Loader2
      className={cn("animate-spin", sizeClasses[size], className)}
      aria-label="Loading"
    />
  );
};

// Skeleton component for content placeholders
interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

export const Skeleton = ({ className, width, height }: SkeletonProps) => {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-gray-200 dark:bg-gray-700",
        className
      )}
      style={{ width, height }}
      aria-label="Loading content"
    />
  );
};

// Board card skeleton
export const BoardCardSkeleton = () => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <div className="flex items-center space-x-2">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
};

// Whiteboard skeleton
export const WhiteboardSkeleton = () => {
  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar skeleton */}
      <div className="w-16 bg-white border-r border-gray-200 flex flex-col items-center py-4 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-10 rounded" />
        ))}
      </div>
      
      {/* Main content skeleton */}
      <div className="flex-1 flex-col">       {/* Top bar skeleton */}
        <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
          <Skeleton className="h-6 w-32" />
          <div className="flex items-center space-x-2">
            <Skeleton className="h-3 w-20" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-8 rounded-full" />
            ))}
          </div>
        </div>
        
        {/* Canvas skeleton */}
        <div className="flex-1 bg-white">
          <Skeleton className="w-full h-full" />
        </div>
      </div>
    </div>
  );
};

// Retry component for failed operations
interface RetryProps {
  onRetry: () => void;
  error?: string;
  isLoading?: boolean;
  className?: string;
}

export const RetryButton = ({ onRetry, error, isLoading, className }: RetryProps) => {
  return (
    <div className={cn("flex flex-col items-center space-y-2", className)}>
      {error && (
        <p className="text-sm text-red-600 text-center max-w-xs">{error}</p>
      )}
      <Button
        onClick={onRetry}
        disabled={isLoading}
        variant="outline"
        size="sm"
        className="flex items-center space-x-2"
      >
        {isLoading ? (
          <Spinner size="sm" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        <span>{isLoading ? "Retrying..." : "Retry"}</span>
      </Button>
    </div>
  );
};

// Loading overlay for blocking operations
interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  onCancel?: () => void;
}

export const LoadingOverlay = ({ isVisible, message, onCancel }: LoadingOverlayProps) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 flex flex-col items-center space-y-4">
        <Spinner size="lg" />
        {message && <p className="text-gray-600">{message}</p>}
        {onCancel && (
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
};

// Progress bar for long-running operations
interface ProgressBarProps {
  progress: number;
  message?: string;
  className?: string;
}

export const ProgressBar = ({ progress, message, className }: ProgressBarProps) => {
  return (
    <div className={cn("space-y-2", className)}>
      {message && <p className="text-sm text-gray-600">{message}</p>}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}; 