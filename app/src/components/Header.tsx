import { Menu, X, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GitHubIcon } from '@/components/icons/brand-icons';
import { getNavigation } from '../../../config/navigation';

const mode = import.meta.env.MODE === 'production' ? 'production' : 'development';
const navItems = getNavigation(mode);

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-lg">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="ProtSpace" className="h-8 w-8" />
            <span className="text-xl font-bold">ProtSpace</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navItems.map((item) => {
              const isGitHub = item.icon === 'github';
              const linkClasses = isGitHub
                ? 'text-foreground hover:text-primary transition-colors'
                : 'text-sm font-medium text-foreground hover:text-primary transition-colors';

              // Dropdown menu
              if (item.items) {
                return (
                  <div key={item.text} className="relative group">
                    <button className="flex items-center gap-1 text-sm font-medium text-foreground hover:text-primary transition-colors">
                      {item.text}
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <div className="absolute top-full right-0 mt-2 w-48 bg-background border border-border/40 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                      {item.items.map((subItem) => (
                        <a
                          key={subItem.text}
                          href={subItem.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block px-4 py-2 text-sm text-foreground hover:text-primary hover:bg-muted/50 first:rounded-t-lg last:rounded-b-lg transition-colors"
                        >
                          {subItem.text}
                        </a>
                      ))}
                    </div>
                  </div>
                );
              }

              // Internal link
              if (item.internal && item.link) {
                return (
                  <Link key={item.text} to={item.link} className={linkClasses}>
                    {item.text}
                  </Link>
                );
              }

              // External link
              return (
                <a
                  key={item.text}
                  href={item.link}
                  className={linkClasses}
                  {...(item.target && {
                    target: item.target,
                    rel: 'noopener noreferrer',
                  })}
                  {...(isGitHub && { 'aria-label': 'View on GitHub' })}
                >
                  {isGitHub ? <GitHubIcon className="h-5 w-5" /> : item.text}
                </a>
              );
            })}
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden text-foreground hover:text-primary transition-colors"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="md:hidden py-4 space-y-3 border-t border-border/40">
            {navItems.map((item) => {
              const isGitHub = item.icon === 'github';
              const linkClasses = isGitHub
                ? 'flex items-center gap-2 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors'
                : 'block py-2 text-sm font-medium text-foreground hover:text-primary transition-colors';

              // Dropdown menu
              if (item.items) {
                return (
                  <div key={item.text}>
                    <button
                      onClick={() => setOpenDropdown(openDropdown === item.text ? null : item.text)}
                      className="flex items-center justify-between w-full py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
                    >
                      {item.text}
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          openDropdown === item.text ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {openDropdown === item.text && (
                      <div className="pl-4 space-y-2 mt-2">
                        {item.items.map((subItem) => (
                          <a
                            key={subItem.text}
                            href={subItem.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block py-2 text-sm text-foreground/80 hover:text-primary transition-colors"
                          >
                            {subItem.text}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              // Internal link (SPA navigation - needs onClick to close menu)
              if (item.internal && item.link) {
                return (
                  <Link
                    key={item.text}
                    to={item.link}
                    className={linkClasses}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.text}
                  </Link>
                );
              }

              // External link (full page load - onClick is redundant but harmless)
              return (
                <a
                  key={item.text}
                  href={item.link}
                  className={linkClasses}
                  {...(item.target && {
                    target: item.target,
                    rel: 'noopener noreferrer',
                  })}
                >
                  {isGitHub && <GitHubIcon className="h-4 w-4" />}
                  {item.text}
                </a>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
