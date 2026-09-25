import { useLayoutEffect, useState } from 'react';
import { MotionValue, useMotionValue, useSpring } from 'framer-motion';

export interface Size {
  w: number;
  h: number;
}

// Size of an element, kept up to date.
export function useSize(ref: React.RefObject<HTMLElement>): Size {
  const [size, setSize] = useState<Size>({ w: 1, h: 1 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

// Pointer position over the stage, -1..1 on each axis, eased.
export function usePointer(): { x: MotionValue<number>; y: MotionValue<number>; onMove: (e: React.PointerEvent) => void } {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 50, damping: 18, mass: 0.8 });
  const y = useSpring(rawY, { stiffness: 50, damping: 18, mass: 0.8 });
  const onMove = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    rawX.set(((e.clientX - r.left) / r.width) * 2 - 1);
    rawY.set(((e.clientY - r.top) / r.height) * 2 - 1);
  };
  return { x, y, onMove };
}

export const prefersReducedMotion = (() => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {
    return false;
  }
})();
