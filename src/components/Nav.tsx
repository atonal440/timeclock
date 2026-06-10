
interface NavProps {
  tab: string;
  setTab: (tab: string) => void;
}

const TABS = [
  { id: 'clock', icon: '⏱', label: 'Clock' },
  { id: 'log', icon: '📋', label: 'Log' },
  { id: 'projects', icon: '⚙', label: 'Projects' }
];

export function Nav({ tab, setTab }: NavProps) {
  return (
    <nav className="nav">
      {TABS.map(({ id, icon, label }) => (
        <button
          key={id}
          className={`nav-btn ${tab === id ? 'active' : ''}`}
          onClick={() => setTab(id)}
        >
          <span className="nav-icon">{icon}</span>
          <span className="nav-label">{label}</span>
        </button>
      ))}
    </nav>
  );
}
