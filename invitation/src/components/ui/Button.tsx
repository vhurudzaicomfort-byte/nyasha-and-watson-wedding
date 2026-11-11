"use client";

import Link from "next/link";
import styles from "./Button.module.css";

type Variant = "gold" | "outline" | "ghost" | "plum";

type BaseProps = {
  variant?: Variant;
  size?: "md" | "sm";
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

type ButtonProps = BaseProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & { href?: undefined };
type AnchorProps = BaseProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children"> & { href: string };

export function Button(props: ButtonProps | AnchorProps) {
  const { variant = "gold", size = "md", icon, className, children, ...rest } = props;
  const cls = [styles.btn, styles[variant], size === "sm" ? styles.sm : "", className ?? ""].join(" ");
  const inner = (
    <>
      {icon && <span className={styles.icon}>{icon}</span>}
      <span>{children}</span>
    </>
  );
  if ("href" in rest && rest.href) {
    const { href, ...a } = rest as AnchorProps;
    const external = /^https?:|^mailto:|^tel:/.test(href);
    if (external) {
      return (
        <a href={href} className={cls} target={a.target ?? "_blank"} rel={a.rel ?? "noopener noreferrer"} {...a}>
          {inner}
        </a>
      );
    }
    return (
      <Link href={href} className={cls} {...a}>
        {inner}
      </Link>
    );
  }
  const b = rest as ButtonProps;
  return (
    <button type={b.type ?? "button"} className={cls} {...b}>
      {inner}
    </button>
  );
}
