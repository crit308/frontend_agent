
import { FC } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Canvas, Rect, Circle, Textbox } from 'fabric';
import { 
  Pencil, 
  Square, 
  Circle as CircleIcon, 
  Text, 
  Eraser, 
  MousePointer, 
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';

interface WhiteboardToolsProps {
  activeTool: 'select' | 'draw' | 'rectangle' | 'circle' | 'text' | 'eraser';
  setActiveTool: (tool: 'select' | 'draw' | 'rectangle' | 'circle' | 'text' | 'eraser') => void;
  activeColor: string;
  setActiveColor: (color: string) => void;
  fabricCanvas: Canvas | null;
}

const WhiteboardTools: FC<WhiteboardToolsProps> = ({
  activeTool,
  setActiveTool,
  activeColor,
  setActiveColor,
  fabricCanvas
}) => {
  const colors = [
    '#000000', // Black
    '#e11d48', // Red
    '#2563eb', // Blue
    '#16a34a', // Green
    '#ca8a04', // Yellow
    '#9333ea', // Purple
    '#f97316', // Orange
  ];

  const handleClear = () => {
    if (!fabricCanvas) return;
    
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = '#ffffff';
    fabricCanvas.renderAll();
    toast("Whiteboard cleared!");
  };

  const handleAddRectangle = () => {
    if (!fabricCanvas) return;
    setActiveTool('select');
    
    const rect = new Rect({
      left: 100,
      top: 100,
      fill: activeColor,
      width: 100,
      height: 60,
      strokeWidth: 2,
      stroke: '#000000',
    });
    fabricCanvas.add(rect);
    fabricCanvas.renderAll();
  };

  const handleAddCircle = () => {
    if (!fabricCanvas) return;
    setActiveTool('select');
    
    const circle = new Circle({
      left: 160,
      top: 100,
      fill: activeColor,
      radius: 40,
      strokeWidth: 2,
      stroke: '#000000',
    });
    fabricCanvas.add(circle);
    fabricCanvas.renderAll();
  };

  const handleAddText = () => {
    if (!fabricCanvas) return;
    setActiveTool('select');
    
    const text = new Textbox('Edit this text', {
      left: 100,
      top: 100,
      fontFamily: 'Arial',
      fill: activeColor,
      width: 200,
    });
    fabricCanvas.add(text);
    fabricCanvas.renderAll();
  };

  return (
    <div className="border-b p-2 bg-gray-50 flex flex-wrap gap-2 items-center justify-between">
      <div className="flex flex-wrap gap-2 items-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={activeTool === 'select' ? 'default' : 'outline'} 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => setActiveTool('select')}
              >
                <MousePointer className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Select</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={activeTool === 'draw' ? 'default' : 'outline'} 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => setActiveTool('draw')}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Draw</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8" 
                onClick={handleAddRectangle}
              >
                <Square className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add Rectangle</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8" 
                onClick={handleAddCircle}
              >
                <CircleIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add Circle</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8" 
                onClick={handleAddText}
              >
                <Text className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add Text</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={activeTool === 'eraser' ? 'default' : 'outline'} 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => setActiveTool('eraser')}
              >
                <Eraser className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Eraser</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <div className="h-6 border-r border-gray-300 mx-1"></div>
        
        {colors.map(color => (
          <button
            key={color}
            className={`h-6 w-6 rounded-full border ${activeColor === color ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
            style={{ backgroundColor: color }}
            onClick={() => setActiveColor(color)}
            aria-label={`Color: ${color}`}
          />
        ))}
      </div>
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-8 w-8 text-red-500 hover:text-red-600" 
              onClick={handleClear}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clear Whiteboard</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export default WhiteboardTools;
