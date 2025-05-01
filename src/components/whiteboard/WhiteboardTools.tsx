import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../ui/tooltip';
import { Pen, Eraser, Trash2, Save, Palette, Minus, Plus, MousePointer } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useWhiteboard } from '@/contexts/WhiteboardProvider';

const colors = [
  '#000000', '#ff0000', '#0000ff', '#008000',
  '#ffff00', '#ffa500', '#800080', '#ffffff'
];

const WhiteboardTools: React.FC = () => {
  const { fabricCanvas } = useWhiteboard();
  const [currentTool, setCurrentTool] = useState<'pen' | 'eraser' | 'select'>('select');
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
  const [color, setColor] = useState<string>('#000000');

  const handleToolChange = (tool: 'pen' | 'eraser' | 'select') => {
    if (!fabricCanvas) return;
    setCurrentTool(tool);
    if (tool === 'pen') {
      fabricCanvas.isDrawingMode = true;
      if (fabricCanvas.freeDrawingBrush) {
        fabricCanvas.freeDrawingBrush.width = strokeWidth;
        fabricCanvas.freeDrawingBrush.color = color;
      }
    } else if (tool === 'eraser') {
      fabricCanvas.isDrawingMode = true;
      if (fabricCanvas.freeDrawingBrush) {
        fabricCanvas.freeDrawingBrush.width = Math.max(10, strokeWidth * 2);
        fabricCanvas.freeDrawingBrush.color = '#ffffff';
      }
    } else {
      fabricCanvas.isDrawingMode = false;
    }
  };

  const handleStrokeWidthChange = (newWidth: number) => {
    const clampedWidth = Math.max(1, Math.min(20, newWidth));
    setStrokeWidth(clampedWidth);
    if (fabricCanvas && fabricCanvas.freeDrawingBrush) {
      if (currentTool === 'pen') {
        fabricCanvas.freeDrawingBrush.width = clampedWidth;
      } else if (currentTool === 'eraser') {
        fabricCanvas.freeDrawingBrush.width = Math.max(10, clampedWidth * 2);
      }
    }
  };

  const handleColorChange = (newColor: string) => {
    setColor(newColor);
    if (fabricCanvas && currentTool === 'pen' && fabricCanvas.freeDrawingBrush) {
      fabricCanvas.freeDrawingBrush.color = newColor;
    }
  };

  const handleClear = () => {
    if (!fabricCanvas) return;
    fabricCanvas.clear();
    fabricCanvas.renderAll();
  };

  if (!fabricCanvas) {
    return <div className="p-2 text-center text-muted-foreground">Whiteboard initializing...</div>;
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex items-center justify-between p-2 border-b bg-card">
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={currentTool === 'select' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => handleToolChange('select')}
                className={cn(currentTool === 'select' && 'ring-2 ring-primary')}
              >
                <MousePointer className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Select / Move</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={currentTool === 'pen' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => handleToolChange('pen')}
                className={cn(currentTool === 'pen' && 'ring-2 ring-primary')}
              >
                <Pen className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Pen Tool</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={currentTool === 'eraser' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => handleToolChange('eraser')}
                className={cn(currentTool === 'eraser' && 'ring-2 ring-primary')}
              >
                <Eraser className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Eraser Tool</TooltipContent>
          </Tooltip>
        </div>

        {(currentTool === 'pen' || currentTool === 'eraser') && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleStrokeWidthChange(strokeWidth - 1)}
                    disabled={strokeWidth <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Decrease Stroke Width</TooltipContent>
              </Tooltip>
              <span className="text-sm font-medium w-6 text-center">{strokeWidth}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleStrokeWidthChange(strokeWidth + 1)}
                    disabled={strokeWidth >= 20}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Increase Stroke Width</TooltipContent>
              </Tooltip>
            </div>

            {currentTool === 'pen' && (
              <div className="flex items-center gap-1 border p-1 rounded-md">
                {colors.map((c) => (
                  <Tooltip key={c}>
                    <TooltipTrigger asChild>
                      <button
                        className={cn(
                          'h-6 w-6 rounded-full border-2',
                          color === c ? 'border-primary ring-2 ring-primary ring-offset-1' : 'border-transparent',
                          c === '#ffffff' && 'border-muted-foreground'
                        )}
                        style={{ backgroundColor: c }}
                        onClick={() => handleColorChange(c)}
                      />
                    </TooltipTrigger>
                    <TooltipContent>{c === '#ffffff' ? 'White' : c}</TooltipContent>
                  </Tooltip>
                ))}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative ml-1">
                       <Palette className="h-4 w-4" />
                       <input
                          type="color"
                          value={color}
                          onChange={(e) => handleColorChange(e.target.value)}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                       />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Custom Color</TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handleClear}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear Drawing</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default WhiteboardTools; 