/**
 * Lazy-loaded components for better performance
 */

import { lazy } from 'react';

// Lazy load heavy components
export const Whiteboard = lazy(() => import('./whiteboard/Whiteboard'));
export const BoardsList = lazy(() => import('./dashboard/BoardsList'));
export const AuthForm = lazy(() => import('./auth/AuthForm'));

