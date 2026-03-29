using DigitalSousChef.Server.Features.Services;
using Marten;

namespace DigitalSousChef.Server.Features.Recipes;

public record ImportRecipeFromTextCommand(string RawText);

public class ImportRecipeFromTextHandler
{
    public static async Task<Recipe> Handle(
        ImportRecipeFromTextCommand cmd,
        IAIRecipeExtractor extractor,
        IDocumentSession session,
        IHttpContextAccessor ctx)
    {
        var userId = ctx.HttpContext!.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            ?? ctx.HttpContext!.User.FindFirst("sub")?.Value
            ?? throw new UnauthorizedAccessException();

        var recipe = await extractor.ExtractFromTextAsync(cmd.RawText);
        recipe.Id = Guid.NewGuid();
        recipe.UserId = userId;
        recipe.ImportedAt = DateTimeOffset.UtcNow;
        session.Store(recipe);
        await session.SaveChangesAsync();
        return recipe;
    }
}
