import { NavLink } from 'react-router-dom';
import './Navbar.css';

export default function Navbar() {
  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      <div className="navbar__inner">
        <NavLink to="/" className="navbar__brand" aria-label="Home">
          <span className="navbar__logo" aria-hidden="true">🛡️</span>
          <span className="navbar__title">Phishing Triage</span>
          <span className="navbar__badge">Kill Chain Analyzer</span>
        </NavLink>

        <div className="navbar__links">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `navbar__link ${isActive ? 'navbar__link--active' : ''}`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 10L8 3L12 10H4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 13H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Upload
          </NavLink>
          <NavLink
            to="/history"
            className={({ isActive }) => `navbar__link ${isActive ? 'navbar__link--active' : ''}`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M2 6H14" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M5.5 3V1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M10.5 3V1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            History
          </NavLink>
        </div>
      </div>
    </nav>
  );
}
