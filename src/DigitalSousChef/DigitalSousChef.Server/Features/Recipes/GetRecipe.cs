using Marten;

namespace DigitalSousChef.Server.Features.Recipes;

public record GetRecipeQuery(Guid Id);

public class GetRecipeHandler
{
    public static async Task<Recipe?> Handle(
        GetRecipeQuery query,
        IQuerySession session,
        IHttpContextAccessor ctx)
    {
        var userId = GetUserId(ctx);
        var recipe = await session.LoadAsync<Recipe>(query.Id);
        if (recipe is null || recipe.UserId != userId) return null;
        return recipe;
    }

    private static string GetUserId(IHttpContextAccessor ctx) =>
        ctx.HttpContext!.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
        ?? ctx.HttpContext!.User.FindFirst("sub")?.Value
        ?? throw new UnauthorizedAccessException();
}
