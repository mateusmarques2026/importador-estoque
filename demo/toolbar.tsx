import "./demo.css";
export default function DemoToolbar({
  repo,
  roles,
  role,
  onRole,
  onReset,
}: {
  repo: string;
  roles?: [string, string][];
  role?: string;
  onRole?: (role: string) => void;
  onReset: () => void;
}) {
  return (
    <aside className="demo-toolbar" aria-label="Controles da demonstração">
      <div>
        <strong>Demonstração interativa · GitHub Pages</strong>
        <p>Dados fictícios salvos só neste navegador. Sem login real ou envio ao servidor.</p>
      </div>
      <div className="demo-actions">
        {roles?.map(([value, label]) => (
          <button key={value} aria-pressed={role === value} onClick={() => onRole?.(value)}>
            {label}
          </button>
        ))}
        <button
          onClick={() => {
            if (confirm("Reiniciar os dados desta demonstração no seu navegador?")) onReset();
          }}
        >
          Reiniciar demonstração
        </button>
        <a href={"https://github.com/mateusmarques2026/" + repo} target="_blank" rel="noreferrer">
          Ver código ↗
        </a>
      </div>
    </aside>
  );
}
