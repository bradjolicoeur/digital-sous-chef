using Marten;

namespace DigitalSousChef.Server.Features.Recipes;

public record DeleteRecipeCommand(Guid Id);

public class DeleteRecipeHandler
{
    public static async Task Handle(
        DeleteRecipeCommand cmd,
        IDocumentSession session,
        IHttpContextAccessor ctx)
    {
        var userId = GetUserId(ctx);
        var recipe = await session.LoadAsync<Recipe>(cmd.Id);
        if (recipe is null || recipe.UserId != userId) return;

        session.Delete(recipe);
        await session.SaveChangesAsync();
    }

    private static string GetUserId(IHttpContextAccessor ctx) =>
        ctx.HttpContext!.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
        ?? ctx.HttpContext!.User.FindFirst("sub")?.Value
        ?? throw new UnauthorizedAccessException();
}
