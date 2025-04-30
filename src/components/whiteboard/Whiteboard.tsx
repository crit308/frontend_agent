import React, { useRef, useEffect } from 'react';
import * as fabric from 'fabric';
import { useWhiteboard } from '@/contexts/WhiteboardProvider'; // Import the hook

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
        fabricCanvasRef.current.dispose(); // Dispose Fabric canvas
        fabricCanvasRef.current = null;
      }
    };
  }, [setFabricCanvas]); // Dependency: setFabricCanvas

  return (
    <div ref={parentRef} className="flex-grow w-full h-full border border-border rounded-lg overflow-hidden bg-white dark:bg-gray-950">
        {/* Add Tools or other UI elements here if needed later */}
        <canvas ref={canvasRef} />
    </div>
  );
});

export default Whiteboard; 