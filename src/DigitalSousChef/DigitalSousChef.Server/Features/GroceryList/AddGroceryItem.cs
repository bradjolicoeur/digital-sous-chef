using Marten;

namespace DigitalSousChef.Server.Features.GroceryList;

public record AddGroceryItemCommand(string Name, int Quantity = 1);

public class AddGroceryItemHandler
{
    public static async Task<GroceryList> Handle(
        AddGroceryItemCommand cmd,
        IDocumentSession session,
        IHttpContextAccessor ctx)
    {
        var userId = GetUserId(ctx);

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

        list.Items.Add(new GroceryItem
        {
            Id = Guid.NewGuid(),
            Name = cmd.Name,
            Quantity = cmd.Quantity,
            Category = "Other",
            IsPurchased = false
        });

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
