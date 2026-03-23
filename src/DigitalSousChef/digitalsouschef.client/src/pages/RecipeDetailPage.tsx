import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Timer, Flame, Users, Heart, Share2, ShoppingBasket, Utensils, Pencil } from 'lucide-react';
import { getRecipe, toggleFavorite } from '../api/recipes';
import { addItemsBulk } from '../api/grocery';
import { formatIngredient } from '../lib/utils';
import type { Recipe } from '../types';

const RecipeDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getRecipe(id).then(setRecipe).finally(() => setLoading(false));
  }, [id]);

  const handleFavorite = async () => {
    if (!recipe) return;
    const updated = await toggleFavorite(recipe.id);
    setRecipe(updated);
  };

  const handleAddAllToList = async () => {
    if (!recipe) return;
    await addItemsBulk(recipe.id);
  };

  const toggleIngredient = (index: number) => {
    setCheckedIngredients(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  if (loading) {
    return <div className="pt-32 text-center text-on-surface-variant">Loading recipe...</div>;
  }

  if (!recipe) {
    return <div className="pt-32 text-center text-on-surface-variant">Recipe not found</div>;
  }

  return (
    <main className="pt-20 pb-32 md:pb-20 min-h-screen max-w-screen-2xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-0 md:gap-12 lg:gap-20">
        {/* Left — Hero Image */}
        <div className="md:col-span-5 lg:col-span-6 relative">
          <div className="relative h-[512px] md:h-[calc(100vh-120px)] w-full overflow-hidden md:rounded-r-3xl md:mt-4">
            {recipe.imageUrl ? (
              <img
                src={recipe.imageUrl}
                alt={recipe.title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full bg-surface-container-high flex items-center justify-center">
                <span className="text-6xl font-headline italic text-outline/40">{recipe.title.charAt(0)}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent md:hidden" />
            <div className="absolute top-4 right-4 flex flex-col gap-3 md:hidden">
              <button
                onClick={handleFavorite}
                className="w-10 h-10 bg-surface/90 backdrop-blur-md rounded-full flex items-center justify-center text-primary shadow-lg"
              >
                <Heart size={20} className={recipe.isFavorite ? 'fill-primary' : ''} />
              </button>
              <button
                onClick={() => navigate(`/recipe/${recipe.id}/edit`)}
                className="w-10 h-10 bg-surface/90 backdrop-blur-md rounded-full flex items-center justify-center text-on-surface shadow-lg"
              >
                <Pencil size={20} />
              </button>
              <button className="w-10 h-10 bg-surface/90 backdrop-blur-md rounded-full flex items-center justify-center text-on-surface shadow-lg">
                <Share2 size={20} />
              </button>
            </div>
          </div>

          {/* Desktop floating stats bar */}
          <div className="hidden md:flex absolute bottom-12 left-8 right-[-2rem] bg-surface/80 backdrop-blur-xl p-8 rounded-2xl shadow-xl z-10 items-center justify-between border border-outline-variant/20">
            <div className="flex flex-col">
              <span className="text-[10px] font-label uppercase tracking-widest text-outline">Prep Time</span>
              <span className="text-xl font-headline font-semibold text-on-surface">{recipe.prepTime}</span>
            </div>
            <div className="w-px h-10 bg-outline-variant/30" />
            <div className="flex flex-col">
              <span className="text-[10px] font-label uppercase tracking-widest text-outline">Calories</span>
              <span className="text-xl font-headline font-semibold text-on-surface">{recipe.calories}</span>
            </div>
            <div className="w-px h-10 bg-outline-variant/30" />
            <div className="flex flex-col">
              <span className="text-[10px] font-label uppercase tracking-widest text-outline">Servings</span>
              <span className="text-xl font-headline font-semibold text-on-surface">{recipe.servings}</span>
            </div>
            <div className="w-px h-10 bg-outline-variant/30" />
            <div className="flex flex-col">
              <span className="text-[10px] font-label uppercase tracking-widest text-outline">Difficulty</span>
              <span className="text-xl font-headline font-semibold text-on-surface">{recipe.difficulty}</span>
            </div>
          </div>
        </div>

        {/* Right — Recipe content */}
        <div className="md:col-span-7 lg:col-span-6 px-6 md:px-0 md:pr-12 lg:pr-20 py-10 md:py-12">
          <nav className="flex items-center gap-2 mb-6">
            <span className="text-xs font-medium text-primary uppercase tracking-widest">{recipe.category}</span>
            {recipe.tags[0] && (
              <>
                <span className="text-outline-variant">•</span>
                <span className="text-xs font-medium text-outline uppercase tracking-widest">{recipe.tags[0]}</span>
              </>
            )}
          </nav>

          <h1 className="text-5xl font-headline italic text-on-surface leading-tight mb-4">
            {recipe.title}
          </h1>

          <p className={`text-lg font-body text-on-surface-variant leading-relaxed max-w-xl ${recipe.sourceUrl ? 'mb-4' : 'mb-12'}`}>
            {recipe.description}
          </p>

          {recipe.sourceUrl && (
            <p className="text-xs text-outline mb-12">
              Source:{' '}
              <a
                href={recipe.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline break-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                {recipe.sourceUrl}
              </a>
            </p>
          )}

          {/* Mobile stats */}
          <div className="grid grid-cols-3 gap-4 mb-12 md:hidden">
            <div className="bg-surface-container-low p-4 rounded-xl text-center">
              <Timer className="text-primary mx-auto mb-1" size={20} />
              <p className="text-xs text-outline">{recipe.prepTime}</p>
            </div>
            <div className="bg-surface-container-low p-4 rounded-xl text-center">
              <Flame className="text-primary mx-auto mb-1" size={20} />
              <p className="text-xs text-outline">{recipe.calories}</p>
            </div>
            <div className="bg-surface-container-low p-4 rounded-xl text-center">
              <Users className="text-primary mx-auto mb-1" size={20} />
              <p className="text-xs text-outline">{recipe.servings}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-16">
            {/* Ingredients */}
            <section>
              <div className="flex items-end justify-between mb-8">
                <h2 className="text-2xl font-headline text-on-surface border-b-2 border-primary-container pb-1">Ingredients</h2>
                <button
                  onClick={handleAddAllToList}
                  className="text-primary font-medium text-sm flex items-center gap-1 hover:underline"
                >
                  <ShoppingBasket size={16} />
                  Add all to list
                </button>
              </div>
              <ul className="space-y-4">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i} className="group flex items-center justify-between p-4 bg-surface-container-lowest rounded-xl hover:shadow-md transition-shadow">
                    <label className="flex items-center gap-4 cursor-pointer w-full">
                      <input
                        type="checkbox"
                        checked={checkedIngredients.has(i)}
                        onChange={() => toggleIngredient(i)}
                        className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary/20"
                      />
                      <span className={`text-sm text-on-surface group-hover:text-primary transition-colors ${checkedIngredients.has(i) ? 'line-through opacity-50' : ''}`}>
                        {formatIngredient(ing.item)}
                      </span>
                    </label>
                    {ing.note && <span className="text-xs text-outline italic">{ing.note}</span>}
                  </li>
                ))}
              </ul>
            </section>

            {/* Instructions */}
            <section>
              <h2 className="text-2xl font-headline text-on-surface border-b-2 border-primary-container pb-1 mb-8 w-fit">Preparation</h2>
              <div className="space-y-10">
                {recipe.instructions.map((step, i) => (
                  <div key={i} className="flex gap-6">
                    <span className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-lg">{i + 1}</span>
                    <div>
                      <h3 className="text-lg font-headline font-semibold mb-2">{step.title}</h3>
                      <p className="text-sm text-on-surface-variant leading-relaxed">{step.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Desktop action buttons */}
          <div className="hidden md:flex gap-4 mt-16 flex-wrap">
            <button className="px-8 py-4 bg-primary text-on-primary rounded-full font-semibold flex items-center gap-2 hover:bg-primary-container transition-all active:scale-95 shadow-lg">
              <Utensils size={20} />
              Start Cooking Now
            </button>
            <button
              onClick={() => navigate(`/recipe/${recipe.id}/edit`)}
              className="px-8 py-4 border border-outline-variant text-on-surface rounded-full font-semibold flex items-center gap-2 hover:bg-surface-container-low transition-all"
            >
              <Pencil size={20} />
              Edit Recipe
            </button>
            <button className="px-8 py-4 border border-outline-variant text-on-surface rounded-full font-semibold flex items-center gap-2 hover:bg-surface-container-low transition-all">
              <Share2 size={20} />
              Share Recipe
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};

export default RecipeDetailPage;
