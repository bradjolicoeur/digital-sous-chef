using Marten;

namespace DigitalSousChef.Server.Features.Recipes;

public record GetRecipesQuery(string? Category, string? Search);

public class GetRecipesHandler
{
    public static async Task<List<RecipeSummary>> Handle(
        GetRecipesQuery query,
        IQuerySession session,
        IHttpContextAccessor ctx)
    {
        var userId = GetUserId(ctx);

        var q = session.Query<Recipe>().Where(r => r.UserId == userId);

        if (!string.IsNullOrWhiteSpace(query.Category))
            q = q.Where(r => r.Category.Equals(query.Category, StringComparison.OrdinalIgnoreCase));

        if (!string.IsNullOrWhiteSpace(query.Search))
            q = q.Where(r => r.Title.Contains(query.Search, StringComparison.OrdinalIgnoreCase));

        var recipes = await q.OrderByDescending(r => r.ImportedAt).ToListAsync();

        return recipes.Select(r => new RecipeSummary(
            r.Id, r.Title, r.Description, r.ImageUrl,
            r.PrepTime, r.Calories, r.Servings,
            r.Difficulty, r.Category, r.Tags,
            r.IsFavorite, r.ImportedAt
        )).ToList();
    }

    private static string GetUserId(IHttpContextAccessor ctx) =>
        ctx.HttpContext!.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
        ?? ctx.HttpContext!.User.FindFirst("sub")?.Value
        ?? throw new UnauthorizedAccessException();
}
