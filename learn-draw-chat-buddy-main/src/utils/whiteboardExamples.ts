
import { Canvas, Textbox, Line, Rect, Circle, Triangle, Path, Polygon, IText } from 'fabric';

// Example for math equations or formulas
export const createMathExample = (canvas: Canvas) => {
  // Center the elements based on canvas dimensions
  const canvasWidth = canvas.width || 600;
  const canvasHeight = canvas.height || 500;
  const centerX = canvasWidth / 2;
  
  // Add title
  const title = new Textbox('Quadratic Formula', {
    left: 50,
    top: 30,
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'Arial',
    fill: '#2563eb',
  });
  
  // Add the formula
  const formula = new Textbox('x = (-b ± √(b² - 4ac)) / 2a', {
    left: 50,
    top: 70,
    fontSize: 20,
    fontFamily: 'Arial',
    fill: '#000000',
  });
  
  // Add explanation
  const explanation = new Textbox('Where:\na = coefficient of x²\nb = coefficient of x\nc = constant term', {
    left: 50,
    top: 120,
    fontSize: 16,
    fontFamily: 'Arial',
    lineHeight: 1.5,
    fill: '#555555',
  });
  
  // Add an example
  const example = new Textbox('Example: For equation 2x² + 5x - 3 = 0\nWe have a=2, b=5, c=-3\nUsing the formula:\nx = (-5 ± √(25 - 4×2×(-3))) / (2×2)\nx = (-5 ± √(25 + 24)) / 4\nx = (-5 ± √49) / 4\nx = (-5 ± 7) / 4\nx₁ = 0.5, x₂ = -3', {
    left: 50,
    top: 200,
    fontSize: 16,
    fontFamily: 'Arial',
    lineHeight: 1.5,
    width: 400,
    fill: '#333333',
  });
  
  // Add all objects to canvas
  canvas.add(title, formula, explanation, example);
};

// Example for chemistry diagrams - FIXED positioning to prevent cut-off
export const createChemistryExample = (canvas: Canvas) => {
  // Get canvas dimensions to better position elements
  const canvasWidth = canvas.width || 600;
  const canvasHeight = canvas.height || 500;
  
  // Calculate center points for better positioning
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  
  // Add title
  const title = new Textbox('Water Molecule (H₂O)', {
    left: 50,
    top: 30,
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'Arial',
    fill: '#2563eb',
  });
  
  // Create oxygen atom - centered
  const oxygen = new Circle({
    left: centerX - 40, // Center the oxygen horizontally
    top: centerY - 30,  // Position in upper half of canvas
    radius: 35,         // Slightly smaller radius
    fill: '#e11d48',
    stroke: '#881337',
    strokeWidth: 2,
  });
  
  // Create hydrogen atoms - ensure they're fully visible
  const hydrogen1 = new Circle({
    left: centerX - 100, // Position further left from oxygen
    top: centerY - 70,   // Position above and left of oxygen
    radius: 25,
    fill: '#2563eb',
    stroke: '#1e40af',
    strokeWidth: 2,
  });
  
  const hydrogen2 = new Circle({
    left: centerX + 30, // Position right of oxygen
    top: centerY - 70,  // Position above and right of oxygen
    radius: 25,
    fill: '#2563eb',
    stroke: '#1e40af',
    strokeWidth: 2,
  });
  
  // Add bonds - adjust to connect the atoms at their new positions
  const bond1 = new Line([
    oxygen.left + oxygen.radius - 10, 
    oxygen.top + oxygen.radius - 20,
    hydrogen1.left + hydrogen1.radius + 15, 
    hydrogen1.top + hydrogen1.radius + 10
  ], {
    stroke: '#000000',
    strokeWidth: 3,
  });
  
  const bond2 = new Line([
    oxygen.left + oxygen.radius + 10, 
    oxygen.top + oxygen.radius - 20,
    hydrogen2.left + hydrogen2.radius - 15, 
    hydrogen2.top + hydrogen2.radius + 10
  ], {
    stroke: '#000000',
    strokeWidth: 3,
  });
  
  // Add labels
  const oxygenLabel = new Textbox('O', {
    left: oxygen.left + 25,
    top: oxygen.top + 25,
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'Arial',
    fill: '#000000',
  });
  
  const h1Label = new Textbox('H', {
    left: hydrogen1.left + 15,
    top: hydrogen1.top + 15,
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'Arial',
    fill: '#000000',
  });
  
  const h2Label = new Textbox('H', {
    left: hydrogen2.left + 15,
    top: hydrogen2.top + 15,
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'Arial',
    fill: '#000000',
  });
  
  // Add explanation - positioned lower to avoid overlap
  const explanation = new Textbox('Water molecule consists of one oxygen atom covalently bonded to two hydrogen atoms. The bond angle is approximately 104.5°.', {
    left: 50,
    top: centerY + 70, // Position below the molecule
    width: canvasWidth - 100,
    fontSize: 16,
    fontFamily: 'Arial',
    lineHeight: 1.5,
    fill: '#333333',
  });
  
  // Add all objects to canvas
  canvas.add(title, oxygen, hydrogen1, hydrogen2, bond1, bond2, oxygenLabel, h1Label, h2Label, explanation);
};

// Example for flowchart diagrams - Scale down to ensure fit
export const createFlowchartExample = (canvas: Canvas) => {
  // Get canvas dimensions
  const canvasWidth = canvas.width || 600;
  const canvasHeight = canvas.height || 500;
  const centerX = canvasWidth / 2;
  
  // Scale factor to ensure flowchart fits
  const scale = Math.min(canvasWidth / 700, canvasHeight / 600, 0.85);
  
  // Add title
  const title = new Textbox('Problem Solving Process', {
    left: 50,
    top: 30,
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'Arial',
    fill: '#2563eb',
  });
  
  // Horizontal offset to center the flowchart
  const offsetX = centerX - 290 * scale;
  
  // Create flowchart shapes
  const startRect = new Rect({
    left: offsetX + 200 * scale,
    top: 80 * scale,
    width: 180 * scale,
    height: 60 * scale,
    rx: 20 * scale,
    ry: 20 * scale,
    fill: '#34d399',
    stroke: '#047857',
    strokeWidth: 2,
  });
  
  const process1Rect = new Rect({
    left: offsetX + 200 * scale,
    top: 180 * scale,
    width: 180 * scale,
    height: 60 * scale,
    fill: '#93c5fd',
    stroke: '#1e40af',
    strokeWidth: 2,
  });
  
  // Adjust the diamond shape to fit
  const decisionDiamond = new Polygon([
    {x: offsetX + 290 * scale, y: 280 * scale},
    {x: offsetX + 380 * scale, y: 330 * scale},
    {x: offsetX + 290 * scale, y: 380 * scale},
    {x: offsetX + 200 * scale, y: 330 * scale},
  ], {
    fill: '#fde68a',
    stroke: '#92400e',
    strokeWidth: 2,
  });
  
  const process2Rect = new Rect({
    left: offsetX + 400 * scale,
    top: 330 * scale,
    width: 180 * scale,
    height: 60 * scale,
    fill: '#93c5fd',
    stroke: '#1e40af',
    strokeWidth: 2,
  });
  
  const endRect = new Rect({
    left: offsetX + 200 * scale,
    top: 430 * scale,
    width: 180 * scale,
    height: 60 * scale,
    rx: 20 * scale,
    ry: 20 * scale,
    fill: '#f87171',
    stroke: '#991b1b',
    strokeWidth: 2,
  });
  
  // Add connecting arrows
  const arrow1 = new Line([
    offsetX + 290 * scale, 140 * scale,
    offsetX + 290 * scale, 180 * scale
  ], {
    stroke: '#000000',
    strokeWidth: 2,
    strokeLineCap: 'round',
  });
  
  const arrow2 = new Line([
    offsetX + 290 * scale, 240 * scale,
    offsetX + 290 * scale, 280 * scale
  ], {
    stroke: '#000000',
    strokeWidth: 2,
    strokeLineCap: 'round',
  });
  
  const arrow3 = new Line([
    offsetX + 380 * scale, 330 * scale,
    offsetX + 400 * scale, 330 * scale
  ], {
    stroke: '#000000',
    strokeWidth: 2,
    strokeLineCap: 'round',
  });
  
  const arrow4 = new Line([
    offsetX + 290 * scale, 380 * scale,
    offsetX + 290 * scale, 430 * scale
  ], {
    stroke: '#000000',
    strokeWidth: 2,
    strokeLineCap: 'round',
  });
  
  // Add text labels - adjusted for scale
  const startText = new Textbox('Start', {
    left: offsetX + 235 * scale,
    top: 97 * scale,
    fontSize: 18 * scale,
    fontWeight: 'bold',
    fontFamily: 'Arial',
    fill: '#000000',
  });
  
  const process1Text = new Textbox('Identify Problem', {
    left: offsetX + 215 * scale,
    top: 197 * scale,
    fontSize: 18 * scale,
    fontWeight: 'bold',
    fontFamily: 'Arial',
    fill: '#000000',
  });
  
  const decisionText = new Textbox('Solution\nfound?', {
    left: offsetX + 260 * scale,
    top: 320 * scale,
    fontSize: 16 * scale,
    fontWeight: 'bold',
    fontFamily: 'Arial',
    fill: '#000000',
    textAlign: 'center',
  });
  
  const process2Text = new Textbox('Try different\napproach', {
    left: offsetX + 420 * scale,
    top: 340 * scale,
    fontSize: 16 * scale,
    fontWeight: 'bold',
    fontFamily: 'Arial',
    fill: '#000000',
  });
  
  const endText = new Textbox('End', {
    left: offsetX + 245 * scale,
    top: 447 * scale,
    fontSize: 18 * scale,
    fontWeight: 'bold',
    fontFamily: 'Arial',
    fill: '#000000',
  });
  
  // Add yes/no labels
  const yesText = new Textbox('Yes', {
    left: offsetX + 275 * scale,
    top: 390 * scale,
    fontSize: 14 * scale,
    fontFamily: 'Arial',
    fill: '#000000',
  });
  
  const noText = new Textbox('No', {
    left: offsetX + 385 * scale,
    top: 310 * scale,
    fontSize: 14 * scale,
    fontFamily: 'Arial',
    fill: '#000000',
  });
  
  // Add all objects to canvas
  canvas.add(
    title, startRect, process1Rect, decisionDiamond, process2Rect, endRect, 
    arrow1, arrow2, arrow3, arrow4, 
    startText, process1Text, decisionText, process2Text, endText,
    yesText, noText
  );
};

// Example for history timeline - Scale and position to fit
export const createHistoryTimeline = (canvas: Canvas) => {
  // Get canvas dimensions
  const canvasWidth = canvas.width || 600;
  const canvasHeight = canvas.height || 500;
  
  // Scale factor to ensure timeline fits
  const scale = Math.min(canvasWidth / 700, 0.9);
  
  // Add title
  const title = new Textbox('World War II Timeline', {
    left: 50,
    top: 30,
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'Arial',
    fill: '#2563eb',
  });
  
  // Create timeline line - adjust width based on canvas
  const timelineWidth = Math.min(600, canvasWidth - 100);
  const timelineLine = new Line([
    50, 150,
    50 + timelineWidth, 150
  ], {
    stroke: '#000000',
    strokeWidth: 3,
  });
  
  // Create timeline points - distribute evenly
  const pointSpacing = timelineWidth / 4;
  const timelinePoints = [
    { x: 50 + pointSpacing * 0, y: 150, year: '1939', event: 'Germany invades Poland, starting World War II in Europe' },
    { x: 50 + pointSpacing * 1, y: 150, year: '1941', event: 'Japan attacks Pearl Harbor, US enters the war' },
    { x: 50 + pointSpacing * 2, y: 150, year: '1942', event: 'Battle of Stalingrad begins' },
    { x: 50 + pointSpacing * 3, y: 150, year: '1944', event: 'D-Day: Allied invasion of Normandy' },
    { x: 50 + pointSpacing * 4, y: 150, year: '1945', event: 'Germany and Japan surrender, war ends' },
  ];
  
  // Add points and labels
  timelinePoints.forEach((point, index) => {
    // Create point
    const circle = new Circle({
      left: point.x - 10,
      top: point.y - 10,
      radius: 10,
      fill: '#2563eb',
      stroke: '#1e40af',
      strokeWidth: 2,
    });
    
    // Create year label
    const yearLabel = new Textbox(point.year, {
      left: point.x - 20,
      top: point.y + 20,
      fontSize: 16,
      fontWeight: 'bold',
      fontFamily: 'Arial',
      fill: '#000000',
    });
    
    // Create event description - make smaller with limited width
    const eventDesc = new Textbox(point.event, {
      left: point.x - Math.min(100, pointSpacing/2),
      top: index % 2 === 0 ? point.y - 70 : point.y + 50,
      width: Math.min(190, pointSpacing * 0.9),
      fontSize: 13,
      fontFamily: 'Arial',
      textAlign: 'center',
      fill: '#333333',
    });
    
    // Create connecting line
    const connectingLine = new Line([
      point.x, point.y,
      point.x, index % 2 === 0 ? point.y - 30 : point.y + 30
    ], {
      stroke: '#666666',
      strokeWidth: 2,
      strokeDashArray: [3, 3],
    });
    
    // Add objects to canvas
    canvas.add(circle, yearLabel, eventDesc, connectingLine);
  });
  
  // Add explanation - positioned at the bottom
  const explanation = new Textbox('World War II was a global conflict that lasted from 1939 to 1945, involving many of the world\'s nations including all of the great powers.', {
    left: 50,
    top: 280,
    width: timelineWidth,
    fontSize: 15,
    fontFamily: 'Arial',
    textAlign: 'center',
    fill: '#333333',
  });
  
  // Add to canvas
  canvas.add(title, timelineLine, explanation);
};
