import { Cartouche } from "@/components/ornaments/Cartouche";
import { Reveal } from "./Reveal";
import styles from "./SectionHeading.module.css";

interface Props {
  label: string;
  script?: string;
  id?: string;
  intro?: string;
}

/** Cartouche label with an optional calligraphic script line above it. */
export function SectionHeading({ label, script, id, intro }: Props) {
  return (
    <Reveal className={styles.heading}>
      {script && <span className={`script ${styles.script}`}>{script}</span>}
      <Cartouche id={id}>{label}</Cartouche>
      {intro && <p className={styles.intro}>{intro}</p>}
    </Reveal>
  );
}
