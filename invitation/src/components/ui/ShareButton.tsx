"use client";

import { useEffect, useRef, useState } from "react";
import { whatsappShareUrl } from "@/lib/share";
import { Button } from "./Button";
import { CopyIcon, ShareIcon, WhatsAppIcon } from "./Icons";
import styles from "./Popover.module.css";

interface Props {
  title: string;
  text: string;
  /** Absolute URL when known; otherwise the current page URL is used. */
  url?: string;
  variant?: "outline" | "ghost" | "gold" | "plum";
}

/** Native share sheet when available, otherwise copy link / WhatsApp. */
export function ShareButton({ title, text, url, variant = "outline" }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canNative, setCanNative] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCanNative(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open]);

  const shareUrl = () => url || (typeof window !== "undefined" ? window.location.href.split("#")[0] : "");

  const share = async () => {
    const u = shareUrl();
    if (canNative) {
      try {
        await navigator.share({ title, text, url: u });
        return;
      } catch (err) {
        if ((err as DOMException).name === "AbortError") return;
        // fall through to the manual menu
      }
    }
    setOpen((o) => !o);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl());
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 1400);
    } catch {
      window.prompt("Copy this link", shareUrl());
    }
  };

  return (
    <div className={styles.wrap} ref={ref}>
      <Button variant={variant} icon={<ShareIcon />} onClick={() => void share()} aria-expanded={open} aria-haspopup="menu">
        Share invitation
      </Button>
      {open && (
        <div className={styles.menu} role="menu">
          <button type="button" role="menuitem" onClick={() => void copy()}>
            <CopyIcon /> {copied ? "Link copied" : "Copy link"}
          </button>
          <a role="menuitem" href={whatsappShareUrl(`${text}\n${shareUrl()}`)} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
            <WhatsAppIcon /> WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}
