export default function AppHeader({ roleLabel, onToggleRole }) {
  return (
    <div className="app-header">
      <div className="app-header-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Hurgo Transporte Logística" className="app-header-logo" />
      </div>
      {roleLabel && (
        <button className="app-header-role" onClick={onToggleRole}>{roleLabel} ⇄</button>
      )}
    </div>
  );
}
