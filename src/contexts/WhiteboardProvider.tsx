'use client';

import React, { createContext, useContext, useState, useRef, useCallback, ReactNode, useEffect } from 'react';
import * as fabric from 'fabric';
import { WhiteboardAction, CanvasObjectSpec } from '@/lib/types'; // Added CanvasObjectSpec for Update
import { createFabricObject, updateFabricObject, deleteFabricObject } from '@/lib/fabricObjectFactory'; // Import factory (to be created)
import { useSessionStore } from '@/store/sessionStore'; // Import useSessionStore

interface WhiteboardContextType {
  fabricCanvas: fabric.Canvas | null;
  setFabricCanvas: (canvas: fabric.Canvas | null) => void; // Allow Whiteboard to register itself
  dispatchWhiteboardAction: (action: WhiteboardAction | WhiteboardAction[]) => void;
  // Add undo/redo functions later
}

const WhiteboardContext = createContext<WhiteboardContextType | undefined>(undefined);

export const WhiteboardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [fabricCanvasInternalState, setFabricCanvasInternalState] = useState<fabric.Canvas | null>(null);
  const setFabricCanvasInstanceInStore = useSessionStore((state) => state.setFabricCanvasInstance);

  const setFabricCanvas = useCallback((canvas: fabric.Canvas | null) => {
     console.log("[WhiteboardProvider] Setting Fabric Canvas instance in provider state:", canvas ? 'Instance received' : 'Instance cleared');
     setFabricCanvasInternalState(canvas);
     // Also set it in the global Zustand store
     setFabricCanvasInstanceInStore(canvas);
     console.log("[WhiteboardProvider] Fabric Canvas instance also set in Zustand store.");
  }, [setFabricCanvasInstanceInStore]);

  const dispatchWhiteboardAction = useCallback((actionOrActions: WhiteboardAction | WhiteboardAction[]) => {
    if (!fabricCanvasInternalState) { // Use the internal state for guard
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
               // Factory now adds objects directly (especially for async like images)
               action.objects.forEach(spec => createFabricObject(fabricCanvasInternalState, spec));
               break;
             case 'UPDATE_OBJECTS':
                action.objects.forEach((updateSpec: Partial<CanvasObjectSpec>) => {
                   // Find object by custom metadata ID (accessing metadata correctly)
                   const obj = fabricCanvasInternalState.getObjects().find((o: any) => o.metadata?.id === updateSpec.id);
                    if(obj) {
                         updateFabricObject(obj, updateSpec); // Use factory helper
                    } else {
                        console.warn(`[WhiteboardProvider] Object with ID ${updateSpec.id} not found for update.`);
                    }
                });
               break;
             case 'DELETE_OBJECTS':
                action.ids.forEach(idToDelete => {
                   deleteFabricObject(fabricCanvasInternalState, idToDelete); // Use factory helper
                });
               break;
             case 'CLEAR_CANVAS':
               console.log(`[WhiteboardProvider] Clearing canvas with scope: ${action.scope || 'all'}`);
               const allObjects = fabricCanvasInternalState.getObjects();
               let objectsToRemove: fabric.Object[] = [];
               if (action.scope === 'assistant_only') {
                   objectsToRemove = allObjects.filter((obj: any) => obj.metadata?.source === 'assistant');
                   console.log(`[WhiteboardProvider] Found ${objectsToRemove.length} assistant objects to remove.`);
               } else { // 'all' or undefined scope
                   objectsToRemove = allObjects;
                   console.log(`[WhiteboardProvider] Found ${objectsToRemove.length} objects to remove (all).`);
               }
               objectsToRemove.forEach(obj => fabricCanvasInternalState.remove(obj));
               const activeObject = fabricCanvasInternalState.getActiveObject();
               if (activeObject && objectsToRemove.includes(activeObject)) {
                   fabricCanvasInternalState.discardActiveObject();
               }
               fabricCanvasInternalState.requestRenderAll(); 
               break;
             default:
               // type assertion to help TS narrow down 'action'
               const unhandledAction = action as any;
               console.warn(`[WhiteboardProvider] Unhandled action type: ${unhandledAction.type}`);
           }
      } catch (error) {
           console.error("[WhiteboardProvider] Error dispatching whiteboard action:", action, error);
      }
    });

    // Render changes unless it was just a clear (clear already triggers render implicitly or via background set)
    if (actions.length > 0 && !actions.every(a => a.type === 'CLEAR_CANVAS')) {
        fabricCanvasInternalState.requestRenderAll();
    }

  }, [fabricCanvasInternalState]); // Dependency: fabricCanvasInternalState

  // The context value will provide the internal state for local consumption if needed,
  // but the primary source for other hooks/services should be the Zustand store.
  const value = { fabricCanvas: fabricCanvasInternalState, setFabricCanvas, dispatchWhiteboardAction };

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