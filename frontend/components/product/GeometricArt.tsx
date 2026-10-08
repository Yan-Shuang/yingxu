export default function GeometricArt({ playing = false, compact = false }: { playing?: boolean; compact?: boolean }) {
  return (
    <div className={`yx-geometry${playing ? " is-playing" : ""}${compact ? " is-compact" : ""}`} aria-hidden="true">
      <div className="yx-geo-tile yx-geo-left" />
      <div className="yx-geo-tile yx-geo-corner" />
      <div className="yx-geo-ring" />
      <div className="yx-geo-tile yx-geo-bottom" />
      <div className="yx-geo-tile yx-geo-plate" />
      <div className="yx-geo-frame"><div className="yx-geo-picture" /><div className="yx-geo-frame-label"><span>01 / AN IDEA</span><i /></div></div>
      <span className="yx-geo-word">TAKE SHAPE.</span>
    </div>
  );
}
