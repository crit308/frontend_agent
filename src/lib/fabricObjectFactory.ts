import * as fabric from 'fabric';
import { CanvasObjectSpec } from '@/lib/types'; // Import shared type

// Removing module augmentation for now due to issues with namespace import
/*
declare module 'fabric' {
    namespace fabric {
        interface Object {
            metadata?: { id: string; source?: 'assistant' | 'user' | string; [key: string]: any };
        }
    }
}
*/

export function createFabricObject(spec: CanvasObjectSpec): fabric.Object {
    let fabricObj: fabric.Object;

    // Common options applicable to most objects
    const baseOptions: Partial<fabric.Object> = {
        left: spec.x,
        top: spec.y,
        fill: spec.fill || '#aabbcc', // Default fill
        stroke: spec.stroke || '#000000',
        strokeWidth: spec.strokeWidth || 1,
        angle: spec.angle || 0,
        selectable: spec.selectable ?? true,
        evented: spec.evented ?? true,
        // Remove metadata from here
        // Origin points can affect positioning, default is top-left
        // originX: 'left',
        // originY: 'top',
    };

    try {
        switch (spec.kind) {
            case 'rect':
                fabricObj = new fabric.Rect({
                    ...baseOptions,
                    width: spec.width || 50,
                    height: spec.height || 50,
                });
                break;
            case 'circle':
                fabricObj = new fabric.Circle({
                    ...baseOptions,
                    radius: spec.radius || 25,
                });
                break;
            case 'textbox': // Use Textbox for editable text
                fabricObj = new fabric.Textbox(spec.text || 'Text', {
                    ...baseOptions,
                    width: spec.width || 150, // Textbox often needs an initial width
                    fontSize: spec.fontSize || 16,
                    fontFamily: spec.fontFamily || 'Arial',
                    fill: spec.fill || '#333333', // Default text fill can differ
                });
                break;
            case 'line':
                // Fabric line constructor takes [x1, y1, x2, y2]
                // spec.points could be [x1, y1, x2, y2] or [{x: x1, y: y1}, {x: x2, y: y2}]
                let linePoints: number[];
                if (Array.isArray(spec.points) && spec.points.length === 4 && typeof spec.points[0] === 'number') {
                    linePoints = spec.points as number[];
                } else if (Array.isArray(spec.points) && spec.points.length === 2 && typeof spec.points[0] === 'object') {
                    const p1 = spec.points[0] as { x: number, y: number };
                    const p2 = spec.points[1] as { x: number, y: number };
                    linePoints = [p1.x, p1.y, p2.x, p2.y];
                } else {
                    console.warn(`[fabricFactory] Invalid points for line ID ${spec.id}. Using default line.`);
                    linePoints = [spec.x, spec.y, spec.x + 50, spec.y + 50]; // Default line from spec x/y
                }
                // Cast linePoints to the expected tuple type
                fabricObj = new fabric.Line(linePoints as [number, number, number, number], {
                    ...baseOptions, // Base options like stroke, strokeWidth apply
                    // Note: left/top in baseOptions set the *bounding box* top-left for Line.
                    // The line points themselves define the line position relative to the canvas origin.
                });
                break;
             case 'path':
                 // Assuming spec.points is a string like "M 0 0 L 100 100 Z"
                 if (typeof spec.points === 'string') {
                     fabricObj = new fabric.Path(spec.points, {
                         ...baseOptions,
                     });
                 } else {
                     console.warn(`[fabricFactory] Invalid points (expected string) for path ID ${spec.id}. Creating default rect.`);
                     fabricObj = new fabric.Rect({ ...baseOptions, width: 30, height: 30, fill: 'red' });
                 }
                 break;
            // Add cases for 'polygon', etc. as needed
            default:
                console.warn(`[fabricFactory] Unsupported object kind: ${spec.kind} for ID ${spec.id}. Creating simple rect.`);
                fabricObj = new fabric.Rect({ ...baseOptions, width: 50, height: 50 });
        }
    } catch (error) {
        console.error(`[fabricFactory] Error creating object ID ${spec.id} (Kind: ${spec.kind}):`, error);
        fabricObj = new fabric.Rect({ left: 0, top: 0, width: 10, height: 10, fill: 'red' });
        fabricObj.set('metadata', { id: spec.id, error: true, kind: spec.kind });
    }

    // Set metadata using obj.set() after object is created, if not already set by error fallback
    if (fabricObj && !fabricObj.get('metadata')) {
         fabricObj.set('metadata', { ...(spec.metadata || {}), id: spec.id });
    }

    return fabricObj;
}

// Helper to update existing objects
export function updateFabricObject(obj: fabric.Object, spec: Partial<CanvasObjectSpec>): void {
     // Create an options object excluding non-updatable/special keys - using Partial<fabric.Object>
     const updateOptions: Partial<fabric.Object> = {};
     let requiresRerender = false;

     for (const key in spec) {
         if (key !== 'id' && key !== 'kind' && key !== 'metadata') {
              // Only assign if the property exists on the object
              if (Object.prototype.hasOwnProperty.call(obj, key)) {
                // @ts-ignore
                updateOptions[key] = spec[key];
                requiresRerender = true;
              }
         }
     }

     if (Object.keys(updateOptions).length > 0) {
         console.log(`[fabricFactory] Updating object ID ${obj.get('metadata')?.id} with options:`, updateOptions);
         obj.set(updateOptions);
         obj.setCoords();
     }

     // Update metadata separately if provided (merge with existing)
     if (spec.metadata) {
         const currentMetadata = obj.get('metadata') || {};
         obj.set('metadata', { ...currentMetadata, ...spec.metadata, id: currentMetadata?.id || spec.id });
         requiresRerender = true;
         console.log(`[fabricFactory] Updated metadata for object ID ${obj.get('metadata')?.id}`);
     }
}

// Helper to delete objects by custom metadata ID
export function deleteFabricObject(canvas: fabric.Canvas, idToDelete: string): void {
     const objectsToDelete = canvas.getObjects().filter(o => o.get('metadata')?.id === idToDelete);
     if (objectsToDelete.length > 0) {
         console.log(`[fabricFactory] Deleting ${objectsToDelete.length} object(s) with ID ${idToDelete}`);
         objectsToDelete.forEach(obj => canvas.remove(obj));
         canvas.requestRenderAll(); // Request render after removal
     } else {
         console.warn(`[fabricFactory] No objects found with ID ${idToDelete} to delete.`);
     }
} 