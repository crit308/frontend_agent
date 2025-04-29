import React, { useRef, useEffect, useState, useCallback } from 'react';
import { SVG, extend as SVGextend, Element as SVGElement, Svg } from '@svgdotjs/svg.js';
import { useSvgDrawing } from 'react-hooks-svgdrawing';
import WhiteboardTools from './WhiteboardTools';
import { useWhiteboardStore } from '@/store/whiteboardStore';

interface WhiteboardProps {
  sessionId?: string;
  initialSvg?: string; // Might not be directly usable with the hook, needs investigation
  onSave?: (svgData: string) => void;
}

// Wrap the component definition with React.memo
const Whiteboard: React.FC<WhiteboardProps> = React.memo(({ initialSvg, onSave }) => {
  console.log("[Whiteboard] Rendering"); // Add log for render verification

  const [renderRef, drawActions] = useSvgDrawing();
  const [currentTool, setCurrentTool] = useState<'pen' | 'eraser'>('pen');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [color, setColor] = useState('#000000');

  // --- Connect to whiteboard store ---
  const setSvgInstance = useWhiteboardStore(state => state.setSvgInstance);

  // When the underlying SVG element is available, wrap it with svg.js and
  // hand the instance to the zustand store so other parts of the app (e.g.
  // useTutorStream) can draw chat bubbles/content.
  useEffect(() => {
    console.log("[Whiteboard] Initial mount effect running."); // Log mount effect
    let attempts = 0;
    const maxAttempts = 40; // ~4 seconds at 100ms interval

    const intervalId = setInterval(() => {
      attempts += 1;
      // Check renderRef.current inside the interval
      const currentRef = renderRef.current;
      if (!currentRef) {
          console.log(`[Whiteboard] Polling attempt ${attempts}: renderRef.current is null`);
          if (attempts >= maxAttempts) {
             console.warn('[Whiteboard] SVG polling timed out (renderRef unavailable).');
             clearInterval(intervalId);
          }
          return;
      }

      const drawingSvgEl = currentRef.querySelector('svg');
      if (drawingSvgEl) {
        // Ensure we have (or create) an overlay svg for chat bubbles.
        let overlaySvgEl = currentRef.querySelector('#chatOverlaySvg') as SVGSVGElement | null;

        if (!overlaySvgEl) {
          overlaySvgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
          overlaySvgEl.setAttribute('id', 'chatOverlaySvg');
          overlaySvgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
          (overlaySvgEl as SVGSVGElement).style.position = 'absolute';
          (overlaySvgEl as SVGSVGElement).style.top = '0';
          (overlaySvgEl as SVGSVGElement).style.left = '0';
          (overlaySvgEl as SVGSVGElement).style.width = '100%';
          (overlaySvgEl as SVGSVGElement).style.height = '100%';
          (overlaySvgEl as SVGSVGElement).style.pointerEvents = 'none'; // Allow drawing events to pass through

          currentRef.appendChild(overlaySvgEl);
        }

        console.log("[Whiteboard] Overlay SVG ready, handing to store.");
        setSvgInstance(SVG(overlaySvgEl as unknown as SVGElement) as unknown as Svg);
        clearInterval(intervalId);
      } else if (attempts >= maxAttempts) {
        console.warn('[Whiteboard] SVG element not detected after polling.');
        clearInterval(intervalId);
      }
    }, 100);

    // Cleanup function for the effect itself
    return () => {
      console.log("[Whiteboard] Unmount effect running, clearing SVG instance from store."); // Log unmount
      clearInterval(intervalId);
      setSvgInstance(null);
    };
    // Correct dependencies: renderRef and setSvgInstance
  }, [renderRef, setSvgInstance]);

  const handleToolChange = useCallback((tool: 'pen' | 'eraser') => {
    setCurrentTool(tool);
    if (tool === 'eraser') {
      drawActions.changePenColor('#ffffff');
    } else {
      drawActions.changePenColor(color);
      drawActions.changePenWidth(strokeWidth);
    }
  }, [drawActions, color, strokeWidth]);

  const handleStrokeWidthChange = useCallback((width: number) => {
    setStrokeWidth(width);
    if (currentTool === 'pen') {
      drawActions.changePenWidth(width);
    }
  }, [drawActions, currentTool]);

  const handleColorChange = useCallback((newColor: string) => {
    setColor(newColor);
    if (currentTool === 'pen') {
      drawActions.changePenColor(newColor);
    }
  }, [drawActions, currentTool]);

  const handleClear = useCallback(() => {
    drawActions.clear();
  }, [drawActions]);

  const handleSave = useCallback(() => {
    if (onSave) {
      const svgElementOrString = drawActions.getSvgXML();
      const svgData = typeof svgElementOrString === 'string' ? svgElementOrString : '';
      if (svgData) {
        onSave(svgData);
      } else {
        console.warn("Could not retrieve SVG data for saving.");
      }
    }
  }, [drawActions, onSave]);

  return (
    <div className="flex flex-col h-full border border-border rounded-lg overflow-hidden bg-white dark:bg-gray-950">
      <WhiteboardTools
        currentTool={currentTool}
        onToolChange={handleToolChange}
        strokeWidth={strokeWidth}
        onStrokeWidthChange={handleStrokeWidthChange}
        color={color}
        onColorChange={handleColorChange}
        onClear={handleClear}
        onSave={onSave ? handleSave : undefined}
      />
      <div ref={renderRef} className="flex-grow relative overflow-hidden cursor-crosshair w-full h-full touch-none bg-gray-100 dark:bg-gray-800" /> {/* Added background */} 
    </div>
  );
}); // End of React.memo wrap

export default Whiteboard; 