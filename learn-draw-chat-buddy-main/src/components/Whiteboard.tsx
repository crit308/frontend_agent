
import { useEffect, useRef, useState } from 'react';
import { Canvas } from 'fabric';
import WhiteboardTools from './WhiteboardTools';
import { toast } from 'sonner';
import { createMathExample, createFlowchartExample, createChemistryExample, createHistoryTimeline } from '@/utils/whiteboardExamples';

const Whiteboard = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<Canvas | null>(null);
  const [activeColor, setActiveColor] = useState('#000000');
  const [activeTool, setActiveTool] = useState<'select' | 'draw' | 'rectangle' | 'circle' | 'text' | 'eraser'>('draw');
  const [exampleVisible, setExampleVisible] = useState(false);
  const [currentExample, setCurrentExample] = useState<'math' | 'chemistry' | 'flowchart' | 'history'>('math');
  
  useEffect(() => {
    if (!canvasRef.current) return;
    
    // Set up the canvas on initial render
    const canvas = new Canvas(canvasRef.current, {
      backgroundColor: '#ffffff',
      isDrawingMode: true,
    });
    
    // Make the canvas responsive
    const resizeCanvas = () => {
      const parentEl = containerRef.current;
      if (!parentEl || !canvas) return;
      
      const width = parentEl.clientWidth;
      const height = parentEl.clientHeight || 500; // Increased height
      
      canvas.setWidth(width);
      canvas.setHeight(height);
      canvas.renderAll();
      
      // If example is showing, redraw it to fit new dimensions
      if (exampleVisible && currentExample) {
        showExample(currentExample);
      }
    };
    
    // Initialize
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Set up the drawing brush
    if (canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = activeColor;
      canvas.freeDrawingBrush.width = 2;
    }
    
    setFabricCanvas(canvas);
    toast("Whiteboard ready!");
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      canvas.dispose();
    };
  }, []);
  
  // Handle tool changes
  useEffect(() => {
    if (!fabricCanvas) return;
    
    fabricCanvas.isDrawingMode = activeTool === 'draw';
    
    if (fabricCanvas.isDrawingMode && fabricCanvas.freeDrawingBrush) {
      fabricCanvas.freeDrawingBrush.color = activeTool === 'eraser' ? '#ffffff' : activeColor;
      fabricCanvas.freeDrawingBrush.width = activeTool === 'eraser' ? 20 : 2;
    }
    
  }, [activeTool, activeColor, fabricCanvas]);
  
  // Show example content in the whiteboard
  const showExample = (type: 'math' | 'chemistry' | 'flowchart' | 'history') => {
    if (!fabricCanvas) return;
    
    // Clear the canvas first
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = '#ffffff';
    
    // Create the example based on type
    switch (type) {
      case 'math':
        createMathExample(fabricCanvas);
        break;
      case 'chemistry':
        createChemistryExample(fabricCanvas);
        break;
      case 'flowchart':
        createFlowchartExample(fabricCanvas);
        break;
      case 'history':
        createHistoryTimeline(fabricCanvas);
        break;
    }
    
    setCurrentExample(type);
    setExampleVisible(true);
    
    fabricCanvas.renderAll();
    toast(`Showing ${type} example`);
  };

  return (
    <div className="flex flex-col h-full">
      <WhiteboardTools 
        activeTool={activeTool} 
        setActiveTool={setActiveTool}
        activeColor={activeColor}
        setActiveColor={setActiveColor}
        fabricCanvas={fabricCanvas}
      />
      <div ref={containerRef} className="flex-1 relative border-t">
        <canvas ref={canvasRef} className="absolute inset-0" />
      </div>
      <div className="p-2 bg-gray-50 border-t flex flex-wrap gap-2">
        <div className="text-sm font-medium mr-2">AI Tutor Examples:</div>
        <button 
          onClick={() => showExample('math')} 
          className={`px-3 py-1 text-xs rounded-full ${currentExample === 'math' && exampleVisible ? 'bg-tutor-primary text-white' : 'bg-gray-200'}`}
        >
          Math Equation
        </button>
        <button 
          onClick={() => showExample('chemistry')} 
          className={`px-3 py-1 text-xs rounded-full ${currentExample === 'chemistry' && exampleVisible ? 'bg-tutor-primary text-white' : 'bg-gray-200'}`}
        >
          Chemistry
        </button>
        <button 
          onClick={() => showExample('flowchart')} 
          className={`px-3 py-1 text-xs rounded-full ${currentExample === 'flowchart' && exampleVisible ? 'bg-tutor-primary text-white' : 'bg-gray-200'}`}
        >
          Flowchart
        </button>
        <button 
          onClick={() => showExample('history')} 
          className={`px-3 py-1 text-xs rounded-full ${currentExample === 'history' && exampleVisible ? 'bg-tutor-primary text-white' : 'bg-gray-200'}`}
        >
          History Timeline
        </button>
      </div>
    </div>
  );
};

export default Whiteboard;
