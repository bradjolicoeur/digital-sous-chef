import { Link, useLocation } from 'react-router-dom';
import { Plus, LogIn, LogOut } from 'lucide-react';
import { useFusionAuth } from '@fusionauth/react-sdk';
import { cn } from '../lib/utils';

const TopNavBar = () => {
  const location = useLocation();
  const { isLoggedIn, startLogin, startLogout, userInfo } = useFusionAuth();

  const navLinks = [
    { name: 'Gallery', path: '/gallery' },
    { name: 'Planner', path: '/planner' },
    { name: 'Grocery List', path: '/grocery' },
  ];

  return (
    <nav className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-md shadow-sm">
      <div className="flex justify-between items-center px-8 h-20 w-full max-w-screen-2xl mx-auto">
        <Link to="/" className="text-2xl font-headline font-bold text-primary">
          Digital Sous-Chef
        </Link>

        <div className="hidden md:flex items-center space-x-8 font-headline italic font-medium tracking-tight">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={cn(
                "transition-colors hover:text-primary",
                location.pathname === link.path ? "text-primary border-b-2 border-primary pb-1" : "text-on-surface-variant"
              )}
            >
              {link.name}
            </Link>
          ))}
        </div>

        <div className="flex items-center space-x-4 text-primary">
          <Link to="/recipes/new" className="hover:bg-surface-container-low p-2 rounded-full transition-colors" title="Add new recipe">
            <Plus size={24} />
          </Link>
          {isLoggedIn ? (
            <div className="flex items-center gap-2">
              <span className="hidden sm:block text-sm font-medium text-on-surface-variant">
                {userInfo?.given_name ?? userInfo?.email ?? 'Chef'}
              </span>
              <button
                onClick={() => startLogout()}
                title="Sign out"
                className="hover:bg-surface-container-low p-2 rounded-full transition-colors"
              >
                <LogOut size={24} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => startLogin()}
              title="Sign in"
              className="hover:bg-surface-container-low p-2 rounded-full transition-colors"
            >
              <LogIn size={24} />
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default TopNavBar;
