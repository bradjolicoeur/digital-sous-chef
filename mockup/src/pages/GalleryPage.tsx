import React from 'react';
import { Search, ArrowRight } from 'lucide-react';
import { MOCK_RECIPES } from '../types';
import { RecipeCard } from '../components/RecipeCard';
import { Link } from 'react-router-dom';

export function GalleryPage() {
  const featuredRecipe = MOCK_RECIPES[0];
  const otherRecipes = MOCK_RECIPES.slice(1);

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-6 lg:px-12 py-12">
      <section className="mb-20">
        <h1 className="font-headline text-5xl md:text-7xl text-on-surface mb-8 max-w-2xl leading-tight">
          Find your <span className="italic text-primary font-medium">culinary</span> inspiration.
        </h1>
        <div className="relative max-w-3xl">
          <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
            <Search className="text-outline" size={24} />
          </div>
          <input 
            className="w-full pl-16 pr-8 py-5 bg-surface-container-lowest border-none rounded-full editorial-shadow focus:ring-2 focus:ring-primary-container text-lg transition-all" 
            placeholder="Search recipes, ingredients, or cuisines..." 
            type="text"
          />
        </div>
      </section>

      <section className="mb-24">
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="text-primary font-bold tracking-widest text-[10px] uppercase block mb-2">Curated Selection</span>
            <h2 className="font-headline text-3xl text-on-surface">Recently Added</h2>
          </div>
          <Link to="/gallery" className="text-primary font-medium text-sm flex items-center gap-1 group">
            View All <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <RecipeCard recipe={featuredRecipe} variant="featured" />
          {otherRecipes.map(recipe => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      </section>

      <section className="pb-32">
        <div className="flex items-center gap-4 mb-12 overflow-x-auto pb-4 no-scrollbar lg:hidden">
          <button className="px-6 py-2 bg-primary text-on-primary rounded-full text-sm whitespace-nowrap">All Recipes</button>
          <button className="px-6 py-2 bg-surface-container-high text-on-surface-variant rounded-full text-sm whitespace-nowrap">Vegetarian</button>
          <button className="px-6 py-2 bg-surface-container-high text-on-surface-variant rounded-full text-sm whitespace-nowrap">Gluten-Free</button>
          <button className="px-6 py-2 bg-surface-container-high text-on-surface-variant rounded-full text-sm whitespace-nowrap">Quick Meals</button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-12">
          {MOCK_RECIPES.map(recipe => (
            <RecipeCard key={recipe.id} recipe={recipe} variant="gallery" />
          ))}
        </div>
      </section>
    </div>
  );
}
