import React, { useRef, useEffect } from 'react';
import * as fabric from 'fabric';
import type { TEvent } from 'fabric';
import { useWhiteboard } from '@/contexts/WhiteboardProvider'; // Import the hook
import { useSessionStore } from '@/store/sessionStore'; // Import sendInteraction

interface WhiteboardProps {
  sessionId?: string;
  // Remove initialSvg and onSave props if they were specific to the old implementation
}

const Whiteboard: React.FC<WhiteboardProps> = React.memo(({ sessionId }) => {
  console.log("[Whiteboard] Rendering with Fabric");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const parentRef = useRef<HTMLDivElement>(null); // Ref for the container div
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null); // Ref to store Fabric instance
  const { setFabricCanvas } = useWhiteboard(); // Get the function from context
  const sendInteraction = useSessionStore((state) => state.sendInteraction); // Get sendInteraction from store

  // --- Handler for canvas object clicks ---
  const handleCanvasClick = React.useCallback((opt: any) => {
    const target = opt.target;
    // Check if the clicked target is a fabric object and has a metadata ID
    if (target && target.metadata) {
      // MCQ Option Selector
      if (target.metadata.role === 'option_selector' && typeof target.metadata.option_id !== 'undefined') {
        console.log(`[Whiteboard] Option selector clicked. Option ID: ${target.metadata.option_id}`);
        sendInteraction('answer', { answer_index: target.metadata.option_id });
        return;
      }
      // Generic object click
      if (target.metadata.id) {
        const objectId = target.metadata.id;
        console.log(`[Whiteboard] Canvas object clicked. ID: ${objectId}`);
        sendInteraction('canvas_click' as any, { object_id: objectId });
        return;
      }
    }
    console.log("[Whiteboard] Clicked on canvas background or object without actionable metadata.");
  }, [sendInteraction]);

  useEffect(() => {
    if (!canvasRef.current || !parentRef.current) {
        console.warn('[Whiteboard] Canvas element or parent ref not available yet.');
        return; // Wait for the canvas element to be available
    }

    // Initialize Fabric canvas
    const parentWidth = parentRef.current.offsetWidth;
    const parentHeight = parentRef.current.offsetHeight;

    const canvas = new fabric.Canvas(canvasRef.current, {
        width: parentWidth,
        height: parentHeight,
        backgroundColor: '#f0f0f0', // Example background color
        // Add other Fabric canvas options here if needed
    });
    fabricCanvasRef.current = canvas; // Store instance in ref

    console.log("[Whiteboard] Fabric Canvas Initialized, size:", parentWidth, parentHeight);
    setFabricCanvas(canvas); // Register the canvas instance with the provider

    // --- Attach event listener --- 
    // Use 'mouse:up' to avoid triggering on drag attempts
    canvas.on('mouse:up', handleCanvasClick);

    // Handle resize - Adjust canvas size when container resizes
    const resizeObserver = new ResizeObserver(entries => {
        const entry = entries[0];
        const { width, height } = entry.contentRect;
        console.log('[Whiteboard] Resized to:', width, height);
        canvas.setWidth(width);
        canvas.setHeight(height);
        canvas.renderAll();
    });
    resizeObserver.observe(parentRef.current);

    // --- Cleanup --- 
    return () => {
      console.log("[Whiteboard] Cleanup: Disposing Fabric canvas and clearing context ref.");
      resizeObserver.disconnect();
      setFabricCanvas(null); // Clear the canvas instance in the provider
      if (fabricCanvasRef.current) {
        // Remove event listener before disposing
        fabricCanvasRef.current.off('mouse:up', handleCanvasClick);
        fabricCanvasRef.current.dispose(); // Dispose Fabric canvas
        fabricCanvasRef.current = null;
      }
    };
  }, [setFabricCanvas, handleCanvasClick]); // Add handleCanvasClick to deps

  return (
    <div ref={parentRef} className="flex-grow w-full h-full border border-border rounded-lg overflow-hidden bg-white dark:bg-gray-950">
        {/* Add Tools or other UI elements here if needed later */}
        <canvas ref={canvasRef} />
    </div>
  );
});

export default Whiteboard; 