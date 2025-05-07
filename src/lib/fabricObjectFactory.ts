// @ts-nocheck
// eslint-disable

import * as fabric from 'fabric';
import { Rect, Circle, Textbox, Line, Path, Group, Image as FabricImage, Object as FabricObject, Canvas, Pattern } from 'fabric';
import type { CanvasObjectSpec } from './types';
import { calculateAbsoluteCoords } from './whiteboardUtils';

// Re-add module augmentation for metadata property
// This helps TypeScript understand the custom metadata property we're adding
declare module 'fabric' {
    namespace fabric {
        interface Object {
            metadata?: { 
                id: string; 
                source?: 'assistant' | 'user' | string; 
                groupId?: string;
                pctCoords?: { xPct?: number; yPct?: number; widthPct?: number; heightPct?: number };
                [key: string]: any 
            };
        }
    }
}

/**
 * Internal helper to create synchronous objects without adding them to canvas.
 */
function createFabricObjectInternal(spec: CanvasObjectSpec, canvas?: Canvas): FabricObject | null {
    let fabricObject: FabricObject | null = null;
    
    // Calculate absolute coordinates if percentage coordinates are provided
    // Requires canvas dimensions. If canvas is not available, percent coords cannot be resolved yet.
    let coords = { x: spec.x, y: spec.y, width: spec.width, height: spec.height };
    let pctCoordsMetadata: NonNullable<CanvasObjectSpec['metadata']>['pctCoords'] | undefined = undefined;

    if (canvas && (spec.xPct !== undefined || spec.yPct !== undefined || spec.widthPct !== undefined || spec.heightPct !== undefined)) {
        const canvasWidth = canvas.getWidth();
        const canvasHeight = canvas.getHeight();
        const abs = calculateAbsoluteCoords(spec, canvasWidth, canvasHeight);
        coords = { x: abs.x, y: abs.y, width: abs.width, height: abs.height };
        pctCoordsMetadata = abs.metadataPctCoords;
    }
    
    const metadata: any = { 
        source: 'assistant', 
        ...(spec.metadata || {}),
        id: spec.id,
        ...(pctCoordsMetadata && { pctCoords: pctCoordsMetadata }),
        ...(spec.groupId && { groupId: spec.groupId })
    };

    const baseOptions = {
      left: coords.x,
      top: coords.y,
      fill: spec.fill,
      stroke: spec.stroke,
      strokeWidth: spec.strokeWidth,
      angle: spec.angle ?? 0,
      selectable: spec.selectable ?? true,
      evented: spec.evented ?? false,
      originX: 'left' as const,
      originY: 'top' as const,
    };

    try {
        switch (spec.kind) {
            case 'rect':
                fabricObject = new Rect({
                    ...baseOptions,
                    width: coords.width ?? 50,
                    height: coords.height ?? 50,
                    fill: spec.fill ?? 'transparent',
                    stroke: spec.stroke ?? 'black',
                    strokeWidth: spec.strokeWidth ?? 1,
                });
                break;
            case 'circle':
                fabricObject = new Circle({
                    ...baseOptions,
                    radius: spec.radius ?? 25,
                    fill: spec.fill ?? 'transparent',
                    stroke: spec.stroke ?? 'black',
                    strokeWidth: spec.strokeWidth ?? 1,
                });
                break;
            case 'textbox':
                fabricObject = new Textbox(spec.text ?? 'Text', {
                    ...baseOptions,
                    width: coords.width ?? 100,
                    ...(coords.height !== undefined && { height: coords.height }),
                    fontSize: spec.fontSize ?? 16,
                    fontFamily: spec.fontFamily ?? 'Arial',
                    fill: spec.fill ?? 'black',
                    strokeWidth: spec.strokeWidth ?? 0,
                    stroke: undefined,
                });
                break;
            case 'line': { 
                let linePoints: [number, number, number, number] = [0, 0, 50, 50];
                if (Array.isArray(spec.points)) {
                    if (spec.points.length === 4 && typeof spec.points[0] === 'number') {
                         linePoints = spec.points as [number, number, number, number];
                     } else if (spec.points.length === 2 && typeof spec.points[0] === 'object' && spec.points[0] !== null && 'x' in spec.points[0]) {
                         const p1 = spec.points[0] as { x: number; y: number };
                         const p2 = spec.points[1] as { x: number; y: number };
                         linePoints = [p1.x, p1.y, p2.x, p2.y];
                     }
                }
                fabricObject = new Line(linePoints, {
                  stroke: spec.stroke ?? 'black',
                  strokeWidth: spec.strokeWidth ?? 2,
                  angle: spec.angle ?? 0,
                  left: coords.x,
                  top: coords.y,
                  selectable: spec.selectable ?? true,
                  evented: spec.evented ?? false,
                });
                break;
            }
            case 'path': { 
                 if (typeof spec.points !== 'string') {
                     console.error(`[InternalFactory] Path requires string points, got:`, spec.points);
                     return null;
                 }
                 fabricObject = new Path(spec.points, {
                   ...baseOptions,
                   fill: spec.fill,
                   stroke: spec.stroke ?? 'black',
                   strokeWidth: spec.strokeWidth ?? 1,
                 });
                 break;
            }
            // IMPORTANT: Exclude 'group', 'image', 'arrow', 'radio', 'checkbox' or any complex/async types here
            default:
                console.warn(`[InternalFactory] Unsupported sync kind: ${spec.kind} (ID: ${spec.id})`);
                return null;
        }
        if (fabricObject) {
            (fabricObject as any).metadata = metadata;
        }
    } catch (error) {
        console.error(`[InternalFactory] Error creating object (kind: ${spec.kind}, id: ${spec.id}):`, error);
        return null;
    }
    return fabricObject;
}

/**
 * Creates and adds a Fabric.js object to the canvas based on the specification.
 * Handles asynchronous loading for images.
 */
export function createFabricObject(canvas: Canvas, spec: CanvasObjectSpec): void {
  let fabricObject: FabricObject | null = null;
  
  // Calculate absolute coordinates if percentage coordinates are provided
  const canvasWidth = canvas.getWidth();
  const canvasHeight = canvas.getHeight();
  const { x, y, width, height, metadataPctCoords } = calculateAbsoluteCoords(spec, canvasWidth, canvasHeight);

  const objectMetadata: any = { 
      source: 'assistant', 
      ...(spec.metadata || {}),
      id: spec.id,
      ...(metadataPctCoords && { pctCoords: metadataPctCoords }),
      ...(spec.groupId && { groupId: spec.groupId })
  };

  try {
    // Base options used by multiple kinds
    const baseOptions = {
      left: x,
      top: y,
      fill: spec.fill,
      stroke: spec.stroke,
      strokeWidth: spec.strokeWidth,
      angle: spec.angle ?? 0,
      selectable: spec.selectable ?? true,
      evented: spec.evented ?? false,
      originX: 'left' as const,
      originY: 'top' as const,
    };

    switch (spec.kind) {
      // --- Basic Shapes (Use Internal Helper for consistency, but create here) ---
      case 'rect':
      case 'circle':
      case 'textbox':
      case 'line':
      case 'path':
        fabricObject = createFabricObjectInternal(spec, canvas);
        break;

      // --- Complex Shapes / Async --- 
      case 'group': {
        console.log(`[fabricFactory] Creating group: ${spec.id}`);
        const groupObjects: FabricObject[] = [];
        if (Array.isArray(spec.objects)) { // Assuming group items are in spec.objects
          spec.objects.forEach((itemSpec: CanvasObjectSpec) => {
             // Recursively create objects *without* adding them to canvas yet
             const itemObject = createFabricObjectInternal(itemSpec, canvas);
             if (itemObject) {
                 groupObjects.push(itemObject);
             }
          });
        }
        if (groupObjects.length > 0) {
            fabricObject = new Group(groupObjects, {
                ...baseOptions, // Apply group-level position, angle etc.
                // Optional: Adjust left/top based on group contents if needed
            });
        } else {
            console.warn(`[fabricFactory] Group ${spec.id} has no valid objects.`);
        }
        break;
      }
      case 'image': { // Asynchronous
        if (!spec.src) {
            console.error(`Image object (ID: ${spec.id}) requires a 'src' property.`);
            return; // Don't proceed
        }
        console.log(`[fabricFactory] Loading image: ${spec.id} from ${spec.src}`);
        // @ts-expect-error Fabric.js type definitions for fromURL callback are incorrect; this works at runtime.
        FabricImage.fromURL(spec.src, (img) => {
            if (!img) {
                console.error(`Failed to load image (ID: ${spec.id}) from ${spec.src}`);
                return;
            }
            console.log(`[fabricFactory] Image loaded: ${spec.id}`);
            img.set({
                ...baseOptions,
                width: width,
                height: height,
            });
            (img as any).metadata = objectMetadata;
            canvas.add(img);
            canvas.requestRenderAll();
        }, {}); // Re-added empty options object
        return; // Exit void function - handled async
      }
      case 'arrow': {
          // Simple arrow: Line + potential arrowhead logic (future)
          let linePoints: [number, number, number, number] = [0, 0, 50, 0]; // Default horizontal arrow
          if (Array.isArray(spec.points)) { // Re-use line logic for points
              if (spec.points.length === 4 && typeof spec.points[0] === 'number') {
                 linePoints = spec.points as [number, number, number, number];
              } else if (spec.points.length === 2 && typeof spec.points[0] === 'object' && spec.points[0] !== null && 'x' in spec.points[0]) {
                 const p1 = spec.points[0] as { x: number; y: number };
                 const p2 = spec.points[1] as { x: number; y: number };
                 linePoints = [p1.x, p1.y, p2.x, p2.y];
             }
          }
          fabricObject = new Line(linePoints, {
              stroke: spec.stroke ?? 'black',
              strokeWidth: spec.strokeWidth ?? 2,
              angle: spec.angle ?? 0,
              left: x,
              top: y,
              selectable: spec.selectable ?? true,
              evented: spec.evented ?? false,
              // TODO: Add arrowhead marker (e.g., using Path or Triangle)
          });
          break;
      }
      case 'radio':
      case 'checkbox': {
          const isRadio = spec.kind === 'radio';
          const size = spec.size ?? 12; // Use spec.size or a default
          const shape = isRadio
              ? new Circle({ radius: size / 2, fill: 'white', stroke: 'black', strokeWidth: 1 })
              : new Rect({ width: size, height: size, fill: 'white', stroke: 'black', strokeWidth: 1, rx: 2, ry: 2 }); // Checkbox with slight rounding

          const label = spec.text ? new Textbox(spec.text, {
              left: size + 5, // Position label next to shape
              top: -size / 4, // Adjust vertical alignment
              fontSize: spec.fontSize ?? 14,
              fontFamily: spec.fontFamily ?? 'Arial',
              fill: spec.fill ?? 'black',
              selectable: false, // Label usually not selectable itself
              evented: false,
          }) : null;

          // Explicitly type the array to allow different object types
          const itemsToGroup: FabricObject[] = [shape]; 
          if (label) itemsToGroup.push(label);

          // Create the group using baseOptions for overall positioning
          fabricObject = new Group(itemsToGroup, {
              ...baseOptions,
              // Group positioning is controlled by baseOptions.left/top
              // Ensure sub-objects within the group use relative positioning (handled by default)
              selectable: spec.selectable ?? true, // Group selectability
              evented: spec.evented ?? true, // Allow clicks on the group
          });
          break;
      }
      default:
        // Removed exhaustive check for now, rely on warning
        // const _exhaustiveCheck: never = spec.kind; 
        console.warn(`[fabricFactory] Unsupported object kind: ${spec.kind} (ID: ${spec.id})`);
        return; // Exit void function
    }

    // Add the synchronously created object to canvas (if not handled async)
    if (fabricObject) {
      (fabricObject as any).metadata = objectMetadata; // Assign metadata
      canvas.add(fabricObject);
    }

  } catch (error) {
    console.error(`Error creating Fabric object (kind: ${spec.kind}, id: ${spec.id}):`, error);
  }
  // No explicit return needed (void function)
}

/**
 * Updates an existing Fabric.js object based on the provided specification.
 * Only updates properties present in the spec.
 */
export function updateFabricObject(obj: FabricObject, spec: Partial<CanvasObjectSpec>): void {
  if (!obj) return;
  const updateOptions: Partial<FabricObject> = {};
  let requiresCoordsUpdate = false;
  for (const key in spec) {
    if (!Object.prototype.hasOwnProperty.call(spec, key)) continue;
    const specKey = key as keyof CanvasObjectSpec;
    if (specKey === 'id' || specKey === 'kind') continue;
    if (specKey === 'metadata') {
      const currentMetadata = (obj as any).metadata || {};
      const newMetadata = { ...currentMetadata, ...(spec.metadata || {}) };
      (obj as any).metadata = newMetadata;
      continue;
    }
    if (specKey === 'x') {
      updateOptions.left = spec.x;
      requiresCoordsUpdate = true;
    } else if (specKey === 'y') {
      updateOptions.top = spec.y;
      requiresCoordsUpdate = true;
    } else if (specKey === 'points') {
      // Not directly settable, see note above
      continue;
    } else {
      (updateOptions as any)[specKey] = spec[specKey];
      if ([
        'left', 'top', 'width', 'height', 'scaleX', 'scaleY', 'angle', 'skewX', 'skewY', 'radius'
      ].includes(specKey)) {
        requiresCoordsUpdate = true;
      }
    }
  }
  if (Object.keys(updateOptions).length > 0) {
    obj.set(updateOptions);
  }
  if (requiresCoordsUpdate && typeof obj.setCoords === 'function') {
    obj.setCoords();
  }
}

/**
 * Deletes a Fabric.js object from the canvas by its ID (stored in metadata).
 */
export function deleteFabricObject(canvas: Canvas, idToDelete: string): boolean {
    const objects = canvas.getObjects();
    const objectToDelete = objects.find((obj: FabricObject) => (obj as any).metadata?.id === idToDelete);
    if (objectToDelete) {
        canvas.remove(objectToDelete);
        canvas.requestRenderAll();
        return true;
    }
    return false;
}

export function getCanvasStateAsSpecs(canvas: Canvas): CanvasObjectSpec[] {
    const specs: CanvasObjectSpec[] = [];
    const objects = canvas.getObjects();

    objects.forEach((obj: FabricObject) => {
        const metadata = (obj as any).metadata || {};
        const id = metadata.id;

        if (!id) {
            console.warn("[getCanvasStateAsSpecs] Object found without metadata.id, skipping:", obj);
            return;
        }

        let kind = obj.type || 'unknown';
        if (obj.type === 'i-text' || obj.type === 'text') kind = 'textbox';
        if (obj.type === 'image') kind = 'image';
        if (metadata.kind) {
            kind = metadata.kind;
        }

        const commonSpec: Partial<CanvasObjectSpec> = {
            id: id,
            kind: kind,
            x: obj.left,
            y: obj.top,
            width: obj.width ? obj.width * (obj.scaleX || 1) : undefined,
            height: obj.height ? obj.height * (obj.scaleY || 1) : undefined,
            fill: obj.fill instanceof Pattern ? undefined : obj.fill as string || undefined,
            stroke: obj.stroke as string || undefined,
            strokeWidth: obj.strokeWidth,
            angle: obj.angle,
            selectable: obj.selectable,
            evented: obj.evented,
            metadata: { ...metadata },
        };

        let objectSpec: CanvasObjectSpec;

        switch (obj.type) {
            case 'rect':
                objectSpec = { ...commonSpec, kind: 'rect' } as CanvasObjectSpec;
                break;
            case 'circle':
                const circle = obj as Circle;
                objectSpec = {
                    ...commonSpec,
                    kind: 'circle',
                    radius: circle.radius ? circle.radius * Math.max(obj.scaleX || 1, obj.scaleY || 1) : undefined,
                } as CanvasObjectSpec;
                break;
            case 'i-text':
            case 'textbox':
            case 'text':
                const textbox = obj as Textbox;
                objectSpec = {
                    ...commonSpec,
                    kind: 'textbox',
                    text: textbox.text,
                    fontSize: textbox.fontSize,
                    fontFamily: textbox.fontFamily,
                } as CanvasObjectSpec;
                break;
            case 'line':
                const line = obj as Line;
                objectSpec = {
                    ...commonSpec,
                    kind: 'line',
                    points: [line.x1!, line.y1!, line.x2!, line.y2!]
                } as CanvasObjectSpec;
                break;
            case 'path':
                const path = obj as Path;
                objectSpec = {
                    ...commonSpec,
                    kind: 'path',
                    points: path.path ? path.path.map((p: Array<string|number>) => p.join(' ')).join(' ') : undefined,
                } as CanvasObjectSpec;
                break;
            case 'image':
                const image = obj as FabricImage;
                objectSpec = {
                    ...commonSpec,
                    kind: 'image',
                    src: image.getSrc(),
                } as CanvasObjectSpec;
                break;
            case 'group':
                const group = obj as Group;
                objectSpec = {
                    ...commonSpec,
                    kind: 'group',
                    objects: group.getObjects().map((groupObj: FabricObject) => {
                        const groupObjMeta = (groupObj as any).metadata || {};
                        return {
                            id: groupObjMeta.id || `group-child-${Math.random().toString(36).substring(2,9)}`,
                            kind: groupObj.type || 'unknown',
                            x: groupObj.left,
                            y: groupObj.top,
                            width: groupObj.width ? groupObj.width * (groupObj.scaleX || 1) : undefined,
                            height: groupObj.height ? groupObj.height * (groupObj.scaleY || 1) : undefined,
                            metadata: groupObjMeta
                        } as CanvasObjectSpec;
                    })
                } as CanvasObjectSpec;
                break;
            default:
                console.warn(`[getCanvasStateAsSpecs] Unhandled Fabric object type: ${obj.type} for object ID: ${id}. Using common spec.`);
                objectSpec = commonSpec as CanvasObjectSpec;
                if (!objectSpec.kind) objectSpec.kind = 'unknown';
        }

        if (metadata.pctCoords) {
            objectSpec.xPct = metadata.pctCoords.xPct;
            objectSpec.yPct = metadata.pctCoords.yPct;
            objectSpec.widthPct = metadata.pctCoords.widthPct;
            objectSpec.heightPct = metadata.pctCoords.heightPct;
        }
        if (metadata.groupId) {
            objectSpec.groupId = metadata.groupId;
        }

        specs.push(objectSpec);
    });

    return specs;
} 