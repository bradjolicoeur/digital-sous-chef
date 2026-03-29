using Marten;

namespace DigitalSousChef.Server.Features.GroceryList;

public record ClearPurchasedItemsCommand(string? Store = null);

public class ClearPurchasedItemsHandler
{
    public static async Task<GroceryList?> Handle(
        ClearPurchasedItemsCommand cmd,
        IDocumentSession session,
        IHttpContextAccessor ctx)
    {
        var userId = GetUserId(ctx);

        var list = await session.Query<GroceryList>()
            .OrderByDescending(g => g.ForWeek)
            .FirstOrDefaultAsync(g => g.UserId == userId);

        if (list is null) return null;

        list.Items.RemoveAll(i => i.IsPurchased && (cmd.Store == null || i.Store == cmd.Store));

        session.Store(list);
        await session.SaveChangesAsync();
        return list;
    }

    private static string GetUserId(IHttpContextAccessor ctx) =>
        ctx.HttpContext!.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
        ?? ctx.HttpContext!.User.FindFirst("sub")?.Value
        ?? throw new UnauthorizedAccessException();
}
