"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

function elementOverlapsViewport(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  return rect.bottom > 0 && rect.top < vh && rect.right > 0 && rect.left < vw;
}

export function Reveal({ children, className = "", delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  // Before paint: if the block already sits in the viewport (e.g. hero, first sections),
  // show it immediately. IntersectionObserver alone can miss tiny or transformed targets
  // when threshold + rootMargin are strict.
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (elementOverlapsViewport(node)) setVisible(true);
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      {
        threshold: 0,
        rootMargin: "0px 0px 0px 0px",
      },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transform-gpu transition-all duration-700 ease-out will-change-transform ${
        visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}
