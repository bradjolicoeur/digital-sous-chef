import { Link } from 'react-router-dom';
import { Timer, Utensils, Heart } from 'lucide-react';
import type { RecipeSummary } from '../types';
import { cn } from '../lib/utils';

interface RecipeCardProps {
  recipe: RecipeSummary;
  variant?: 'default' | 'featured' | 'gallery';
  onFavorite?: (id: string) => void;
}

const RecipeCard = ({ recipe, variant = 'default', onFavorite }: RecipeCardProps) => {
  if (variant === 'featured') {
    return (
      <Link
        to={`/recipe/${recipe.id}`}
        className="md:col-span-2 md:row-span-2 group relative overflow-hidden rounded-xl bg-surface-container-lowest editorial-shadow"
      >
        <div className="aspect-[4/5] overflow-hidden">
          <img
            src={recipe.imageUrl}
            alt={recipe.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/80 to-transparent text-white">
          <div className="flex gap-2 mb-3">
            {recipe.tags.map(tag => (
              <span key={tag} className="px-3 py-1 bg-primary-container text-on-primary-container rounded-full text-[10px] font-bold uppercase tracking-tighter">
                {tag}
              </span>
            ))}
            <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-tighter">
              {recipe.prepTime}
            </span>
          </div>
          <h3 className="font-headline text-3xl mb-2">{recipe.title}</h3>
          <p className="text-white/80 text-sm font-body line-clamp-2">{recipe.description}</p>
        </div>
      </Link>
    );
  }

  if (variant === 'gallery') {
    return (
      <Link to={`/recipe/${recipe.id}`} className="group">
        <div className="aspect-[3/4] rounded-2xl overflow-hidden mb-4 relative">
          <img
            src={recipe.imageUrl}
            alt={recipe.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            referrerPolicy="no-referrer"
          />
          <button
            onClick={(e) => { e.preventDefault(); onFavorite?.(recipe.id); }}
            className={cn(
              "absolute top-3 right-3 w-8 h-8 bg-white/80 backdrop-blur rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity",
              recipe.isFavorite && "opacity-100"
            )}
          >
            <Heart size={14} className={cn("text-primary", recipe.isFavorite && "fill-primary")} />
          </button>
        </div>
        <span className="text-[10px] text-outline uppercase tracking-wider mb-1 block font-bold">{recipe.category}</span>
        <h3 className="font-headline text-lg leading-snug group-hover:text-primary transition-colors">{recipe.title}</h3>
      </Link>
    );
  }

  return (
    <Link
      to={`/recipe/${recipe.id}`}
      className="group bg-surface-container-lowest rounded-xl overflow-hidden hover:editorial-shadow transition-all duration-300 flex flex-col h-full border border-outline-variant/5"
    >
      <div className="aspect-[4/3] relative overflow-hidden">
        <img
          src={recipe.imageUrl}
          alt={recipe.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />
      </div>
      <div className="p-6 space-y-3 flex-grow">
        <h3 className="font-headline text-2xl text-on-surface leading-tight group-hover:text-primary transition-colors">{recipe.title}</h3>
        <p className="font-body text-on-surface-variant text-sm line-clamp-2 italic">{recipe.description}</p>
        <div className="flex items-center gap-4 pt-4 border-t border-outline-variant/10">
          <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-tighter text-on-surface-variant/70">
            <Timer size={14} /> {recipe.prepTime}
          </span>
          <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-tighter text-on-surface-variant/70">
            <Utensils size={14} /> {recipe.difficulty}
          </span>
        </div>
      </div>
    </Link>
  );
};

export default RecipeCard;
