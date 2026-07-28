// ABOUTME: Sticky marketing nav for the public landing page.
// ABOUTME: Separate from layout/Navbar, which is authenticated app chrome and requires SidebarProvider.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LINKS = [
  { label: 'Courses', to: '/courses' },
  { label: 'Career Paths', to: '#career-paths' },
  { label: 'Tools', to: '#career-tools' },
  { label: 'Blueprint', to: '/blog' },
];

const PublicNavBar = () => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const renderLink = (link: (typeof LINKS)[number], onClick?: () => void) =>
    link.to.startsWith('#') ? (
      <a
        key={link.label}
        href={link.to}
        onClick={onClick}
        className="text-studio-muted hover:text-studio-ink transition-colors font-medium"
      >
        {link.label}
      </a>
    ) : (
      <Link
        key={link.label}
        to={link.to}
        onClick={onClick}
        className="text-studio-muted hover:text-studio-ink transition-colors font-medium"
      >
        {link.label}
      </Link>
    );

  return (
    <header
      className={`sticky top-0 z-50 transition-shadow ${
        scrolled ? 'shadow-[0_1px_0_rgba(44,42,51,0.12)]' : ''
      }`}
      style={{ background: 'rgba(250,248,245,0.92)', backdropFilter: 'blur(10px)' }}
    >
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex items-center gap-6 h-[72px]">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg text-studio-ink shrink-0">
            <GraduationCap className="h-5 w-5 text-studio-lavDeep" aria-hidden="true" />
            Insights Collective
          </Link>

          <nav className="hidden md:flex items-center gap-6 ml-auto text-[15px]" aria-label="Main">
            {LINKS.map((l) => renderLink(l))}
            <Link to="/login" className="text-studio-muted hover:text-studio-ink transition-colors font-medium">
              Sign In
            </Link>
          </nav>

          <Button
            asChild
            className="hidden md:inline-flex ml-2 rounded-full bg-studio-lavDeep hover:bg-studio-lavDeeper text-white"
          >
            <Link to="/register">Get Started</Link>
          </Button>

          <button
            type="button"
            className="md:hidden ml-auto p-2 text-studio-ink"
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-studio-border bg-studio-ground">
          <nav className="container mx-auto px-4 py-4 flex flex-col gap-4" aria-label="Mobile">
            {LINKS.map((l) => renderLink(l, () => setOpen(false)))}
            <Link to="/login" onClick={() => setOpen(false)} className="text-studio-muted font-medium">
              Sign In
            </Link>
            <Button asChild className="rounded-full bg-studio-lavDeep hover:bg-studio-lavDeeper text-white w-full">
              <Link to="/register" onClick={() => setOpen(false)}>Get Started</Link>
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
};

export default PublicNavBar;
