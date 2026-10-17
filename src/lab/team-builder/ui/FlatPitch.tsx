import { useEffect, useRef, useState } from 'react';
import { FORMATIONS, SLOT_COUNT } from '../data/squad';
import { tick } from '../interaction/dragController';
import { useBuilder } from '../store/builderStore';
import { bridge } from '../store/spatialBridge';

const HALF_X = 34;
const HALF_Z = 52.5;
const PAD = 20;

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The largest 68 × 105 rectangle that fits the space the panels leave clear. */
function fieldBox(): Box {
  const { rect, insets } = bridge;
  const left = rect.left + insets.left + PAD;
  const top = rect.top + insets.top + PAD;
  const width = Math.max(rect.width - insets.left - insets.right - PAD * 2, 1);
  const height = Math.max(rect.height - insets.top - insets.bottom - PAD * 2, 1);
  const scale = Math.min(width / (HALF_X * 2), height / (HALF_Z * 2));
  const w = HALF_X * 2 * scale;
  const h = HALF_Z * 2 * scale;
  return { left: left + (width - w) / 2, top: top + (height - h) / 2, width: w, height: h };
}

/**
 * The pitch when WebGL is unavailable: a flat, top-down drawing in the same
 * place, with the slot buttons pinned to it and the drag controller stepped
 * by a plain animation frame instead of the canvas. Without a camera the
 * controller's magnet measures distance on screen rather than on the grass,
 * so dragging, tapping and the keyboard all still work.
 */
export function FlatPitch() {
  const [box, setBox] = useState<Box | null>(null);
  const positions = useRef(Array.from({ length: SLOT_COUNT }, () => ({ x: 0, z: 0, ready: false })));

  useEffect(() => {
    let frame = 0;
    let last = '';
    const step = () => {
      const field = fieldBox();
      const key = `${field.left}|${field.top}|${field.width}|${field.height}`;
      if (key !== last) {
        last = key;
        setBox(field);
      }
      const slots = FORMATIONS[useBuilder.getState().formation];
      const k = bridge.reducedMotion ? 1 : 0.2;
      for (let i = 0; i < SLOT_COUNT; i += 1) {
        const slot = slots[i];
        const p = positions.current[i]!;
        if (!slot) continue;
        if (!p.ready) {
          p.x = slot.x;
          p.z = slot.z;
          p.ready = true;
        }
        p.x += (slot.x - p.x) * k;
        p.z += (slot.z - p.z) * k;
        const screen = bridge.slotScreen[i]!;
        screen.x = field.left + ((p.x + HALF_X) / (HALF_X * 2)) * field.width;
        screen.y = field.top + ((p.z + HALF_Z) / (HALF_Z * 2)) * field.height;
        screen.visible = true;
        const el = bridge.anchors.get(i);
        if (el) {
          el.style.transform = `translate3d(${screen.x.toFixed(1)}px, ${screen.y.toFixed(1)}px, 0)`;
          el.style.visibility = 'visible';
        }
      }
      tick(performance.now());
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!box) return null;
  const sx = box.width / (HALF_X * 2);
  const sz = box.height / (HALF_Z * 2);
  const X = (x: number) => (x + HALF_X) * sx;
  const Z = (z: number) => (z + HALF_Z) * sz;

  return (
    <>
      <p
        className="tb-fs-micro pointer-events-none absolute text-center font-mono uppercase tracking-hud text-white/70"
        style={{ left: box.left, top: box.top - 18, width: box.width }}
      >
        3D is unavailable here · flat pitch
      </p>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{ left: box.left, top: box.top, width: box.width, height: box.height, overflow: 'visible' }}
        viewBox={`0 0 ${box.width} ${box.height}`}
      >
        <g fill="none" stroke="rgba(200,225,255,0.55)" strokeWidth={1.5}>
          <rect x={0} y={0} width={box.width} height={box.height} rx={4} fill="rgba(11,26,54,0.55)" stroke="#2f86e8" />
          <line x1={0} y1={Z(0)} x2={box.width} y2={Z(0)} />
          <circle cx={X(0)} cy={Z(0)} r={9.15 * sx} />
          {[-1, 1].map((s) => (
            <g key={s}>
              <rect x={X(-20.16)} y={s < 0 ? 0 : Z(HALF_Z - 16.5)} width={40.32 * sx} height={16.5 * sz} />
              <rect x={X(-9.16)} y={s < 0 ? 0 : Z(HALF_Z - 5.5)} width={18.32 * sx} height={5.5 * sz} />
            </g>
          ))}
        </g>
      </svg>
    </>
  );
}
