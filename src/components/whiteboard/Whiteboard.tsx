import React, { useRef, useEffect } from 'react';
import * as fabric from 'fabric';
import type { TEvent } from 'fabric';
import { useWhiteboard } from '@/contexts/WhiteboardProvider'; // Import the hook
import { useSessionStore } from '@/store/sessionStore'; // Import sendInteraction
import { calculateAbsoluteCoords } from '@/lib/whiteboardUtils'; // Added import
import { CanvasObjectSpec } from '@/lib/types'; // Added import

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
      if (target.metadata.role === 'option_selector') {
        const clickedCircle = target as fabric.Object;

        // 1️⃣  Notify backend first (if option_id available). Fallback to id.
        if (typeof target.metadata.option_id !== 'undefined') {
          console.log(`[Whiteboard] Option selector clicked. Option ID: ${target.metadata.option_id}`);
          const answerPayload: any = { answer_index: target.metadata.option_id };
          if (target.metadata.question_id) {
            answerPayload.question_id = target.metadata.question_id;
          }
          sendInteraction('answer', answerPayload);
        } else {
          console.log(`[Whiteboard] Option selector clicked (no explicit option_id).`);
          sendInteraction('answer', { object_id: target.metadata.id });
        }

        // 2️⃣  Provide immediate visual feedback on the canvas.
        if (fabricCanvasRef.current) {
          const canvas = fabricCanvasRef.current;
          // Unselect all other option circles (set fill back to white)
          canvas.getObjects().forEach(obj => {
            if ((obj as any).metadata?.role === 'option_selector') {
              obj.set('fill', '#FFFFFF');
            }
          });

          // Highlight the clicked one
          clickedCircle.set('fill', '#4F46E5'); // indigo-600
          canvas.requestRenderAll();
        }
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
        if (!fabricCanvasRef.current) return;
        const fabricCanvas = fabricCanvasRef.current;
        const entry = entries[0];
        const { width: newCanvasWidth, height: newCanvasHeight } = entry.contentRect;
        
        console.log('[Whiteboard] Resized to:', newCanvasWidth, newCanvasHeight);
        fabricCanvas.setWidth(newCanvasWidth);
        fabricCanvas.setHeight(newCanvasHeight);

        // Iterate through all objects and update their positions/dimensions if they use percentages
        fabricCanvas.getObjects().forEach(obj => {
            const metadata = (obj as any).metadata as CanvasObjectSpec['metadata'];
            if (metadata && metadata.pctCoords) {
                const pctSpec: Partial<CanvasObjectSpec> = {
                    id: metadata.id,
                    // Use stored percentages for recalculation
                    xPct: metadata.pctCoords.xPct,
                    yPct: metadata.pctCoords.yPct,
                    widthPct: metadata.pctCoords.widthPct,
                    heightPct: metadata.pctCoords.heightPct,
                    // Include original absolute values if no Pct was defined for a dimension, 
                    // so calculateAbsoluteCoords can pass them through.
                    // This is important if an object uses Pct for x/y but fixed for width/height.
                    x: metadata.pctCoords.xPct === undefined ? obj.left : undefined,
                    y: metadata.pctCoords.yPct === undefined ? obj.top : undefined,
                    width: metadata.pctCoords.widthPct === undefined ? obj.width : undefined,
                    height: metadata.pctCoords.heightPct === undefined ? obj.height : undefined,
                };

                const { x, y, width, height } = calculateAbsoluteCoords(pctSpec as CanvasObjectSpec, newCanvasWidth, newCanvasHeight);
                
                const updateProps: any = { left: x, top: y };
                if (width !== undefined) updateProps.width = width;
                if (height !== undefined) updateProps.height = height;

                obj.set(updateProps);
                obj.setCoords(); 
            }
        });

        fabricCanvas.requestRenderAll();
    });
    resizeObserver.observe(parentRef.current!);

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