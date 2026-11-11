import { Leaf, Rose, RoseDefs } from "./Rose";
import { stemPath } from "./paths";

interface Props {
  className?: string;
  /** Unique id prefix – required when several corners share a page. */
  id: string;
  /** Mirror horizontally for right-hand corners. */
  flip?: boolean;
  style?: React.CSSProperties;
}

/**
 * Ivory garden roses with botanical foliage – the signature arrangement
 * echoing the white florals and green leaves of the original design.
 */
export function FloralCorner({ className, id, flip, style }: Props) {
  return (
    <svg
      viewBox="0 0 240 240"
      className={className}
      style={{ ...style, transform: flip ? "scaleX(-1)" : undefined }}
      aria-hidden="true"
      focusable="false"
    >
      <RoseDefs id={id} />
      {/* stems */}
      <g fill="none" stroke="var(--leaf, #4f6b52)" strokeWidth={1.1} strokeLinecap="round" opacity={0.9}>
        <path d={stemPath(130, 30)} transform="translate(20 60) rotate(35)" />
        <path d={stemPath(110, -24)} transform="translate(30 40) rotate(62)" />
        <path d={stemPath(120, 18)} transform="translate(40 30) rotate(8)" />
      </g>
      {/* broad leaves */}
      <Leaf id={id} x={28} y={64} len={78} width={30} angle={38} dark />
      <Leaf id={id} x={36} y={42} len={92} width={34} angle={70} />
      <Leaf id={id} x={44} y={34} len={84} width={30} angle={2} />
      <Leaf id={id} x={118} y={120} len={60} width={22} angle={48} dark />
      <Leaf id={id} x={128} y={70} len={56} width={22} angle={-18} />
      <Leaf id={id} x={70} y={150} len={54} width={20} angle={88} />
      {/* small eucalyptus sprig */}
      <g transform="translate(150 50) rotate(-30)" fill="var(--leaf-light, #8aa38c)" opacity={0.85}>
        <path d="M0 0 Q30 -4 64 -14" stroke="var(--leaf, #4f6b52)" strokeWidth={0.9} fill="none" />
        {[10, 22, 34, 46, 56].map((x, i) => (
          <g key={x}>
            <ellipse cx={x} cy={-x * 0.2 - 6} rx={5.5} ry={3.4} transform={`rotate(-30 ${x} ${-x * 0.2 - 6})`} />
            <ellipse cx={x + 4} cy={-x * 0.2 + 4} rx={5.5 - i * 0.4} ry={3.4} transform={`rotate(20 ${x + 4} ${-x * 0.2 + 4})`} />
          </g>
        ))}
      </g>
      {/* berries */}
      <g fill="var(--gold, #c4a46a)" opacity={0.85}>
        <circle cx={150} cy={118} r={2.6} />
        <circle cx={158} cy={126} r={2.1} />
        <circle cx={146} cy={130} r={1.8} />
        <circle cx={62} cy={178} r={2.4} />
        <circle cx={70} cy={186} r={1.9} />
      </g>
      {/* roses */}
      <Rose id={id} cx={84} cy={92} r={30} rotate={10} />
      <Rose id={id} cx={132} cy={132} r={21} rotate={-28} tone="blush" />
      <Rose id={id} cx={52} cy={142} r={19} rotate={44} />
      {/* small bud */}
      <g transform="translate(166 92) rotate(-20)">
        <path d="M0 0 C-5 -8, -3 -18, 0 -22 C3 -18, 5 -8, 0 0Z" fill={`url(#${id}-ivory)`} stroke="#d6c6a6" strokeWidth={0.6} />
        <path d="M-3 -2 l-4 -6 M3 -2 l4 -6" stroke="var(--leaf, #4f6b52)" strokeWidth={0.8} fill="none" />
      </g>
    </svg>
  );
}
