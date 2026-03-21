import React from 'react';
import { NavLink } from 'react-router-dom';
import { UtensilsCrossed, Calendar, Plus, ShoppingBasket, User } from 'lucide-react';
import { cn } from '../lib/utils';

export function BottomNavBar() {
  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-6 pb-6 pt-3 lg:hidden bg-surface/90 backdrop-blur-xl border-t border-primary/10 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      <NavLink to="/gallery" className={({ isActive }) => cn(
        "flex flex-col items-center justify-center transition-colors",
        isActive ? "text-primary" : "text-on-surface-variant/60"
      )}>
        <UtensilsCrossed size={24} />
        <span className="text-[10px] uppercase tracking-widest mt-1 font-bold">Gallery</span>
      </NavLink>
      
      <NavLink to="/planner" className={({ isActive }) => cn(
        "flex flex-col items-center justify-center transition-colors",
        isActive ? "text-primary" : "text-on-surface-variant/60"
      )}>
        <Calendar size={24} />
        <span className="text-[10px] uppercase tracking-widest mt-1 font-bold">Planner</span>
      </NavLink>

      <NavLink to="/" className="flex flex-col items-center justify-center bg-primary text-on-primary rounded-full p-4 -mt-10 shadow-lg scale-110 active:scale-95 transition-transform">
        <Plus size={24} />
      </NavLink>

      <NavLink to="/grocery" className={({ isActive }) => cn(
        "flex flex-col items-center justify-center transition-colors",
        isActive ? "text-primary" : "text-on-surface-variant/60"
      )}>
        <ShoppingBasket size={24} />
        <span className="text-[10px] uppercase tracking-widest mt-1 font-bold">Grocery</span>
      </NavLink>

      <NavLink to="/profile" className={({ isActive }) => cn(
        "flex flex-col items-center justify-center transition-colors",
        isActive ? "text-primary" : "text-on-surface-variant/60"
      )}>
        <User size={24} />
        <span className="text-[10px] uppercase tracking-widest mt-1 font-bold">Profile</span>
      </NavLink>
    </nav>
  );
}
