import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Info, ShoppingBasket, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { getMealPlan, assignSlot, removeSlot } from '../api/planner';
import { generateList } from '../api/grocery';
import RecipePickerModal from '../components/RecipePickerModal';
import type { MealPlan, MealType, MealSlot, MealSlotRecipe, RecipeSummary } from '../types';

function getWeekStartDate(): string {
  const today = new Date();
  const day = today.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  return monday.toISOString().split('T')[0];
}

function getDaysOfWeek(weekStart: string) {
  const start = new Date(weekStart + 'T00:00:00');
  const days = [];
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    days.push({
      name: dayNames[i],
      date: date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
      isoDate: date.toISOString().split('T')[0],
    });
  }
  return days;
}

const MEAL_TYPES: MealType[] = ['Breakfast', 'Lunch', 'Dinner'];

const PlannerPage = () => {
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(getWeekStartDate);

  const navigateWeek = (delta: number) => {
    const date = new Date(weekStart + 'T00:00:00');
    date.setDate(date.getDate() + delta * 7);
    setWeekStart(date.toISOString().split('T')[0]);
  };

  const isCurrentWeek = weekStart === getWeekStartDate();
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; mealType: MealType } | null>(null);

  const days = getDaysOfWeek(weekStart);

  const loadPlan = useCallback(() => {
    setLoading(true);
    getMealPlan(weekStart).then(setPlan).finally(() => setLoading(false));
  }, [weekStart]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  const getSlot = (date: string, mealType: MealType): MealSlot | undefined =>
    plan?.slots.find(s => s.date === date && s.mealType === mealType);

  const handleOpenPicker = (date: string, mealType: MealType) => {
    setSelectedSlot({ date, mealType });
    setPickerOpen(true);
  };

  const handleSelectRecipe = async (recipe: RecipeSummary) => {
    if (!selectedSlot) return;
    const updated = await assignSlot(weekStart, selectedSlot.date, selectedSlot.mealType, recipe.id);
    setPlan(updated);
  };

  const handleRemoveRecipe = async (date: string, mealType: MealType, recipeId: string) => {
    const updated = await removeSlot(weekStart, date, mealType, recipeId);
    setPlan(updated);
  };

  const handleGenerateGroceryList = async () => {
    await generateList(weekStart);
    navigate('/grocery');
  };

  // Compute daily nutrition (hardcoded targets for v1)
  const dailyTargets = { calories: 2100, carbs: 200, protein: 125, fat: 70 };

  const weekStartFormatted = new Date(weekStart + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric',
  });
  const weekEndDate = new Date(weekStart + 'T00:00:00');
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  const weekEndFormatted = weekEndDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  if (loading) {
    return <div className="pt-32 text-center text-on-surface-variant">Loading planner...</div>;
  }

  return (
    <main className="pt-24 pb-32 px-4 md:px-8 max-w-screen-2xl mx-auto min-h-screen">
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="max-w-2xl">
          <h1 className="font-headline text-5xl text-on-surface tracking-tight leading-none mb-4">The Weekly Canvas</h1>
          <p className="font-headline italic text-xl text-on-surface-variant">Design your nourishment for {weekStartFormatted} – {weekEndFormatted}.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateWeek(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-low hover:bg-surface-container-high transition-colors"
            aria-label="Previous week"
          >
            <ChevronLeft size={20} />
          </button>
          {!isCurrentWeek && (
            <button
              onClick={() => setWeekStart(getWeekStartDate())}
              className="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest bg-surface-container-low hover:bg-surface-container-high text-primary transition-colors"
            >
              Today
            </button>
          )}
          <button
            onClick={() => navigateWeek(1)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-low hover:bg-surface-container-high transition-colors"
            aria-label="Next week"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </header>

      <div className="flex flex-col xl:flex-row gap-8">
        <div className="flex-grow space-y-8 overflow-hidden">
          {/* Desktop grid */}
          <div className="hidden xl:grid grid-cols-7 gap-4">
            {days.map(day => (
              <div key={day.name} className="text-center pb-4">
                <p className="font-headline text-lg italic">{day.name}</p>
                <p className="text-[10px] tracking-widest uppercase opacity-50 font-bold">{day.date}</p>
              </div>
            ))}

            {days.map(day => (
              <div key={day.isoDate} className="space-y-4">
                {MEAL_TYPES.map(mealType => {
                  const slot = getSlot(day.isoDate, mealType);
                  const mealColor = mealType === 'Breakfast' ? 'text-tertiary' : mealType === 'Dinner' ? 'text-secondary' : 'text-on-surface-variant/50';

                  return (
                    <div
                      key={mealType}
                      className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/10 shadow-sm min-h-[140px] flex flex-col group"
                    >
                      <span className={`text-[10px] font-bold uppercase tracking-tighter ${mealColor} mb-2 block`}>{mealType}</span>
                      {slot && (slot.recipes?.length ?? 0) > 0 ? (
                        <div className="flex-grow flex flex-col gap-1.5">
                          {(slot.recipes ?? []).map((recipe: MealSlotRecipe) => (
                            <div key={recipe.recipeId} className="relative flex items-center gap-1.5 bg-surface-container-low rounded-lg p-1.5">
                              <Link
                                to={`/recipe/${recipe.recipeId}`}
                                className="flex items-center gap-1.5 flex-1 min-w-0"
                              >
                                {recipe.recipeImageUrl && (
                                  <img
                                    className="w-10 h-10 object-cover rounded-md shrink-0"
                                    src={recipe.recipeImageUrl}
                                    alt={recipe.recipeTitle}
                                    referrerPolicy="no-referrer"
                                  />
                                )}
                                <h4 className="text-[9px] font-bold line-clamp-2 flex-1">{recipe.recipeTitle}</h4>
                              </Link>
                              <button
                                onClick={() => handleRemoveRecipe(day.isoDate, mealType, recipe.recipeId)}
                                className="w-4 h-4 bg-surface rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm shrink-0"
                              >
                                <X size={8} className="text-on-surface-variant" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => handleOpenPicker(day.isoDate, mealType)}
                            className="mt-auto flex items-center justify-center gap-1 text-primary/30 hover:text-primary py-1 transition-colors"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      ) : (
                        <div
                          className="flex-grow flex items-center justify-center text-primary/30 hover:text-primary cursor-pointer transition-colors"
                          onClick={() => handleOpenPicker(day.isoDate, mealType)}
                        >
                          <Plus size={24} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Mobile stack */}
          <div className="xl:hidden flex flex-col gap-6">
            {days.map(day => (
              <div key={day.isoDate} className="bg-surface-container-low p-6 rounded-3xl">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-headline text-2xl italic">{day.name}</h3>
                    <p className="text-xs uppercase tracking-widest opacity-60 font-bold">{day.date}</p>
                  </div>
                  <ChevronDown className="text-primary" />
                </div>
                <div className="space-y-3">
                  {MEAL_TYPES.map(mealType => {
                    const slot = getSlot(day.isoDate, mealType);
                    if (slot && (slot.recipes?.length ?? 0) > 0) {
                      return (
                        <div key={mealType} className="bg-surface-container-lowest p-4 rounded-2xl space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-tertiary block">{mealType}</span>
                          {(slot.recipes ?? []).map((recipe: MealSlotRecipe) => (
                            <div key={recipe.recipeId} className="flex items-center gap-4">
                              <Link
                                to={`/recipe/${recipe.recipeId}`}
                                className="flex items-center gap-4 flex-1 min-w-0"
                              >
                                {recipe.recipeImageUrl && (
                                  <img className="w-12 h-12 object-cover rounded-xl shrink-0" src={recipe.recipeImageUrl} alt={recipe.recipeTitle} referrerPolicy="no-referrer" />
                                )}
                                <p className="font-medium text-sm flex-1">{recipe.recipeTitle}</p>
                              </Link>
                              <button onClick={() => handleRemoveRecipe(day.isoDate, mealType, recipe.recipeId)} className="p-1">
                                <X size={14} className="text-on-surface-variant" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => handleOpenPicker(day.isoDate, mealType)}
                            className="w-full flex items-center justify-center gap-2 text-primary/50 hover:text-primary py-1 transition-colors"
                          >
                            <Plus size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Add another</span>
                          </button>
                        </div>
                      );
                    }
                    return (
                      <button
                        key={mealType}
                        onClick={() => handleOpenPicker(day.isoDate, mealType)}
                        className="w-full border-2 border-dashed border-outline-variant/30 p-4 rounded-2xl flex items-center justify-center gap-2 text-on-surface-variant/40"
                      >
                        <Plus size={18} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Add {mealType}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="xl:w-80 shrink-0">
          <div className="sticky top-28 space-y-6">
            <div className="bg-surface-container-high/40 p-8 rounded-[2rem] backdrop-blur-sm">
              <h2 className="font-headline text-2xl italic mb-6">Daily Thresholds</h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                    <span>Calories</span>
                    <span className="text-primary">— / {dailyTargets.calories}</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: '0%' }} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Carbs', target: dailyTargets.carbs, color: 'bg-tertiary' },
                    { label: 'Protein', target: dailyTargets.protein, color: 'bg-primary' },
                    { label: 'Fats', target: dailyTargets.fat, color: 'bg-secondary' },
                  ].map(macro => (
                    <div key={macro.label} className="text-center">
                      <p className="text-[8px] uppercase font-bold text-on-surface-variant/50 mb-1">{macro.label}</p>
                      <p className="text-sm font-medium">0g</p>
                      <div className={`h-1 mt-1 ${macro.color}/20 rounded-full overflow-hidden`}>
                        <div className={`h-full ${macro.color}`} style={{ width: '0%' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-10 p-4 bg-tertiary-container/10 rounded-2xl border border-tertiary-container/20">
                <div className="flex items-center gap-3 mb-2">
                  <Info className="text-tertiary" size={16} />
                  <span className="text-[10px] font-bold uppercase tracking-tight text-tertiary">Sous-Chef Tip</span>
                </div>
                <p className="text-[10px] text-on-tertiary-container/80 leading-relaxed">
                  Start adding recipes to your weekly plan to see nutrition insights and personalized recommendations.
                </p>
              </div>
            </div>
            <button
              onClick={handleGenerateGroceryList}
              className="w-full bg-primary hover:bg-primary-container text-white rounded-full py-4 px-6 font-bold text-xs tracking-widest uppercase flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-primary/20"
            >
              <ShoppingBasket size={18} />
              Generate Grocery List
            </button>
          </div>
        </aside>
      </div>

      <RecipePickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelectRecipe}
      />
    </main>
  );
};

export default PlannerPage;
