"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import styles from "./Toast.module.css";

interface ToastCtx {
  show: (message: string) => void;
}

const Ctx = createContext<ToastCtx>({ show: () => undefined });
export const useToast = () => useContext(Ctx);

/** Small, polite confirmation messages ("Address copied"). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const show = useCallback((message: string) => {
    setMsg(message);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 2200);
  }, []);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);
  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div className={styles.region} aria-live="polite" aria-atomic="true">
        {msg && (
          <div className={styles.toast} key={msg}>
            {msg}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}
