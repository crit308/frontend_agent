import ELK from 'elkjs/lib/elk.bundled.js'; // Using bundled version for web worker

// Elkjs layout options (can be customized based on needs)
const elkOptions = {
  'elk.algorithm': 'layered', // Example: layered, mrtree, force, etc.
  'elk.direction': 'DOWN',
  'elk.spacing.nodeNode': '40',
  'elk.layered.spacing.nodeNodeBetweenLayers': '60',
  // Add other ELK options here: https://www.eclipse.org/elk/reference/options.html
};

const elk = new ELK();

self.onmessage = async (event) => {
  const { type, nodes: inputNodes, edges: inputEdges, layoutType, id } = event.data;

  if (type === 'LAYOUT_GRAPH') {
    if (!inputNodes || !inputEdges) {
      self.postMessage({ type: 'LAYOUT_RESULT', id, positions: null, error: 'Nodes or edges not provided to layout worker.' });
      return;
    }

    // Transform input nodes and edges to ELK graph structure
    const elkGraph = {
      id: 'root',
      layoutOptions: { ...elkOptions, 'elk.algorithm': layoutType || elkOptions['elk.algorithm'] },
      children: inputNodes.map((node: any) => ({
        id: node.id,
        width: node.width || 150, // Default width if not provided
        height: node.height || 50, // Default height if not provided
        // labels: node.label ? [{ text: node.label }] : [], // ELK can handle labels too
        // layoutOptions: { 'elk.portConstraints': 'FIXED_ORDER' } // Example node-specific option
      })),
      edges: inputEdges.map((edge: any) => ({
        id: edge.id,
        sources: [edge.source], // ELK expects source/target IDs in arrays
        targets: [edge.target],
        // labels: edge.label ? [{ text: edge.label }] : [],
      })),
    };

    try {
      const layout = await elk.layout(elkGraph);
      const positions: { [nodeId: string]: { x: number; y: number } } = {};
      
      if (layout.children) {
        layout.children.forEach((node: any) => {
          positions[node.id] = { x: node.x || 0, y: node.y || 0 };
        });
      }
      // ELK might also return positions for edges/ports if configured, handle if needed.

      self.postMessage({ type: 'LAYOUT_RESULT', id, positions, error: null });
    } catch (e: any) {
      console.error('[LayoutWorker] ELK layout error:', e);
      self.postMessage({ type: 'LAYOUT_RESULT', id, positions: null, error: e.message || 'Unknown ELK layout error' });
    }
  }
};

// Export {} to make it a module for TypeScript if isolatedModules is on.
export {}; 