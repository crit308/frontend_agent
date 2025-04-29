import { create } from 'zustand';
import { Svg, Text } from '@svgdotjs/svg.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type ChatBubbleRole = 'user' | 'assistant';
export interface ChatBubbleOptions {
  x?: number;
  y?: number;
  role?: ChatBubbleRole;
  skipHistory?: boolean; // internal flag – prevents infinite history growth when replaying
}

export interface ContentBlockOptions {
  x?: number;
  y?: number;
  skipHistory?: boolean; // internal flag – prevents infinite history growth when replaying
}

export interface WhiteboardState {
  // The current svg.js instance being drawn on. Null when the <svg> element
  // is not yet available (e.g. during first render or when the component
  // remounts after switching tools).
  svgInstance: Svg | null;
  setSvgInstance: (instance: Svg | null) => void;

  // Drawing helpers -----------------------------------------------------------
  addChatBubble: (text: string, options?: ChatBubbleOptions) => void;
  addContentBlock: (
    text: string,
    type: 'explanation' | 'question' | 'feedback' | string,
    options?: ContentBlockOptions
  ) => void;
  getAndUpdateNextBubblePosition: (role: ChatBubbleRole) => { x: number; y: number };
  getAndUpdateNextContentBlockPosition: () => { x: number; y: number };

  // Queues to buffer drawing requests while no svgInstance is available -------
  _pendingBubbles: Array<{ text: string; options: ChatBubbleOptions }>;
  _pendingBlocks: Array<{ text: string; type: string; options: ContentBlockOptions }>;

  // Permanent history so we can replay drawings if the svg element is replaced
  _historyBubbles: Array<{ text: string; options: ChatBubbleOptions }>;
  _historyBlocks: Array<{ text: string; type: string; options: ContentBlockOptions }>;
}

// -----------------------------------------------------------------------------
// Layout constants (simple stacking approach) ---------------------------------
// -----------------------------------------------------------------------------

let nextUserBubbleY = 20;
let nextAssistantBubbleY = 20;
const bubblePadding = 15;
const bubbleMargin = 10;
const userBubbleX = 20;
const assistantBubbleX = 300;

let nextContentBlockY = 20;
const contentBlockPadding = 20;
const contentBlockMargin = 15;
const contentBlockX = 550;
const contentBlockWidth = 350;

// -----------------------------------------------------------------------------
// The store -------------------------------------------------------------------
// -----------------------------------------------------------------------------

export const useWhiteboardStore = create<WhiteboardState>((set, get) => ({
  // ---------------------------------------------------------------------------
  // State ---------------------------------------------------------------------
  // ---------------------------------------------------------------------------

  svgInstance: null,

  // ---------------------------------------------------------------------------
  // Instance handling ---------------------------------------------------------
  // ---------------------------------------------------------------------------

  setSvgInstance: (instance) => {
    // Update the stored instance first so subsequent drawing calls use it.
    set({ svgInstance: instance });

    if (!instance) return; // Nothing else to do when clearing.

    // 1. Replay full history (if any) so the board always shows previous work.
    if (get()._historyBubbles.length || get()._historyBlocks.length) {
      console.log('[Whiteboard Store] Replaying whiteboard history onto fresh SVG instance.');

      // Reset stacking cursors so recorded absolute positions are preserved.
      nextUserBubbleY = 20;
      nextAssistantBubbleY = 20;
      nextContentBlockY = 20;

      // Bubbles ---------------------------------------------------------------
      get()._historyBubbles.forEach((b) => {
        get().addChatBubble(b.text, { ...b.options, skipHistory: true });
      });

      // Blocks ----------------------------------------------------------------
      get()._historyBlocks.forEach((b) => {
        get().addContentBlock(b.text, b.type, { ...b.options, skipHistory: true });
      });
    }

    // 2. Flush any pending requests that were queued while no svgInstance.
    if (get()._pendingBubbles.length) {
      console.log(`[Whiteboard Store] Drawing ${get()._pendingBubbles.length} pending bubbles.`);
      get()._pendingBubbles.splice(0).forEach((p) => get().addChatBubble(p.text, p.options));
    }
    if (get()._pendingBlocks.length) {
      console.log(`[Whiteboard Store] Drawing ${get()._pendingBlocks.length} pending content blocks.`);
      get()._pendingBlocks.splice(0).forEach((p) => get().addContentBlock(p.text, p.type, p.options));
    }
  },

  // ---------------------------------------------------------------------------
  // Helpers -------------------------------------------------------------------
  // ---------------------------------------------------------------------------

  getAndUpdateNextBubblePosition: (role) => {
    return role === 'user'
      ? { x: userBubbleX, y: nextUserBubbleY }
      : { x: assistantBubbleX, y: nextAssistantBubbleY };
  },

  getAndUpdateNextContentBlockPosition: () => ({ x: contentBlockX, y: nextContentBlockY }),

  // ---------------------------------------------------------------------------
  // Drawing routines ----------------------------------------------------------
  // ---------------------------------------------------------------------------

  addChatBubble: (text, options = {}) => {
    const svg = get().svgInstance;
    if (!svg) {
      // Not ready: queue and exit.
      get()._pendingBubbles.push({ text, options: { ...options } });
      console.warn('[Whiteboard Store] svgInstance unavailable – queuing chat bubble.');
      return;
    }

    const { skipHistory = false, role = 'assistant', x, y } = options as ChatBubbleOptions;
    let posX = x;
    let posY = y;

    // Calculate position if not provided.
    if (posX === undefined || posY === undefined) {
      const pos = get().getAndUpdateNextBubblePosition(role);
      posX = pos.x;
      posY = pos.y;
    }

    console.log(`[Whiteboard Store] Drawing ${role} chat bubble at (${posX}, ${posY}).`);

    const group = svg.group().attr('data-role', role);

    // Render wrapped text -----------------------------------------------------
    const textElement = group
      .text(function (add: Text) {
        const maxWidth = 250;
        let currentLine = '';
        text.split(' ').forEach((word) => {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const temp = svg.text(testLine).font({ family: 'Arial', size: 14 }).opacity(0);
          if (temp.bbox().width > maxWidth && currentLine) {
            add.tspan(currentLine).newLine();
            currentLine = word;
          } else {
            currentLine = testLine;
          }
          temp.remove();
        });
        if (currentLine) add.tspan(currentLine).newLine();
      })
      .font({ family: 'Arial', size: 14, anchor: 'start' })
      .fill(role === 'user' ? '#FFFFFF' : '#333')
      .move(bubblePadding, bubblePadding);

    const bbox = textElement.bbox();
    const rectWidth = bbox.width + 2 * bubblePadding;
    const rectHeight = bbox.height + 2 * bubblePadding;

    group
      .rect(rectWidth, rectHeight)
      .fill(role === 'user' ? '#007bff' : '#f0f0f0')
      .radius(10);

    textElement.front();
    group.move(posX, posY);

    if (!skipHistory) {
      if (role === 'user') nextUserBubbleY = posY + rectHeight + bubbleMargin;
      else nextAssistantBubbleY = posY + rectHeight + bubbleMargin;
      get()._historyBubbles.push({ text, options: { x: posX, y: posY, role } });
    }
  },

  addContentBlock: (text, type, options = {}) => {
    const svg = get().svgInstance;
    if (!svg) {
      get()._pendingBlocks.push({ text, type, options: { ...options } });
      console.warn('[Whiteboard Store] svgInstance unavailable – queuing content block.');
      return;
    }

    const { skipHistory = false, x, y } = options as ContentBlockOptions;
    let posX = x;
    let posY = y;

    if (posX === undefined || posY === undefined) {
      const pos = get().getAndUpdateNextContentBlockPosition();
      posX = pos.x;
      posY = pos.y;
    }

    console.log(`[Whiteboard Store] Drawing ${type} content block at (${posX}, ${posY}).`);

    const group = svg.group().attr('data-type', type);

    // Render wrapped text -----------------------------------------------------
    const textElement = group
      .text(function (add: Text) {
        const maxWidth = contentBlockWidth - 2 * contentBlockPadding;
        let currentLine = '';
        text.split(' ').forEach((word) => {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const temp = svg.text(testLine).font({ family: 'Arial', size: 16 }).opacity(0);
          if (temp.bbox().width > maxWidth && currentLine) {
            add.tspan(currentLine).newLine();
            currentLine = word;
          } else {
            currentLine = testLine;
          }
          temp.remove();
        });
        if (currentLine) add.tspan(currentLine).newLine();
      })
      .font({ family: 'Arial', size: 16, anchor: 'start' })
      .fill('#111')
      .move(contentBlockPadding, contentBlockPadding);

    const bbox = textElement.bbox();
    const rectHeight = bbox.height + 2 * contentBlockPadding;

    group
      .rect(contentBlockWidth, rectHeight)
      .fill('#ffffff')
      .stroke({ color: '#cccccc', width: 1 })
      .radius(8);

    textElement.front();
    group.move(posX, posY);

    if (!skipHistory) {
      nextContentBlockY = posY + rectHeight + contentBlockMargin;
      get()._historyBlocks.push({ text, type, options: { x: posX, y: posY } });
    }
  },

  // ---------------------------------------------------------------------------
  // Internal buffers ----------------------------------------------------------
  // ---------------------------------------------------------------------------

  _pendingBubbles: [],
  _pendingBlocks: [],
  _historyBubbles: [],
  _historyBlocks: [],
}));