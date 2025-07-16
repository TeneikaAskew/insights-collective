// Enhanced Canvas-style rich content editor - unified implementation
// This file maintains backward compatibility by re-exporting the unified editor

export { UnifiedCanvasEditor as EnhancedCanvasEditor } from './unified-canvas-editor';
export { UnifiedCanvasEditor } from './unified-canvas-editor';
export { default } from './unified-canvas-editor';

// Type exports for backward compatibility
export type { UnifiedCanvasEditorProps as EnhancedCanvasEditorProps } from './unified-canvas-editor';