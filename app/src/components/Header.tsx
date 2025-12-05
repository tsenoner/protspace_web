import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GitHubIcon } from '@/components/icons/brand-icons';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-lg">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-primary" />
            <span className="text-xl font-bold">ProtSpace</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <a
              href="#home"
              className="text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              Home
            </a>
            <a
              href="/docs/"
              className="text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              Docs
            </a>
            <Link
              to="/explore"
              className="text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              Explore
            </Link>
            <a
              href="https://github.com/tsenoner/protspace_web"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:text-primary transition-colors"
              aria-label="View on GitHub"
            >
              <GitHubIcon className="h-5 w-5" />
            </a>
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
            <a
              href="#home"
              className="block py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Home
            </a>
            <a
              href="/docs/"
              className="block py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Docs
            </a>
            <Link
              to="/explore"
              className="block py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Explore
            </Link>
            <a
              href="https://github.com/tsenoner/protspace_web"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              <GitHubIcon className="h-4 w-4" />
              GitHub
            </a>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
