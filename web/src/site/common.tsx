import { formatNumber } from '../core/engine';
import type { Finding } from '../core/model';

export function download(name: string, data: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Photo({
  src,
  alt,
  credit,
  eager = false,
}: {
  src: string;
  alt: string;
  credit: string;
  eager?: boolean;
}) {
  const size: Record<string, [number, number]> = {
    '/images/exercise-context-original.webp': [1536, 1024],
    '/images/health-context-original.webp': [1536, 1024],
    '/images/exercise-research-original.webp': [1536, 1024],
  };
  const [width, height] = size[src] ?? [1536, 1024];
  return (
    <figure className="s-photo">
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : undefined}
      />
      <figcaption>{credit}</figcaption>
    </figure>
  );
}

/** "rose 5%", "fell 2%" or "did not change", read from the engine's comparison. */
export function movement(f: Finding, verbs: [string, string] = ['rose', 'fell']): string {
  const c = f.comparison;
  if (!c) return 'has no supported change';
  if (c.direction === 'unchanged') return 'did not change';
  const size =
    c.relative !== null
      ? `${formatNumber(Math.abs(c.relative))}%`
      : `${formatNumber(Math.abs(c.absolute))} ${c.changeUnit}`;
  return `${c.direction === 'increased' ? verbs[0] : verbs[1]} ${size}`;
}
