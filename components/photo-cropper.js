'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from './ui';

const VIEW = 280, OUT = 512;
// Crop a profile photo to a circle: drag (or arrow keys) to position, slider to zoom, then save. The result is a
// 512×512 JPEG, so any photo up to 15 MB works and the upload stays small. onSave(file, previewUrl).
export default function PhotoCropper({ file, busy, onCancel, onSave }) {
  const [url] = useState(() => URL.createObjectURL(file));
  const [img, setImg] = useState(null), [zoom, setZoom] = useState(1), [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef(null);
  useEffect(() => { const i = new Image(); i.onload = () => setImg(i); i.src = url; }, [url]);
  const base = img ? VIEW / Math.min(img.naturalWidth, img.naturalHeight) : 1;
  const size = z => img ? { w: img.naturalWidth * base * z, h: img.naturalHeight * base * z } : { w: 0, h: 0 };
  const { w, h } = size(zoom);
  // Keep the photo covering the whole circle.
  const clamp = (p, z = zoom) => { const s = size(z), mx = (s.w - VIEW) / 2, my = (s.h - VIEW) / 2; return { x: Math.max(-mx, Math.min(mx, p.x)), y: Math.max(-my, Math.min(my, p.y)) }; };
  function down(e) { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, start: pos }; }
  function move(e) { const d = drag.current; if (d) setPos(clamp({ x: d.start.x + e.clientX - d.x, y: d.start.y + e.clientY - d.y })); }
  function keys(e) { const step = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[e.key]; if (!step) return; e.preventDefault(); setPos(p => clamp({ x: p.x + step[0], y: p.y + step[1] })); }
  async function save() {
    const c = document.createElement('canvas'); c.width = c.height = OUT;
    const g = c.getContext('2d'), r = OUT / VIEW;
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, OUT, OUT);
    g.drawImage(img, ((VIEW - w) / 2 + pos.x) * r, ((VIEW - h) / 2 + pos.y) * r, w * r, h * r);
    const blob = await new Promise(resolve => c.toBlob(resolve, 'image/jpeg', 0.9));
    onSave(new File([blob], 'profile.jpg', { type: 'image/jpeg' }), URL.createObjectURL(blob));
  }
  return <div className="cropper">
    <div className="crop-view" style={{ width: VIEW, height: VIEW }} tabIndex={0} role="group" aria-label="Photo position. Drag, or use the arrow keys, to move your photo inside the circle."
      onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onKeyDown={keys}>
      {img && <img src={url} alt="" draggable={false} style={{ width: w, height: h, left: (VIEW - w) / 2 + pos.x, top: (VIEW - h) / 2 + pos.y }} />}
      <div className="crop-mask" aria-hidden="true" />
    </div>
    <label className="crop-zoom">Zoom<input type="range" min="1" max="3" step="0.01" value={zoom} onChange={e => { const z = Number(e.target.value); setZoom(z); setPos(p => clamp(p, z)); }} /></label>
    <p className="quiet">Drag to position your face inside the circle.</p>
    <div className="form-actions"><Button type="button" secondary onClick={onCancel}>Cancel</Button><Button type="button" disabled={!img || busy} onClick={save}>{busy ? 'Saving…' : 'Save photo'}</Button></div>
  </div>;
}
