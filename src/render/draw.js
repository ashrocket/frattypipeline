export const COLORS = {
  ink: '#0B0A0F',
  paper: '#F2EDE4',
  pink: '#FF2E88',
  green: '#B6FF00',
  yellow: '#FFE600',
  orange: '#FF5A1F',
  night: '#24113A',
};
export function rect(c, x, y, w, h, color) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}
export function line(c, points, color, width = 2) {
  c.beginPath();
  c.moveTo(...points[0]);
  for (const p of points.slice(1)) c.lineTo(...p);
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
}
export function poly(c, points, color, stroke) {
  c.beginPath();
  c.moveTo(...points[0]);
  for (const p of points.slice(1)) c.lineTo(...p);
  c.closePath();
  c.fillStyle = color;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = 2;
    c.stroke();
  }
}
export function oval(c, x, y, rx, ry, color, stroke) {
  c.beginPath();
  c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, Math.PI * 2);
  c.fillStyle = color;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = 2;
    c.stroke();
  }
}
export function text(
  c,
  value,
  x,
  y,
  size = 14,
  color = COLORS.paper,
  align = 'left',
  font = 'monospace',
) {
  c.font = `900 ${size}px ${font}`;
  c.textAlign = align;
  c.textBaseline = 'middle';
  c.fillStyle = color;
  c.fillText(value, x, y);
}
export function cachedCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}
