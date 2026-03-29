import RecipeImportScanner from '../components/RecipeImportScanner';

const ImportRecipePage = () => {
  return (
    <main className="pt-32 px-6 max-w-5xl mx-auto pb-24">
      <section className="flex flex-col items-center text-center space-y-8">
        <div className="space-y-4 max-w-2xl">
          <h1 className="font-headline text-5xl lg:text-6xl text-on-surface leading-tight">
            Import a <span className="italic text-primary">Recipe</span>
          </h1>
          <p className="font-body text-on-surface-variant text-lg leading-relaxed">
            Simply paste a recipe URL from any site. Our AI will strip the clutter and save the soul of the dish.
          </p>
        </div>
        <RecipeImportScanner />
      </section>
    </main>
  );
};

export default ImportRecipePage;
