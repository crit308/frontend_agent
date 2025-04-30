'use client';

import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';
import * as fabric from 'fabric';
import { WhiteboardAction, CanvasObjectSpec } from '@/lib/types'; // Added CanvasObjectSpec for Update
import { createFabricObject, updateFabricObject, deleteFabricObject } from '@/lib/fabricObjectFactory'; // Import factory (to be created)

interface WhiteboardContextType {
  fabricCanvas: fabric.Canvas | null;
  setFabricCanvas: (canvas: fabric.Canvas | null) => void; // Allow Whiteboard to register itself
  dispatchWhiteboardAction: (action: WhiteboardAction | WhiteboardAction[]) => void;
  // Add undo/redo functions later
}

const WhiteboardContext = createContext<WhiteboardContextType | undefined>(undefined);

export const WhiteboardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [fabricCanvas, setFabricCanvasInternal] = useState<fabric.Canvas | null>(null);

  const setFabricCanvas = useCallback((canvas: fabric.Canvas | null) => {
     console.log("[WhiteboardProvider] Setting Fabric Canvas instance:", canvas ? 'Instance received' : 'Instance cleared');
     setFabricCanvasInternal(canvas);
  }, []);

  const dispatchWhiteboardAction = useCallback((actionOrActions: WhiteboardAction | WhiteboardAction[]) => {
    if (!fabricCanvas) {
      console.warn('dispatchWhiteboardAction called before canvas is ready.');
      // TODO: Queue actions? Or rely on re-render after canvas is set?
      return;
    }

    const actions = Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions];
    console.log(`[WhiteboardProvider] Dispatching ${actions.length} actions:`, actions);

    actions.forEach(action => {
      try {
           switch (action.type) {
             case 'ADD_OBJECTS':
               const objectsToAdd = action.objects.map(createFabricObject); // Use factory
               fabricCanvas.add(...objectsToAdd);
               break;
             case 'UPDATE_OBJECTS':
                action.objects.forEach((updateSpec: Partial<CanvasObjectSpec>) => { // Type hint for updateSpec
                    // Find object by custom metadata ID
                    const obj = fabricCanvas.getObjects().find((o: fabric.Object) => o.get('metadata')?.id === updateSpec.id);
                    if(obj) {
                        updateFabricObject(obj, updateSpec); // Use factory helper
                    } else {
                        console.warn(`[WhiteboardProvider] Object with ID ${updateSpec.id} not found for update.`);
                    }
                });
               break;
             case 'DELETE_OBJECTS':
                action.ids.forEach(idToDelete => {
                   deleteFabricObject(fabricCanvas, idToDelete); // Use factory helper
                });
               break;
           }
      } catch (error) {
           console.error("[WhiteboardProvider] Error dispatching whiteboard action:", action, error);
      }
    });

    fabricCanvas.requestRenderAll(); // Render changes after processing actions
  }, [fabricCanvas]); // Dependency: fabricCanvas

  const value = { fabricCanvas, setFabricCanvas, dispatchWhiteboardAction };

  return (
    <WhiteboardContext.Provider value={value}>
      {children}
    </WhiteboardContext.Provider>
  );
};

export const useWhiteboard = (): WhiteboardContextType => {
  const context = useContext(WhiteboardContext);
  if (context === undefined) {
    throw new Error('useWhiteboard must be used within a WhiteboardProvider');
  }
  return context;
}; 