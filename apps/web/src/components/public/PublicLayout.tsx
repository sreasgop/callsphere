import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Grip } from 'lucide-react';
import { Button } from '../ui/Button';

export function PublicLayout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `relative py-1 text-sm transition-colors ${
      isActive
        ? 'text-text-primary font-medium after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:bg-accent'
        : 'text-text-secondary hover:text-text-primary'
    }`;

  const mobileNavClass = ({ isActive }: { isActive: boolean }) =>
    `block px-3 py-2.5 rounded-md text-sm transition-colors ${
      isActive
        ? 'bg-accent-muted text-text-primary font-medium border border-accent-border'
        : 'text-text-secondary hover:bg-hover hover:text-text-primary'
    }`;

  return (
    <div className="min-h-dvh bg-canvas text-text-primary flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border-subtle bg-canvas/85 backdrop-blur-md">
        <div className="max-w-[1120px] mx-auto h-16 px-6 flex items-center justify-between gap-4">
          <Link
            to="/"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2.5 text-text-primary font-semibold tracking-[-0.02em]"
          >
            <span className="size-7 rounded-sm bg-elevated border border-border-default flex items-center justify-center text-text-primary">
              <Grip className="size-4" strokeWidth={1.75} />
            </span>
            <span>CallSphere</span>
          </Link>

          <nav className="hidden md:flex items-center gap-7">
            <NavLink to="/" end className={navClass}>
              Features
            </NavLink>
            <NavLink to="/team" className={navClass}>
              The Team
            </NavLink>
            <NavLink to="/architecture" className={navClass}>
              Architecture
            </NavLink>
            <NavLink to="/contact" className={navClass}>
              Contact
            </NavLink>
          </nav>

          <div className="flex items-center gap-2.5">
            <Link to="/auth" className="hidden sm:inline-flex">
              <Button size="sm" pill>
                Login / Register
              </Button>
            </Link>

            {/* Animated Mobile Hamburger <-> Cross Button */}
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={menuOpen}
              className="md:hidden size-9 rounded-md bg-surface border border-border-default flex flex-col items-center justify-center gap-[4px] cursor-pointer"
            >
              <span
                className={`block w-4 h-[1.5px] bg-text-primary rounded-full transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${
                  menuOpen ? 'translate-y-[5.5px] rotate-45' : ''
                }`}
              />
              <span
                className={`block w-4 h-[1.5px] bg-text-primary rounded-full transition-all duration-200 ${
                  menuOpen ? 'opacity-0 scale-x-0' : 'opacity-100 scale-x-100'
                }`}
              />
              <span
                className={`block w-4 h-[1.5px] bg-text-primary rounded-full transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${
                  menuOpen ? '-translate-y-[5.5px] -rotate-45' : ''
                }`}
              />
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        <div
          className={`md:hidden overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${
            menuOpen ? 'max-h-80 opacity-100 border-t border-border-subtle' : 'max-h-0 opacity-0'
          }`}
        >
          <nav className="px-6 py-4 bg-surface/95 space-y-1">
            <NavLink to="/" end className={mobileNavClass} onClick={() => setMenuOpen(false)}>
              Features
            </NavLink>
            <NavLink to="/team" className={mobileNavClass} onClick={() => setMenuOpen(false)}>
              The Team
            </NavLink>
            <NavLink
              to="/architecture"
              className={mobileNavClass}
              onClick={() => setMenuOpen(false)}
            >
              Architecture
            </NavLink>
            <NavLink to="/contact" className={mobileNavClass} onClick={() => setMenuOpen(false)}>
              Contact
            </NavLink>
            <div className="pt-2">
              <Link to="/auth" onClick={() => setMenuOpen(false)}>
                <Button className="w-full" pill>
                  Login / Register
                </Button>
              </Link>
            </div>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border-subtle bg-surface/40">
        <div className="max-w-[1120px] mx-auto px-6 py-14 grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <div className="flex items-center gap-2 font-semibold text-text-primary">
              <Grip className="size-4 text-accent" strokeWidth={1.75} />
              <span>CallSphere</span>
            </div>
            <p className="mt-3 text-sm text-text-muted max-w-[32ch] leading-relaxed">
              The SIM-free communication network. Dialing the future, one 10-digit UID at a time.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 text-sm">
            <span className="text-[11px] uppercase font-semibold tracking-[0.08em] text-text-muted mb-1">
              Explore
            </span>
            <Link to="/" className="text-text-secondary hover:text-text-primary">
              Features
            </Link>
            <Link to="/team" className="text-text-secondary hover:text-text-primary">
              Our Team
            </Link>
            <Link to="/architecture" className="text-text-secondary hover:text-text-primary">
              Architecture
            </Link>
            <Link to="/contact" className="text-text-secondary hover:text-text-primary">
              Contact
            </Link>
          </div>

          <div className="flex flex-col gap-2.5 text-sm">
            <span className="text-[11px] uppercase font-semibold tracking-[0.08em] text-text-muted mb-1">
              Workspace
            </span>
            <Link to="/auth" className="text-text-secondary hover:text-text-primary">
              Access Web Phone
            </Link>
            <Link to="/architecture" className="text-text-secondary hover:text-text-primary">
              System Specification
            </Link>
            <Link to="/contact" className="text-text-secondary hover:text-text-primary">
              Report Issue
            </Link>
          </div>
        </div>

        <div className="border-t border-border-subtle">
          <div className="max-w-[1120px] mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-text-muted">
            <span>2026 CallSphere Systems</span>
            <span className="font-mono">WebRTC + Flask-SocketIO Baseline</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
