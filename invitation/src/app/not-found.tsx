import Link from "next/link";
import { Monogram } from "@/components/ornaments/Monogram";

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100svh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        textAlign: "center",
        background: "var(--plum)",
        color: "var(--ivory)",
      }}
    >
      <div style={{ display: "grid", gap: "1rem", justifyItems: "center" }}>
        <Monogram initials={["e", "G"]} size={80} />
        <p className="eyebrow" style={{ color: "var(--gold-light)" }}>
          Invitation not found
        </p>
        <p style={{ maxWidth: "26rem", margin: 0, fontStyle: "italic", opacity: 0.8 }}>
          This link does not match an invitation. Please check the link you were sent, or ask the couple for a new one.
        </p>
        <Link href="/" style={{ color: "var(--gold-light)", fontFamily: "var(--font-sans)", fontSize: "0.75rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>
          Go to the invitation
        </Link>
      </div>
    </main>
  );
}
