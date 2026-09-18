export default function AppHeader({ roleLabel, onToggleRole }) {
  return (
    <div className="app-header">
      <div className="app-header-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/isotipo-hurgo-claro.svg" alt="Hurgo Transporte Logística" className="app-header-logo" />
        <span className="app-header-txt">
          <span className="app-header-nombre">Hurgo Transporte</span>
          <span className="app-header-sub">Logística</span>
        </span>
      </div>
      {roleLabel && (
        <button className="app-header-role" onClick={onToggleRole}>{roleLabel} ⇄</button>
      )}
    </div>
  );
}
