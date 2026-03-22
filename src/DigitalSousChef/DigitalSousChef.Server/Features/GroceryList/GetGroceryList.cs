using Marten;

namespace DigitalSousChef.Server.Features.GroceryList;

public record GetGroceryListQuery;

public class GetGroceryListHandler
{
    public static async Task<GroceryList?> Handle(
        GetGroceryListQuery query,
        IQuerySession session,
        IHttpContextAccessor ctx)
    {
        var userId = GetUserId(ctx);
        return await session.Query<GroceryList>()
            .OrderByDescending(g => g.ForWeek)
            .FirstOrDefaultAsync(g => g.UserId == userId);
    }

    private static string GetUserId(IHttpContextAccessor ctx) =>
        ctx.HttpContext!.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
        ?? ctx.HttpContext!.User.FindFirst("sub")?.Value
        ?? throw new UnauthorizedAccessException();
}
