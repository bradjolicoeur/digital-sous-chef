using DigitalSousChef.Server.Features.Recipes;
using Marten;

namespace DigitalSousChef.Server.Features.GroceryList;

public record AddGroceryItemsBulkCommand(Guid RecipeId);

public class AddGroceryItemsBulkHandler
{
    public static async Task<GroceryList> Handle(
        AddGroceryItemsBulkCommand cmd,
        IDocumentSession session,
        IHttpContextAccessor ctx)
    {
        var userId = GetUserId(ctx);

        var recipe = await session.LoadAsync<Recipe>(cmd.RecipeId);
        if (recipe is null || recipe.UserId != userId)
            throw new InvalidOperationException("Recipe not found");

        var list = await session.Query<GroceryList>()
            .OrderByDescending(g => g.ForWeek)
            .FirstOrDefaultAsync(g => g.UserId == userId);

        if (list is null)
        {
            list = new GroceryList
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                ForWeek = GetCurrentWeekStart()
            };
        }

        foreach (var ingredient in recipe.Ingredients)
        {
            list.Items.Add(new GroceryItem
            {
                Id = Guid.NewGuid(),
                Name = ingredient.Item,
                Note = ingredient.Note,
                Quantity = 1,
                Category = "Other",
                IsPurchased = false,
                SourceRecipeId = recipe.Id
            });
        }

        session.Store(list);
        await session.SaveChangesAsync();
        return list;
    }

    private static DateOnly GetCurrentWeekStart()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var daysSinceMonday = ((int)today.DayOfWeek + 6) % 7;
        return today.AddDays(-daysSinceMonday);
    }

    private static string GetUserId(IHttpContextAccessor ctx) =>
        ctx.HttpContext!.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
        ?? ctx.HttpContext!.User.FindFirst("sub")?.Value
        ?? throw new UnauthorizedAccessException();
}
