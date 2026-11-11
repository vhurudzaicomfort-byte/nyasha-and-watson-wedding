"use client";

import { useEffect, useState } from "react";
import styles from "./SectionNav.module.css";

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

/**
 * Sticky section navigator with a scroll-progress line. Appears once the
 * guest scrolls past the cover; highlights the section in view.
 */
export function SectionNav({ items }: { items: NavItem[] }) {
  const [active, setActive] = useState<string>("");
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
      setVisible(window.scrollY > window.innerHeight * 0.6);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const best = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (best) setActive(best.target.id);
      },
      { rootMargin: "-35% 0px -50% 0px", threshold: [0, 0.2, 0.5] },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);

  const go = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav className={`${styles.nav} ${visible ? styles.visible : ""}`} aria-label="Invitation sections">
      <div className={styles.progress} style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />
      <ul className={styles.list}>
        {items.map((it) => (
          <li key={it.id}>
            <a href={`#${it.id}`} onClick={go(it.id)} className={`${styles.item} ${active === it.id ? styles.active : ""}`} aria-current={active === it.id ? "true" : undefined}>
              <span className={styles.icon}>{it.icon}</span>
              <span className={styles.label}>{it.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
