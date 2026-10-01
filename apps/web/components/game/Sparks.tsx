/** A one-shot burst of flame-coloured sparks for celebrations (pure CSS, see .spark-* in globals.css). */
export function Sparks({ burst }: { burst: number }) {
  if (!burst) return null;
  return (
    <div key={burst} className="pointer-events-none absolute inset-0 overflow-hidden z-40" aria-hidden="true">
      {Array.from({ length: 28 }, (_, i) => (
        <span key={i} className={`spark spark-${i}`} />
      ))}
    </div>
  );
}
