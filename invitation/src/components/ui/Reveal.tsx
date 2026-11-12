"use client";

import { motion, useReducedMotion } from "motion/react";

interface Props {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  /** Vertical travel distance in px. */
  y?: number;
  as?: "div" | "section" | "p" | "li" | "span";
  once?: boolean;
}

/** Fades and lifts content into view as the guest scrolls. */
export function Reveal({ children, className, delay = 0, y = 28, as = "div", once = true }: Props) {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount: 0.2 }}
      transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Tag>
  );
}
