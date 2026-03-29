using Marten;

namespace DigitalSousChef.Server.Features.GroceryList;

public record RemoveGroceryItemCommand(Guid ItemId);

public class RemoveGroceryItemHandler
{
    public static async Task<GroceryList?> Handle(
        RemoveGroceryItemCommand cmd,
        IDocumentSession session,
        IHttpContextAccessor ctx)
    {
        var userId = GetUserId(ctx);

        var list = await session.Query<GroceryList>()
            .OrderByDescending(g => g.ForWeek)
            .FirstOrDefaultAsync(g => g.UserId == userId);

        if (list is null) return null;

        var item = list.Items.FirstOrDefault(i => i.Id == cmd.ItemId);
        if (item is null) return null;

        list.Items.Remove(item);

        session.Store(list);
        await session.SaveChangesAsync();
        return list;
    }

    private static string GetUserId(IHttpContextAccessor ctx) =>
        ctx.HttpContext!.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
        ?? ctx.HttpContext!.User.FindFirst("sub")?.Value
        ?? throw new UnauthorizedAccessException();
}
