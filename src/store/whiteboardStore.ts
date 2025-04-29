import { create } from 'zustand';
import { SVG, Element as SVGElement, G, Svg, Text } from '@svgdotjs/svg.js'; // Import necessary types/classes and Svg type

// Get the instance type correctly - It should be Svg
// type SvgInstance = InstanceType<typeof SVG>; // Incorrect

// Define the state structure
interface WhiteboardState {
  // Reference to the SVG.js drawing instance
  svgInstance: Svg | null; // Use Svg type
  setSvgInstance: (instance: Svg | null) => void; // Use Svg type

  // Actions to add elements
  addChatBubble: (text: string, options?: { x?: number; y?: number, role?: 'user' | 'assistant' }) => void;
  addContentBlock: (text: string, type: 'explanation' | 'question' | 'feedback' | string, options?: { x?: number; y?: number }) => void; // New action
  getAndUpdateNextBubblePosition: (role: 'user' | 'assistant') => { x: number; y: number };
  getAndUpdateNextContentBlockPosition: () => { x: number; y: number }; // New helper for positioning

  // Queue for bubbles that were attempted before svgInstance was ready
  _pendingBubbles: Array<{ text: string; options: { x?: number; y?: number; role?: 'user' | 'assistant' } }>; // internal
  _pendingBlocks: Array<{ text: string; type: string; options: { x?: number; y?: number } }>; // internal
}

// Keep track of the next position for bubbles (simple vertical stacking)
let nextUserBubbleY = 20;
let nextAssistantBubbleY = 20;
const bubblePadding = 15;
const bubbleMargin = 10;
const userBubbleX = 20;
const assistantBubbleX = 300; // Position assistant bubbles to the right

// Positioning for content blocks (e.g., centered column)
let nextContentBlockY = 20;
const contentBlockPadding = 20;
const contentBlockMargin = 15;
const contentBlockX = 550; // Position further to the right or center
const contentBlockWidth = 350; // Define a width for content blocks

// Create the store
export const useWhiteboardStore = create<WhiteboardState>((set, get) => ({
  svgInstance: null,
  setSvgInstance: (instance) => {
    if (instance) {
      // First update store so that svgInstance is available when flushing queue
      set({ svgInstance: instance });

      const pending = get()._pendingBubbles;
      if (pending.length) {
        console.log(`[Whiteboard Store] Processing ${pending.length} pending bubbles.`); // Log pending processing
        pending.forEach(item => {
          get().addChatBubble(item.text, item.options);
        });
        pending.length = 0;
      }

      const pendingBlocks = get()._pendingBlocks;
      if (pendingBlocks.length) {
        console.log(`[Whiteboard Store] Processing ${pendingBlocks.length} pending content blocks.`); // Log pending processing
        pendingBlocks.forEach(item => {
          get().addContentBlock(item.text, item.type as any, item.options);
        });
        pendingBlocks.length = 0;
      }

      return; // early return to avoid duplicate set below
    }
    set({ svgInstance: instance });
  },

  getAndUpdateNextBubblePosition: (role) => {
      let position: { x: number, y: number };
      if (role === 'user') {
          position = { x: userBubbleX, y: nextUserBubbleY };
          // Update next Y - This part will be incorrect as height isn't known yet
          // We will update Y position *after* rendering in addChatBubble
      } else {
          position = { x: assistantBubbleX, y: nextAssistantBubbleY };
          // Update next Y - To be done in addChatBubble
      }
      return position;
  },

  getAndUpdateNextContentBlockPosition: () => {
      const position = { x: contentBlockX, y: nextContentBlockY };
      // Y position will be updated after rendering in addContentBlock
      return position;
  },

  addChatBubble: (text, options = {}) => {
    const svg = get().svgInstance;
    if (!svg) {
      // SVG not ready yet – queue action and return
      get()._pendingBubbles.push({ text, options: { ...options, role: options.role || 'assistant' } });
      console.warn('Whiteboard Store: SVG instance not available. Queuing bubble until ready.'); // Already logs queuing
      return;
    }
    
    const { role = 'assistant' } = options;
    let { x, y } = options;

    // Get initial position if not provided
    if (x === undefined || y === undefined) {
        const initialPos = get().getAndUpdateNextBubblePosition(role);
        x = initialPos.x;
        y = initialPos.y;
    }

    console.log(`[Whiteboard Store] Adding ${role} bubble: "${text}" at ~(${x}, ${y})`);

    // Create a group for the bubble
    const group = svg.group().attr('data-role', role);

    // Add the text element first to measure it
    const textElement = group.text(function(add: Text) {
        // Split text into lines (simple example, might need smarter wrapping)
        const maxWidth = 250; // Max width before wrapping
        const words = text.split(' ');
        let currentLine = '';
        words.forEach(word => {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            // Use a temporary text element to measure width (hacky but common)
            const tempText = svg.text(testLine).font({ family: 'Arial', size: 14 }).opacity(0);
            if (tempText.bbox().width > maxWidth && currentLine) {
                add.tspan(currentLine).newLine();
                currentLine = word;
            } else {
                currentLine = testLine;
            }
            tempText.remove(); // Clean up temporary element
        });
        if (currentLine) {
            add.tspan(currentLine).newLine();
        }
    })
    .font({ family: 'Arial', size: 14, anchor: 'start' })
    .fill(role === 'user' ? '#FFFFFF' : '#333')
    .move(bubblePadding, bubblePadding); // Padding within the rect

    // Get the bounding box of the text AFTER rendering tspans
    const textBBox = textElement.bbox();

    // Add a rectangle background based on text size
    const rectWidth = textBBox.width + 2 * bubblePadding;
    const rectHeight = textBBox.height + 2 * bubblePadding;
    console.log(`[Whiteboard Store] Bubble bbox calculated: w=${rectWidth.toFixed(2)}, h=${rectHeight.toFixed(2)}`); // Log bbox
    const rect = group.rect(rectWidth, rectHeight)
      .fill(role === 'user' ? '#007bff' : '#f0f0f0') // User blue, Assistant light gray
      .radius(10);

    // Ensure text is on top of the rectangle
    textElement.front();

    // Now move the group to the calculated position
    group.move(x, y);

    // Update the next Y position based on the actual height of the bubble
    if (role === 'user') {
        nextUserBubbleY = y + rectHeight + bubbleMargin;
    } else {
        nextAssistantBubbleY = y + rectHeight + bubbleMargin;
    }

    console.log(`[Whiteboard Store] Bubble added. Next ${role} Y: ${role === 'user' ? nextUserBubbleY : nextAssistantBubbleY}`);
  },

  // Action to add Explanation/Question/Feedback blocks
  addContentBlock: (text, type, options = {}) => {
    const svg = get().svgInstance;
    if (!svg) {
      // Queue and return
      get()._pendingBlocks.push({ text, type, options });
      console.warn('Whiteboard Store: SVG instance not available. Queuing content block until ready.'); // Already logs queuing
      return;
    }

    let { x, y } = options;
    if (x === undefined || y === undefined) {
        const initialPos = get().getAndUpdateNextContentBlockPosition();
        x = initialPos.x;
        y = initialPos.y;
    }

    console.log(`[Whiteboard Store] Adding content block (${type}): "${text.substring(0, 50)}..." at ~(${x}, ${y})`);

    const group = svg.group().attr('data-type', type);

    // Add text with wrapping
    const textElement = group.text(function(add: Text) {
        const words = text.split(' ');
        let currentLine = '';
        words.forEach(word => {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const tempText = svg.text(testLine).font({ family: 'Arial', size: 16 }).opacity(0);
            if (tempText.bbox().width > contentBlockWidth - 2 * contentBlockPadding && currentLine) {
                add.tspan(currentLine).newLine();
                currentLine = word;
            } else {
                currentLine = testLine;
            }
            tempText.remove();
        });
        if (currentLine) {
            add.tspan(currentLine).newLine();
        }
    })
    .font({ family: 'Arial', size: 16, anchor: 'start' })
    .fill('#111') // Darker text
    .move(contentBlockPadding, contentBlockPadding);

    const textBBox = textElement.bbox();

    // Add background rectangle
    const rectWidth = contentBlockWidth;
    const rectHeight = textBBox.height + 2 * contentBlockPadding;
    console.log(`[Whiteboard Store] Content block bbox calculated: w=${rectWidth.toFixed(2)}, h=${rectHeight.toFixed(2)}`); // Log bbox
    const rect = group.rect(rectWidth, rectHeight)
      .fill('#ffffff') // White background
      .stroke({ color: '#cccccc', width: 1 }) // Light border
      .radius(8);

    textElement.front();
    group.move(x, y);

    // Update next Y position
    nextContentBlockY = y + rectHeight + contentBlockMargin;

    console.log(`[Whiteboard Store] Content block added. Next content Y: ${nextContentBlockY}`);
  },

  // Internal pending queue is initialised empty
  _pendingBubbles: [],
  _pendingBlocks: [],
})); 