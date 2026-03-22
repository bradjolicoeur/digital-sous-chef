import { NavLink } from 'react-router-dom';
import { Coffee, Utensils, Moon, IceCream, Cookie, Settings, HelpCircle, Plus } from 'lucide-react';
import { useFusionAuth } from '@fusionauth/react-sdk';
import { cn } from '../lib/utils';

const SideNavBar = () => {
  const { userInfo } = useFusionAuth();
  const categories = [
    { name: 'Breakfast', icon: Coffee, path: '/gallery/breakfast' },
    { name: 'Lunch', icon: Utensils, path: '/gallery/lunch' },
    { name: 'Dinner', icon: Moon, path: '/gallery/dinner' },
    { name: 'Desserts', icon: IceCream, path: '/gallery/desserts' },
    { name: 'Snacks', icon: Cookie, path: '/gallery/snacks' },
  ];

  return (
    <aside className="hidden lg:flex flex-col py-8 px-4 h-[calc(100vh-5rem)] w-64 sticky top-20 bg-surface-container-low">
      <div className="mb-8 px-4">
        <h2 className="font-headline text-xl text-primary">My Kitchen</h2>
        <p className="text-on-surface-variant text-[10px] uppercase tracking-widest mt-1 font-bold">
          {userInfo?.given_name
            ? `${userInfo.given_name}${userInfo.family_name ? ' ' + userInfo.family_name : ''}`
            : userInfo?.email ?? 'Chef de Cuisine'}
        </p>
      </div>

      <nav className="flex-1 space-y-2">
        {categories.map((cat) => (
          <NavLink
            key={cat.name}
            to={cat.path}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-4 py-3 transition-all font-body text-sm font-medium rounded-r-full",
              isActive
                ? "bg-primary/10 text-primary font-bold"
                : "text-on-surface-variant hover:translate-x-1 hover:text-primary"
            )}
          >
            <cat.icon size={18} />
            <span>{cat.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto pt-8 space-y-2 border-t border-outline-variant/20">
        <button className="w-full bg-primary text-on-primary py-3 rounded-full font-medium text-sm mb-4 flex items-center justify-center gap-2 hover:bg-primary-container transition-colors">
          <Plus size={16} />
          New Collection
        </button>
        <NavLink to="/settings" className="flex items-center gap-3 px-4 py-2 text-on-surface-variant text-sm hover:text-primary transition-colors">
          <Settings size={18} />
          <span>Settings</span>
        </NavLink>
        <NavLink to="/support" className="flex items-center gap-3 px-4 py-2 text-on-surface-variant text-sm hover:text-primary transition-colors">
          <HelpCircle size={18} />
          <span>Support</span>
        </NavLink>
      </div>
    </aside>
  );
};

export default SideNavBar;
