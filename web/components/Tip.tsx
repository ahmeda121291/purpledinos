"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GLOSSARY } from "@/lib/glossary";

// A small "?" that explains a stat on hover, focus or tap.
export default function Tip({ term }: { term: keyof typeof GLOSSARY | string }) {
  const g = GLOSSARY[term];
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; up: boolean } | null>(null);
  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const up = r.bottom + 190 > window.innerHeight;
    setPos({ x: Math.min(Math.max(12, r.left + r.width / 2 - 150), window.innerWidth - 312), y: up ? r.top - 8 : r.bottom + 8, up });
  };
  const hide = () => setPos(null);
  useEffect(() => {
    if (!pos) return;
    const close = (e: Event) => { if (e.type !== "keydown" || (e as KeyboardEvent).key === "Escape") hide(); };
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("keydown", close); };
  }, [pos]);
  if (!g) return null;
  return (
    <>
      <button ref={ref} type="button" className="tip" aria-label={`What is ${g.name}?`} aria-expanded={Boolean(pos)}
        onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (pos) hide(); else show(); }}>?</button>
      {pos && typeof document !== "undefined"
        ? createPortal(
            <div role="tooltip" className="tip-pop" style={{ left: pos.x, top: pos.y, transform: pos.up ? "translateY(-100%)" : undefined }}>
              <b>{g.name}</b>
              <span>{g.text}</span>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
