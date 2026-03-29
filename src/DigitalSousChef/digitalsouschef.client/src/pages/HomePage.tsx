import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, History } from 'lucide-react';
import { getRecipes } from '../api/recipes';
import RecipeCard from '../components/RecipeCard';
import RecipeImportScanner from '../components/RecipeImportScanner';
import type { RecipeSummary } from '../types';

const HomePage = () => {
  const [recentRecipes, setRecentRecipes] = useState<RecipeSummary[]>([]);

  useEffect(() => {
    getRecipes().then(recipes => setRecentRecipes(recipes.slice(0, 3))).catch(() => {});
  }, []);

  return (
    <main className="pt-32 px-6 max-w-5xl mx-auto space-y-20 pb-24">
      <section className="flex flex-col items-center text-center space-y-8">
        <div className="space-y-4 max-w-2xl">
          <h1 className="font-headline text-5xl lg:text-6xl text-on-surface leading-tight">
            Add to your <span className="italic text-primary">Library</span>
          </h1>
          <p className="font-body text-on-surface-variant text-lg leading-relaxed">
            Simply paste a recipe URL from any site. Our AI will strip the clutter and save the soul of the dish.
          </p>
        </div>

        <RecipeImportScanner />
      </section>

      {recentRecipes.length > 0 && (
        <section className="space-y-8">
          <div className="flex items-end justify-between border-b border-outline-variant/10 pb-4">
            <div className="flex items-center gap-3">
              <History className="text-primary" size={32} />
              <h2 className="font-headline text-3xl text-on-surface">Recent Scans</h2>
            </div>
            <Link to="/gallery" className="text-primary font-semibold flex items-center gap-1 hover:underline">
              View Gallery <ArrowRight size={18} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {recentRecipes.map(recipe => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
};

export default HomePage;
