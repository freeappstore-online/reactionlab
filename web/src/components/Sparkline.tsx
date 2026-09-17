const VB_W = 320;
const VB_H = 84;
const PAD_X = 4;
const PAD_TOP = 10;
const PAD_BOTTOM = 16;

export interface SparklinePoint {
  readonly value: number;
  readonly label: string;
}

interface SparklineProps {
  /** Chronological, oldest first. */
  readonly points: readonly SparklinePoint[];
  readonly unit: string;
  /** Reaction times are better when lower; scores are better when higher. */
  readonly lowerIsBetter: boolean;
  readonly caption: string;
}

/**
 * A hand-rolled SVG trend line.
 *
 * A charting library would be by far the largest thing in the bundle for the
 * sake of one polyline, so this draws it directly. Uniform `preserveAspectRatio`
 * keeps the axis labels undistorted at any width.
 */
export function Sparkline({
  points,
  unit,
  lowerIsBetter,
  caption,
}: SparklineProps): React.ReactElement {
  if (points.length < 2) {
    return (
      <p className="card__note">
        {points.length === 0
          ? 'No runs recorded yet.'
          : 'One run recorded — finish another to see a trend.'}
      </p>
    );
  }

  const values = points.map((p) => p.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  // A flat series would divide by zero; give it a nominal band instead.
  const span = rawMax - rawMin;
  const pad = span === 0 ? Math.max(1, rawMax * 0.1) : span * 0.15;
  const min = rawMin - pad;
  const max = rawMax + pad;

  const plotW = VB_W - PAD_X * 2;
  const plotH = VB_H - PAD_TOP - PAD_BOTTOM;

  const x = (i: number): number => PAD_X + (plotW * i) / (points.length - 1);
  const y = (v: number): number => PAD_TOP + plotH - ((v - min) / (max - min)) * plotH;

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(p.value).toFixed(2)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(2)},${(PAD_TOP + plotH).toFixed(2)} L${x(0).toFixed(2)},${(PAD_TOP + plotH).toFixed(2)} Z`;

  const last = points[points.length - 1];
  const first = points[0];
  if (last === undefined || first === undefined) return <p className="card__note">No data.</p>;

  const delta = last.value - first.value;
  const improved = lowerIsBetter ? delta < 0 : delta > 0;
  const trend =
    delta === 0
      ? 'flat across this range'
      : `${improved ? 'improved' : 'slipped'} by ${Math.abs(Math.round(delta))}${unit} since the first of these runs`;

  return (
    <figure style={{ margin: 0 }}>
      <svg
        className="spark"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        role="img"
        aria-label={`${caption}. ${points.length} runs, ${trend}. Latest ${Math.round(last.value)}${unit}.`}
      >
        <line
          className="spark__base"
          x1={PAD_X}
          y1={PAD_TOP + plotH}
          x2={VB_W - PAD_X}
          y2={PAD_TOP + plotH}
        />
        <path className="spark__area" d={area} />
        <path className="spark__line" d={line} />
        <circle className="spark__dot" cx={x(points.length - 1)} cy={y(last.value)} r={3} />
        <text className="spark__label" x={PAD_X} y={VB_H - 4}>
          {first.label}
        </text>
        <text className="spark__label" x={VB_W - PAD_X} y={VB_H - 4} textAnchor="end">
          {last.label}
        </text>
        <text className="spark__label" x={PAD_X} y={PAD_TOP - 2}>
          {Math.round(rawMin)}–{Math.round(rawMax)}
          {unit}
        </text>
      </svg>
      <figcaption className="card__note">
        {caption} — {trend}.
      </figcaption>
    </figure>
  );
}
