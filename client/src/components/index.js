// Lazy loaded components for code splitting
import { lazy } from 'react';

// Eagerly loaded components (used frequently)
export { default as Toast } from './Toast';
export { FolderItem, FileItemComponent, formatSize } from './FileItem';
export { default as ContextMenu } from './ContextMenu';

// Lazy loaded components (modals - loaded on demand)
export const FilePreview = lazy(() => import('./FilePreview'));
export const Modals = lazy(() => import('./Modals').then(module => ({
  default: module.NewFolderModal
})));

// Named exports for modals
export { NewFolderModal, MoveModal, ShareModal, FileInfoModal } from './Modals';

// New components - Sprint 4-10
export const VersionHistoryModal = lazy(() => import('./VersionHistoryModal'));
export const CommentsPanel = lazy(() => import('./CommentsPanel'));
export const CollectionsManager = lazy(() => import('./CollectionsManager'));
export const DocxPreview = lazy(() => import('./DocxPreview'));
export const ExcelPreview = lazy(() => import('./ExcelPreview'));
export const TextEditor = lazy(() => import('./TextEditor'));

// AI Components
export const AIPanel = lazy(() => import('./AIPanel'));
export const SmartAssistant = lazy(() => import('./SmartAssistant'));
