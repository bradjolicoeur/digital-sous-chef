using DigitalSousChef.Server.Features.Services;
using Marten;

namespace DigitalSousChef.Server.Features.Recipes;

public record ImportRecipeCommand(string Url);

public class ImportRecipeHandler
{
    public static async Task<Recipe> Handle(
        ImportRecipeCommand cmd,
        IAIRecipeExtractor extractor,
        IDocumentSession session,
        IHttpContextAccessor ctx)
    {
        var userId = GetUserId(ctx);
        var recipe = await extractor.ExtractAsync(cmd.Url);
        recipe.Id = Guid.NewGuid();
        recipe.UserId = userId;
        recipe.ImportedAt = DateTimeOffset.UtcNow;
        session.Store(recipe);
        await session.SaveChangesAsync();
        return recipe;
    }

    private static string GetUserId(IHttpContextAccessor ctx) =>
        ctx.HttpContext!.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
        ?? ctx.HttpContext!.User.FindFirst("sub")?.Value
        ?? throw new UnauthorizedAccessException();
}
