/* eslint-disable react-refresh/only-export-components */
import React, { lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';

// Placeholder components
const Placeholder = ({ name }: { name: string }) => <div>{name}</div>;

// Lazy load 3D and canvas routes
const Route3D = lazy(() => Promise.resolve({ default: () => <Placeholder name="3D View" /> }));
const RouteCanvas = lazy(() => Promise.resolve({ default: () => <Placeholder name="Canvas" /> }));
const RouteDesignSystem = lazy(() => import('./screens/DesignSystem'));
const RouteDataEntryDemo = lazy(() => import('./screens/DataEntryDemo').then(m => ({ default: m.DataEntryDemo })));
const RouteListReviewDemo = lazy(() => import('./screens/ListReviewDemo').then(m => ({ default: m.ListReviewDemo })));
const RouteShellDemo = lazy(() => import('./screens/ShellDemo').then(m => ({ default: m.ShellDemo })));
const RouteCanvasOverlaysDemo = lazy(() => import('./screens/CanvasOverlaysDemo').then(m => ({ default: m.CanvasOverlaysDemo })));
const RouteFeedbackDemo = lazy(() => import('./screens/FeedbackDemo').then(m => ({ default: m.FeedbackDemo })));
const RouteShare = lazy(() => import('./screens/project/ShareRoute').then(m => ({ default: m.ShareRoute })));

export const router = createBrowserRouter([
  { path: '/login', element: <Placeholder name="/login" /> },
  { path: '/', element: <Placeholder name="dashboard" /> },
  { path: '/projects/:id/settings', element: <Placeholder name="/projects/:id/settings" /> },
  { path: '/projects/:id/upload', element: <Placeholder name="/projects/:id/upload" /> },
  { path: '/projects/:id/pipeline', element: <Placeholder name="/projects/:id/pipeline" /> },
  { path: '/projects/:id/scale', element: <Placeholder name="/projects/:id/scale" /> },
  { path: '/projects/:id/floors/:floorId/layers/walls', element: <RouteCanvas /> },
  { path: '/layers/objects', element: <RouteCanvas /> },
  { path: '/layers/dimensions', element: <RouteCanvas /> },
  { path: '/layers/grids', element: <RouteCanvas /> },
  { path: '/floors', element: <RouteCanvas /> },
  { path: '/layers/rooms', element: <RouteCanvas /> },
  { path: '/projects/:id/3d', element: <Route3D /> },
  { path: '/projects/:id/rules', element: <Placeholder name="/projects/:id/rules" /> },
  { path: '/projects/:id/export', element: <Placeholder name="/projects/:id/export" /> },
  { path: '/projects/:id/share', element: <React.Suspense fallback={<div>Loading...</div>}><RouteShare /></React.Suspense> },
  { path: '/admin/models', element: <Placeholder name="/admin/models" /> },
  { path: '/admin/users', element: <Placeholder name="/admin/users" /> },
  { path: '/account', element: <Placeholder name="/account" /> },
  { path: '/billing', element: <Placeholder name="/billing" /> },
  { path: '/design-system', element: <React.Suspense fallback={<div>Loading...</div>}><RouteDesignSystem /></React.Suspense> },
  { path: '/design-system/states', element: <Placeholder name="/design-system/states" /> },
  { path: '/data-entry-demo', element: <React.Suspense fallback={<div>Loading...</div>}><RouteDataEntryDemo /></React.Suspense> },
  { path: '/list-review-demo', element: <React.Suspense fallback={<div>Loading...</div>}><RouteListReviewDemo /></React.Suspense> },
  { path: '/shell-demo', element: <React.Suspense fallback={<div>Loading...</div>}><RouteShellDemo /></React.Suspense> },
  { path: '/demo/canvas-overlays', element: <React.Suspense fallback={<div>Loading...</div>}><RouteCanvasOverlaysDemo /></React.Suspense> },
  { path: '/feedback-demo', element: <React.Suspense fallback={<div>Loading...</div>}><RouteFeedbackDemo /></React.Suspense> },
  { path: '*', element: <Placeholder name="404" /> }
]);

