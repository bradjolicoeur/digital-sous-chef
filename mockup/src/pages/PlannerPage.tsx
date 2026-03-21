import React from 'react';
import { Search, Plus, Info, ShoppingBasket, ChevronDown, ChevronRight } from 'lucide-react';

export function PlannerPage() {
  const days = [
    { name: 'Monday', date: '23 Oct' },
    { name: 'Tuesday', date: '24 Oct' },
    { name: 'Wednesday', date: '25 Oct' },
    { name: 'Thursday', date: '26 Oct' },
    { name: 'Friday', date: '27 Oct' },
    { name: 'Saturday', date: '28 Oct' },
    { name: 'Sunday', date: '29 Oct' },
  ];

  return (
    <main className="pt-24 pb-32 px-4 md:px-8 max-w-screen-2xl mx-auto min-h-screen">
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="max-w-2xl">
          <h1 className="font-headline text-5xl text-on-surface tracking-tight leading-none mb-4">The Weekly Canvas</h1>
          <p className="font-headline italic text-xl text-on-surface-variant">Design your nourishment for the week of October 23rd.</p>
        </div>
        <div className="flex items-center gap-3 bg-surface-container-low p-1 rounded-full">
          <button className="px-6 py-2 rounded-full text-sm font-medium bg-surface-container-lowest shadow-sm text-primary">Weekly</button>
          <button className="px-6 py-2 rounded-full text-sm font-medium text-on-surface-variant hover:bg-surface-container-high transition-colors">Monthly</button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-grow space-y-8 overflow-hidden">
          <div className="hidden lg:grid grid-cols-7 gap-4">
            {days.map(day => (
              <div key={day.name} className="text-center pb-4">
                <p className="font-headline text-lg italic">{day.name}</p>
                <p className="text-[10px] tracking-widest uppercase opacity-50 font-bold">{day.date}</p>
              </div>
            ))}
            
            {days.map(day => (
              <div key={day.name} className="space-y-4">
                <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/10 shadow-sm min-h-[140px] flex flex-col group cursor-pointer hover:editorial-shadow transition-all">
                  <span className="text-[10px] font-bold uppercase tracking-tighter text-tertiary mb-2 block">Breakfast</span>
                  {day.name === 'Monday' ? (
                    <div className="flex-grow">
                      <img 
                        className="w-full h-20 object-cover rounded-lg mb-2" 
                        src="https://images.unsplash.com/photo-1494390248081-4e521a5940db?auto=format&fit=crop&q=80&w=400" 
                        alt="Smoothie"
                        referrerPolicy="no-referrer"
                      />
                      <h4 className="text-[10px] font-bold line-clamp-2">Berry Acai Bowl</h4>
                    </div>
                  ) : (
                    <div className="flex-grow flex items-center justify-center text-primary/30 group-hover:text-primary">
                      <Plus size={24} />
                    </div>
                  )}
                </div>

                <div className="bg-surface-container-low p-3 rounded-xl border border-outline-variant/10 flex flex-col justify-center items-center gap-2 group cursor-pointer hover:bg-white transition-all min-h-[140px]">
                  <span className="text-[10px] font-bold uppercase tracking-tighter text-on-surface-variant/50">Lunch</span>
                  <Plus className="text-primary/30 group-hover:text-primary transition-colors" size={24} />
                </div>

                <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/10 shadow-sm min-h-[140px] flex flex-col group cursor-pointer hover:editorial-shadow transition-all">
                  <span className="text-[10px] font-bold uppercase tracking-tighter text-secondary mb-2 block">Dinner</span>
                  {day.name === 'Monday' ? (
                    <div className="flex-grow">
                      <img 
                        className="w-full h-20 object-cover rounded-lg mb-2" 
                        src="https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&q=80&w=400" 
                        alt="Salmon"
                        referrerPolicy="no-referrer"
                      />
                      <h4 className="text-[10px] font-bold line-clamp-2">Honey Glazed Salmon</h4>
                    </div>
                  ) : (
                    <div className="flex-grow flex items-center justify-center text-primary/30 group-hover:text-primary">
                      <Plus size={24} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="lg:hidden flex flex-col gap-6">
            {days.slice(0, 2).map(day => (
              <div key={day.name} className="bg-surface-container-low p-6 rounded-3xl">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-headline text-2xl italic">{day.name}</h3>
                    <p className="text-xs uppercase tracking-widest opacity-60 font-bold">{day.date}</p>
                  </div>
                  <ChevronDown className="text-primary" />
                </div>
                <div className="space-y-3">
                  <div className="bg-surface-container-lowest p-4 rounded-2xl flex items-center gap-4">
                    <img className="w-16 h-16 object-cover rounded-xl" src="https://images.unsplash.com/photo-1494390248081-4e521a5940db?auto=format&fit=crop&q=80&w=200" alt="Smoothie" referrerPolicy="no-referrer" />
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-tertiary">Breakfast</span>
                      <p className="font-medium text-sm">Berry Acai Bowl</p>
                    </div>
                  </div>
                  <div className="border-2 border-dashed border-outline-variant/30 p-4 rounded-2xl flex items-center justify-center gap-2 text-on-surface-variant/40">
                    <Plus size={18} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Add Lunch</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="lg:w-80 shrink-0">
          <div className="sticky top-28 space-y-6">
            <div className="bg-surface-container-high/40 p-8 rounded-[2rem] backdrop-blur-sm">
              <h2 className="font-headline text-2xl italic mb-6">Daily Thresholds</h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                    <span>Calories</span>
                    <span className="text-primary">1,420 / 2,100</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: '68%' }}></div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-[8px] uppercase font-bold text-on-surface-variant/50 mb-1">Carbs</p>
                    <p className="text-sm font-medium">142g</p>
                    <div className="h-1 mt-1 bg-tertiary/20 rounded-full overflow-hidden">
                      <div className="h-full bg-tertiary" style={{ width: '45%' }}></div>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-[8px] uppercase font-bold text-on-surface-variant/50 mb-1">Protein</p>
                    <p className="text-sm font-medium">88g</p>
                    <div className="h-1 mt-1 bg-primary/20 rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: '70%' }}></div>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-[8px] uppercase font-bold text-on-surface-variant/50 mb-1">Fats</p>
                    <p className="text-sm font-medium">54g</p>
                    <div className="h-1 mt-1 bg-secondary/20 rounded-full overflow-hidden">
                      <div className="h-full bg-secondary" style={{ width: '30%' }}></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-10 p-4 bg-tertiary-container/10 rounded-2xl border border-tertiary-container/20">
                <div className="flex items-center gap-3 mb-2">
                  <Info className="text-tertiary" size={16} />
                  <span className="text-[10px] font-bold uppercase tracking-tight text-tertiary">Sous-Chef Tip</span>
                </div>
                <p className="text-[10px] text-on-tertiary-container/80 leading-relaxed">
                  You're short on protein for Tuesday. Consider adding a greek yogurt snack to hit your target.
                </p>
              </div>
            </div>
            <button className="w-full bg-primary hover:bg-primary-container text-white rounded-full py-4 px-6 font-bold text-xs tracking-widest uppercase flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-primary/20">
              <ShoppingBasket size={18} />
              Generate Grocery List
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}
