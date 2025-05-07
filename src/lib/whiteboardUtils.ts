import {
    Canvas,
    Object as FabricObject,
    Rect,
    Circle,
    Textbox,
    Line,
    Path,
    Group,
    Image as FabricImage,
    Pattern
} from 'fabric';
import type { CanvasObjectSpec } from './types';

export function calculateAbsoluteCoords(
    spec: CanvasObjectSpec,
    canvasWidth: number,
    canvasHeight: number
): { x: number; y: number; width?: number; height?: number; metadataPctCoords?: NonNullable<CanvasObjectSpec['metadata']>['pctCoords'] } {
    let x = spec.x;
    let y = spec.y;
    let width = spec.width;
    let height = spec.height;
    const pctCoordsStore: NonNullable<CanvasObjectSpec['metadata']>['pctCoords'] = {};

    if (spec.xPct !== undefined && spec.xPct !== null) {
        x = spec.xPct * canvasWidth;
        pctCoordsStore.xPct = spec.xPct;
    }
    if (spec.yPct !== undefined && spec.yPct !== null) {
        y = spec.yPct * canvasHeight;
        pctCoordsStore.yPct = spec.yPct;
    }
    if (spec.widthPct !== undefined && spec.widthPct !== null && width === undefined) {
        width = spec.widthPct * canvasWidth;
        pctCoordsStore.widthPct = spec.widthPct;
    }
    if (spec.heightPct !== undefined && spec.heightPct !== null && height === undefined) {
        height = spec.heightPct * canvasHeight;
        pctCoordsStore.heightPct = spec.heightPct;
    }

    const finalX = x === undefined ? 0 : x;
    const finalY = y === undefined ? 0 : y;
    
    const hasPctCoords = Object.keys(pctCoordsStore).length > 0;

    return {
        x: finalX,
        y: finalY,
        width,
        height,
        ...(hasPctCoords && { metadataPctCoords: pctCoordsStore })
    };
}

/**
 * Exports the current state of the Fabric.js canvas as an array of CanvasObjectSpec.
 * This function attempts to convert Fabric objects back into the serializable spec format.
 */
export function getCanvasStateAsSpecs(canvas: Canvas): CanvasObjectSpec[] {
    const specs: CanvasObjectSpec[] = [];
    if (!canvas) return specs;

    canvas.getObjects().forEach((obj: FabricObject) => {
        const metadata = (obj as any).metadata || {}; // Ensure metadata exists
        const id = metadata.id as string | undefined;

        if (!id) {
            console.warn("[getCanvasStateAsSpecs] Object found without metadata.id, skipping:", obj);
            return; // Skip objects without an ID in metadata
        }

        // Determine the 'kind' of the object.
        // Fabric's obj.type is the most direct, but we map it to our CanvasObjectSpec's 'kind'.
        // Custom kinds (like 'arrow', 'latex_svg') should ideally be stored in metadata.kind.
        let kind = metadata.kind || obj.type || 'unknown';
        if (obj.type === 'i-text' || obj.type === 'text') kind = 'textbox'; // Normalize Fabric text types to 'textbox'
        if (obj.type === 'image') kind = 'image';
        if (obj.type === 'group' && !metadata.kind) kind = 'group'; // if it's a fabric group and no specific metadata.kind
        
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
            metadata: {
                id: id,
                source: metadata.source,
                groupId: metadata.groupId,
                pctCoords: metadata.pctCoords,
                latex: metadata.latex,
                layoutSpec: metadata.layoutSpec,
                ...(metadata || {}),
            },
        };

        let objectSpec: CanvasObjectSpec;

        switch (obj.type) { // Use obj.type for Fabric-specific properties
            case 'rect':
                objectSpec = { ...commonSpec, kind: 'rect' } as CanvasObjectSpec;
                break;
            case 'circle':
                const circle = obj as Circle;
                objectSpec = {
                    ...commonSpec,
                    kind: 'circle',
                    radius: circle.radius ? circle.radius * Math.max(circle.scaleX || 1, circle.scaleY || 1) : undefined,
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
                    // fill is in commonSpec, specific text properties like fontWeight, textAlign can be added if needed
                } as CanvasObjectSpec;
                break;
            case 'line':
                const line = obj as Line;
                objectSpec = {
                    ...commonSpec,
                    kind: 'line',
                    points: [line.x1!, line.y1!, line.x2!, line.y2!], // These are relative to object's origin (left, top)
                } as CanvasObjectSpec;
                break;
            case 'path':
                const path = obj as Path;
                objectSpec = {
                    ...commonSpec,
                    kind: 'path',
                    points: path.path ? path.path.map((p: Array<string | number>) => p.join(' ')).join(' ') : undefined,
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
                    kind: commonSpec.kind, // This should be 'group' or metadata.kind if set
                    objects: group.getObjects().map(groupObj => getCanvasStateAsSpecs({ getObjects: () => [groupObj] } as any)[0]).filter(s => s),
                    // The above is a recursive call. It might need a more direct conversion or careful handling
                    // of relative vs absolute positioning of child objects if they are to be reconstructed flatly.
                    // For now, it tries to convert each child object back to a spec.
                } as CanvasObjectSpec;
                break;
            default:
                console.warn(`[getCanvasStateAsSpecs] Unhandled Fabric object type: ${obj.type} for ID: ${id}. Using common spec.`);
                objectSpec = commonSpec as CanvasObjectSpec;
                if (!objectSpec.kind) objectSpec.kind = 'unknown';
        }

        // Restore percentage-based dimensions if they were stored in metadata
        if (commonSpec.metadata?.pctCoords) {
            objectSpec.xPct = commonSpec.metadata.pctCoords.xPct;
            objectSpec.yPct = commonSpec.metadata.pctCoords.yPct;
            objectSpec.widthPct = commonSpec.metadata.pctCoords.widthPct;
            objectSpec.heightPct = commonSpec.metadata.pctCoords.heightPct;
        }
        if (commonSpec.metadata?.groupId) {
            objectSpec.groupId = commonSpec.metadata.groupId;
        }

        specs.push(objectSpec);
    });

    return specs;
} 