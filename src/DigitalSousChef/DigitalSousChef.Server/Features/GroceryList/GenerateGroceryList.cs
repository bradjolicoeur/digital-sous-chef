using DigitalSousChef.Server.Features.MealPlanner;
using DigitalSousChef.Server.Features.Recipes;
using DigitalSousChef.Server.Features.Services;
using Marten;
using Marten.Linq.SoftDeletes;

namespace DigitalSousChef.Server.Features.GroceryList;

public record GenerateGroceryListCommand(DateOnly WeekStartDate);

public class GenerateGroceryListHandler
{
    public static async Task<GroceryList> Handle(
        GenerateGroceryListCommand cmd,
        IDocumentSession session,
        IIngredientCategoriser categoriser,
        IHttpContextAccessor ctx)
    {
        var userId = GetUserId(ctx);

        var plan = await session.Query<MealPlan>()
            .FirstOrDefaultAsync(p => p.UserId == userId && p.WeekStartDate == cmd.WeekStartDate);

        var recipeIds = plan?.Slots
            .SelectMany(s => s.Recipes.Select(r => r.RecipeId))
            .Distinct().ToList() ?? [];

        var recipes = recipeIds.Count > 0
            ? await session.Query<Recipe>()
                .Where(r => r.Id.IsOneOf(recipeIds))
                .ToListAsync()
            : new List<Recipe>();

        var allIngredients = recipes.SelectMany(r => r.Ingredients).ToList();
        var items = categoriser.Categorise(allIngredients);

        // Assign source recipe IDs
        foreach (var recipe in recipes)
        {
            foreach (var item in items)
            {
                if (recipe.Ingredients.Any(i =>
                    i.Item.Equals(item.Name, StringComparison.OrdinalIgnoreCase)))
                {
                    item.SourceRecipeId = recipe.Id;
                }
            }
        }

        var groceryList = new GroceryList
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            ForWeek = cmd.WeekStartDate,
            Items = items
        };

        // Replace any existing list for this user/week
        session.DeleteWhere<GroceryList>(g => g.UserId == userId && g.ForWeek == cmd.WeekStartDate);
        session.Store(groceryList);
        await session.SaveChangesAsync();

        return groceryList;
    }

    private static string GetUserId(IHttpContextAccessor ctx) =>
        ctx.HttpContext!.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
        ?? ctx.HttpContext!.User.FindFirst("sub")?.Value
        ?? throw new UnauthorizedAccessException();
}
