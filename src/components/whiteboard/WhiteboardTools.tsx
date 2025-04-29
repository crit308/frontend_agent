import React from 'react';
import { Button } from '../ui/button'; // Adjusted import
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../ui/tooltip'; // Adjusted import
import { Pen, Eraser, Trash2, Save, Palette, Minus, Plus } from 'lucide-react';
import { cn } from '../../lib/utils'; // Adjusted import

interface WhiteboardToolsProps {
  currentTool: 'pen' | 'eraser';
  onToolChange: (tool: 'pen' | 'eraser') => void;
  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;
  color: string;
  onColorChange: (color: string) => void;
  onClear: () => void;
  onSave?: () => void; // Save is optional
}

const colors = [
  '#000000', '#ff0000', '#0000ff', '#008000', 
  '#ffff00', '#ffa500', '#800080', '#ffffff'
];

const WhiteboardTools: React.FC<WhiteboardToolsProps> = ({
  currentTool,
  onToolChange,
  strokeWidth,
  onStrokeWidthChange,
  color,
  onColorChange,
  onClear,
  onSave
}) => {
  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex items-center justify-between p-2 border-b border-gray-300 bg-gray-50 dark:bg-gray-700">
        {/* Left side: Tools */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={currentTool === 'pen' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => onToolChange('pen')}
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
                onClick={() => onToolChange('eraser')}
                className={cn(currentTool === 'eraser' && 'ring-2 ring-primary')}
              >
                <Eraser className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Eraser Tool</TooltipContent>
          </Tooltip>
        </div>

        {/* Center: Stroke width and Color picker */}
        <div className="flex items-center gap-3">
          {/* Stroke Width */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => onStrokeWidthChange(Math.max(1, strokeWidth - 1))}
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
                  onClick={() => onStrokeWidthChange(strokeWidth + 1)}
                  disabled={strokeWidth >= 20}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Increase Stroke Width</TooltipContent>
            </Tooltip>
          </div>

          {/* Color Picker */}
          <div className="flex items-center gap-1 border p-1 rounded-md">
            {colors.map((c) => (
              <Tooltip key={c}>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      'h-6 w-6 rounded-full border-2',
                      color === c ? 'border-primary ring-2 ring-primary ring-offset-1' : 'border-transparent',
                      c === '#ffffff' && 'border-gray-300' // Special case for white
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => onColorChange(c)}
                  />
                </TooltipTrigger>
                <TooltipContent>{c === '#ffffff' ? 'White' : c}</TooltipContent>
              </Tooltip>
            ))}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="ml-1">
                   <Palette className="h-4 w-4" />
                   <input 
                      type="color" 
                      value={color} 
                      onChange={(e) => onColorChange(e.target.value)} 
                      className="absolute inset-0 opacity-0 cursor-pointer"
                   />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Custom Color</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Right side: Actions */}
        <div className="flex items-center gap-1">
          {onSave && (
             <Tooltip>
                <TooltipTrigger asChild>
                   <Button variant="ghost" size="icon" onClick={onSave}>
                      <Save className="h-4 w-4" />
                   </Button>
                </TooltipTrigger>
                <TooltipContent>Save Drawing</TooltipContent>
             </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onClear}>
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