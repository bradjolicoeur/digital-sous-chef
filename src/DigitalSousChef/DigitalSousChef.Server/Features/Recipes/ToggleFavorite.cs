using Marten;

namespace DigitalSousChef.Server.Features.Recipes;

public record ToggleFavoriteCommand(Guid Id);

public class ToggleFavoriteHandler
{
    public static async Task<Recipe?> Handle(
        ToggleFavoriteCommand cmd,
        IDocumentSession session,
        IHttpContextAccessor ctx)
    {
        var userId = GetUserId(ctx);
        var recipe = await session.LoadAsync<Recipe>(cmd.Id);
        if (recipe is null || recipe.UserId != userId) return null;

        recipe.IsFavorite = !recipe.IsFavorite;
        session.Store(recipe);
        await session.SaveChangesAsync();
        return recipe;
    }

    private static string GetUserId(IHttpContextAccessor ctx) =>
        ctx.HttpContext!.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
        ?? ctx.HttpContext!.User.FindFirst("sub")?.Value
        ?? throw new UnauthorizedAccessException();
}
