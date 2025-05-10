'use client';

import React, { createContext, useContext, useState, useRef, useCallback, ReactNode, useEffect } from 'react';
import * as fabric from 'fabric';
import { WhiteboardAction, CanvasObjectSpec } from '@/lib/types'; // Added CanvasObjectSpec for Update
import { createFabricObject, updateFabricObject, deleteFabricObject } from '@/lib/fabricObjectFactory'; // Import factory (to be created)
import { useSessionStore } from '@/store/sessionStore'; // Import useSessionStore
import { renderLatexToSvg } from '@/lib/whiteboardUtils'; // Added for LaTeX rendering
import { calculateAbsoluteCoords } from '@/lib/whiteboardUtils'; // Ensure this is imported if used for coords
import { getGraphLayout } from '@/lib/whiteboardUtils'; // Added for graph layout
import type { NodeSpec, EdgeSpec } from '@/lib/types'; // Added for graph layout

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
  const [actionQueue, setActionQueue] = useState<WhiteboardAction[]>([]); // NEW: queue for incoming actions before canvas ready
  const [isCanvasReady, setIsCanvasReady] = useState(false); // NEW: readiness flag

  const setFabricCanvas = useCallback((canvas: fabric.Canvas | null) => {
     console.log("[WhiteboardProvider] Setting Fabric Canvas instance in provider state:", canvas ? 'Instance received' : 'Instance cleared');
     setFabricCanvasInternalState(canvas);
     // Also set it in the global Zustand store
     setFabricCanvasInstanceInStore(canvas);
     console.log("[WhiteboardProvider] Fabric Canvas instance also set in Zustand store.");
     setIsCanvasReady(!!canvas); // update readiness flag
  }, [setFabricCanvasInstanceInStore]);

  const dispatchWhiteboardAction = useCallback(async (actionOrActions: WhiteboardAction | WhiteboardAction[]) => {
    const actions = Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions];

    // If canvas not ready, queue the actions and return
    if (!fabricCanvasInternalState || !isCanvasReady) {
      console.warn(`[WhiteboardProvider] Canvas not ready. Queuing ${actions.length} actions.`);
      setActionQueue(prev => [...prev, ...actions]);
      return;
    }

    console.log(`[WhiteboardProvider] Dispatching ${actions.length} actions:`, actions);

    for (const action of actions) {
      try {
           switch (action.type) {
             case 'ADD_OBJECTS':
               // ----- NEW: If incoming objects represent a new MCQ question, clear the previous one -----
               const incomingLooksLikeQuestion = action.objects.some(obj =>
                   obj.metadata?.role === 'question' || obj.kind === 'radio'
               );

               if (incomingLooksLikeQuestion) {
                   const objsToRemove: fabric.Object[] = [];
                   const questionRelatedRoles = new Set(['question', 'option_selector', 'option_label']);

                   fabricCanvasInternalState.getObjects().forEach(obj => {
                       const md = (obj as any).metadata || {};
                       if (md.source === 'assistant') {
                           if (questionRelatedRoles.has(md.role) || md.kind === 'radio_option_group') {
                               objsToRemove.push(obj as fabric.Object);
                           }
                       }
                   });

                   if (objsToRemove.length) {
                       console.log(`[WhiteboardProvider] Clearing ${objsToRemove.length} previous question objects before adding new question.`);
                       objsToRemove.forEach(o => fabricCanvasInternalState.remove(o));
                       fabricCanvasInternalState.requestRenderAll();
                   }
               }

               for (const spec of action.objects) {
                 if (spec.kind === 'latex_svg') {
                   if (spec.metadata?.latex) {
                     try {
                       const htmlSvgString = await renderLatexToSvg(spec.metadata.latex);
                       fabric.loadSVGFromString(htmlSvgString, (loadedObjects: any, options: any) => {
                         const fabricObjects = loadedObjects as fabric.Object[]; // Cast to fabric.Object[]
                         if (fabricObjects && fabricObjects.length > 0) {
                           const group = new fabric.Group(fabricObjects, {
                             left: (typeof spec.x === 'number') ? spec.x : 0,
                             top: (typeof spec.y === 'number') ? spec.y : 0,
                           });

                           const currentSpecX = spec.x; // Capture spec.x for type guarding
                           const currentSpecY = spec.y; // Capture spec.y for type guarding

                           const coordSpec: Partial<CanvasObjectSpec> & { xPct?: number, yPct?: number } = { 
                               ...spec,
                               x: (typeof currentSpecX === 'number') ? currentSpecX : 0,
                               y: (typeof currentSpecY === 'number') ? currentSpecY : 0,
                           }; 

                           if (typeof currentSpecX === 'string' && currentSpecX.endsWith('%')) {
                               coordSpec.xPct = parseFloat(currentSpecX) / 100;
                           }
                           if (typeof currentSpecY === 'string' && currentSpecY.endsWith('%')) {
                               coordSpec.yPct = parseFloat(currentSpecY) / 100;
                           }

                           if (fabricCanvasInternalState && fabricCanvasInternalState.width && fabricCanvasInternalState.height) {
                             const { x: absX, y: absY } = calculateAbsoluteCoords(
                                 coordSpec as CanvasObjectSpec,
                                 fabricCanvasInternalState.width,
                                 fabricCanvasInternalState.height
                             );
                             group.set({ left: absX, top: absY });
                           } else {
                               console.warn('[WhiteboardProvider] Canvas dimensions not available for absolute coordinate calculation for LaTeX object.');
                               group.set({ 
                                   left: coordSpec.xPct ? coordSpec.xPct * (fabricCanvasInternalState?.width || 0) : coordSpec.x,
                                   top: coordSpec.yPct ? coordSpec.yPct * (fabricCanvasInternalState?.height || 0) : coordSpec.y
                               });
                           }
                           
                           (group as any).metadata = { 
                               ...spec.metadata, 
                               id: spec.id, 
                               source: spec.metadata?.source,
                               fabricObject: group,
                               kind: 'latex_svg'
                           };
                           fabricCanvasInternalState.add(group);
                         } else {
                           console.warn('[WhiteboardProvider] No objects loaded from SVG/HTML for LaTeX spec:', spec);
                         }
                       });
                     } catch (error) {
                       console.error('[WhiteboardProvider] Error rendering or loading LaTeX SVG/HTML:', error, spec);
                     }
                   } else {
                     console.warn('[WhiteboardProvider] LaTeX SVG spec missing metadata.latex:', spec);
                   }
                 } else if (spec.kind === 'graph_layout') {
                   if (spec.metadata?.layoutSpec && fabricCanvasInternalState) {
                     const layoutSpec = spec.metadata.layoutSpec as { nodes: NodeSpec[], edges: EdgeSpec[], layoutType?: string, graphId?: string };
                     if (layoutSpec.nodes && layoutSpec.edges) {
                       try {
                         const nodePositions = await getGraphLayout(layoutSpec.nodes, layoutSpec.edges, layoutSpec.layoutType || 'layered');
                         const fabricObjectsInGraph: fabric.Object[] = [];
                         const canvas = fabricCanvasInternalState; // Alias for clarity

                         // Create Fabric objects for nodes
                         layoutSpec.nodes.forEach(nodeSpec => {
                           const pos = nodePositions[nodeSpec.id];
                           if (pos) {
                             const nodeRect = new fabric.Rect({
                               left: pos.x,
                               top: pos.y,
                               width: nodeSpec.width,
                               height: nodeSpec.height,
                               fill: 'lightblue', // Default fill
                               stroke: 'blue',    // Default stroke
                               strokeWidth: 2,
                               originX: 'left', 
                               originY: 'top',
                             });
                             const nodeLabel = new fabric.Textbox(nodeSpec.label || nodeSpec.id, {
                               left: pos.x + nodeSpec.width / 2,
                               top: pos.y + nodeSpec.height / 2,
                               width: nodeSpec.width - 10, // Padding
                               fontSize: 16,
                               textAlign: 'center',
                               originX: 'center',
                               originY: 'center',
                               selectable: false,
                             });
                             const nodeGroup = new fabric.Group([nodeRect, nodeLabel], {
                               left: pos.x,
                               top: pos.y,
                               selectable: true,
                               evented: true,
                             });
                             (nodeGroup as any).metadata = {
                               id: nodeSpec.id,
                               kind: 'graph_node',
                               parentGraphId: spec.id,
                               ...(nodeSpec.metadata || {})
                             };
                             fabricObjectsInGraph.push(nodeGroup);
                           }
                         });

                         // Create Fabric objects for edges
                         layoutSpec.edges.forEach(edgeSpec => {
                           const sourcePos = nodePositions[edgeSpec.source];
                           const targetPos = nodePositions[edgeSpec.target];
                           const sourceNode = layoutSpec.nodes.find(n => n.id === edgeSpec.source);
                           const targetNode = layoutSpec.nodes.find(n => n.id === edgeSpec.target);

                           if (sourcePos && targetPos && sourceNode && targetNode) {
                             // Calculate center points of nodes for edge connection
                             const x1 = sourcePos.x + sourceNode.width / 2;
                             const y1 = sourcePos.y + sourceNode.height / 2;
                             const x2 = targetPos.x + targetNode.width / 2;
                             const y2 = targetPos.y + targetNode.height / 2;

                             const edgeLine = new fabric.Line([x1, y1, x2, y2], {
                               stroke: 'gray',
                               strokeWidth: 2,
                               selectable: false,
                               evented: false,
                             });
                             (edgeLine as any).metadata = {
                               id: edgeSpec.id,
                               kind: 'graph_edge',
                               parentGraphId: spec.id,
                               ...(edgeSpec.metadata || {})
                             };
                             fabricObjectsInGraph.push(edgeLine);
                             // TODO: Add arrowheads if needed
                           }
                         });
                         
                         // Optionally, group all created nodes and edges into one encompassing group
                         if (fabricObjectsInGraph.length > 0) {
                           if (spec.metadata?.combineIntoGroup || true) { // Default to grouping them
                               const entireGraphGroup = new fabric.Group(fabricObjectsInGraph, {
                                   left: (spec.x as number) || 0,
                                   top: (spec.y as number) || 0,
                               });
                               (entireGraphGroup as any).metadata = {
                                   id: spec.id,
                                   kind: 'graph_group',
                                   source: spec.metadata?.source,
                                   layoutAlgorithm: layoutSpec.layoutType || 'layered',
                               };
                               canvas.add(entireGraphGroup);
                           } else {
                                fabricObjectsInGraph.forEach(obj => canvas.add(obj));
                           }
                         }

                       } catch (error) {
                         console.error('[WhiteboardProvider] Error processing graph layout:', error, spec);
                       }
                     } else {
                       console.warn('[WhiteboardProvider] Graph layout spec missing nodes or edges:', spec);
                     }
                   } else {
                     console.warn('[WhiteboardProvider] Graph layout spec missing metadata.layoutSpec or canvas not ready:', spec);
                   }
                 } else {
                   createFabricObject(fabricCanvasInternalState, spec);
                 }
               }
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
             case 'GROUP_OBJECTS': {
                const objectsToGroup = fabricCanvasInternalState.getObjects().filter((obj: any) => 
                    action.objectIds.includes(obj.metadata?.id)
                );
                if (objectsToGroup.length !== action.objectIds.length) {
                    console.warn(`[WhiteboardProvider] GROUP_OBJECTS: Not all specified object IDs found. Found ${objectsToGroup.length} of ${action.objectIds.length}.`);
                    // Potentially filter out already grouped items if necessary
                }
                if (objectsToGroup.length > 0) {
                    // Remove individual objects from canvas before grouping
                    objectsToGroup.forEach(obj => fabricCanvasInternalState.remove(obj));

                    const group = new fabric.Group(objectsToGroup, {
                        // fabric.js calculates left/top of group based on its contents
                        // an explicit left/top in spec might be for initial absolute placement if desired
                    });
                    // Assign groupId to the group's metadata
                    (group as any).metadata = {
                        ...(group as any).metadata, // Preserve any existing metadata on the group if fabric adds some
                        id: action.groupId, // This is the group's own ID
                        isGroup: true, // Custom flag to identify this as a managed group
                        // store constituent object IDs if needed for ungrouping later
                        // groupedObjectIds: action.objectIds 
                    };
                    fabricCanvasInternalState.add(group);
                    fabricCanvasInternalState.setActiveObject(group); // Optionally make the new group active
                } else {
                    console.warn(`[WhiteboardProvider] GROUP_OBJECTS: No valid objects found to group for groupId ${action.groupId}.`);
                }
                break;
            }
            case 'MOVE_GROUP': {
                const groupToMove = fabricCanvasInternalState.getObjects().find((obj: any) => 
                    obj.metadata?.id === action.groupId && (obj.metadata?.isGroup || obj.type === 'group')
                ) as fabric.Group | undefined;

                if (groupToMove) {
                    groupToMove.set({
                        left: (groupToMove.left ?? 0) + action.dx,
                        top: (groupToMove.top ?? 0) + action.dy,
                    });
                    groupToMove.setCoords(); // Important after position change
                } else {
                    console.warn(`[WhiteboardProvider] MOVE_GROUP: Group with ID ${action.groupId} not found.`);
                }
                break;
            }
            case 'DELETE_GROUP': {
                const groupToDelete = fabricCanvasInternalState.getObjects().find((obj: any) => 
                    obj.metadata?.id === action.groupId && (obj.metadata?.isGroup || obj.type === 'group')
                );
                if (groupToDelete) {
                    // Option 1: Remove the group directly (children are removed with it by fabric)
                    fabricCanvasInternalState.remove(groupToDelete);

                    // Option 2: If ungrouping is needed before deletion (e.g. to return children to canvas)
                    // if (groupToDelete.type === 'group') {
                    //   (groupToDelete as fabric.Group).forEachObject(obj => {
                    //     // fabricCanvasInternalState.add(obj); // Add back to canvas if needed, adjusting coords
                    //   });
                    //   (groupToDelete as fabric.Group).destroy(); // Ungroup
                    //   fabricCanvasInternalState.remove(groupToDelete); // Then remove the empty group
                    // }
                } else {
                    console.warn(`[WhiteboardProvider] DELETE_GROUP: Group with ID ${action.groupId} not found.`);
                }
                break;
            }
             default:
               // type assertion to help TS narrow down 'action'
               const unhandledAction = action as any;
               console.warn(`[WhiteboardProvider] Unhandled action type: ${unhandledAction.type}`);
           }
      } catch (error) {
           console.error("[WhiteboardProvider] Error dispatching whiteboard action:", action, error);
      }
    }

    // Render changes after all actions in the batch have been processed
    if (actions.length > 0 && !actions.every(a => a.type === 'CLEAR_CANVAS')) {
      fabricCanvasInternalState.requestRenderAll();
    }

  }, [fabricCanvasInternalState, isCanvasReady]);

  // NEW EFFECT: When canvas becomes ready, flush any queued actions
  useEffect(() => {
     if (isCanvasReady && fabricCanvasInternalState && actionQueue.length > 0) {
        console.log(`[WhiteboardProvider] Processing ${actionQueue.length} queued actions.`);
        const queued = [...actionQueue];
        setActionQueue([]); // clear queue BEFORE processing to avoid recursive queueing
        dispatchWhiteboardAction(queued);
     }
  }, [isCanvasReady, fabricCanvasInternalState, actionQueue, dispatchWhiteboardAction]);

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