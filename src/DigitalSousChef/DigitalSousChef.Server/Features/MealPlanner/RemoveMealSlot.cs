using Marten;

namespace DigitalSousChef.Server.Features.MealPlanner;

public record RemoveMealSlotCommand(DateOnly WeekStartDate, DateOnly Date, MealType MealType);

public class RemoveMealSlotHandler
{
    public static async Task<MealPlan?> Handle(
        RemoveMealSlotCommand cmd,
        IDocumentSession session,
        IHttpContextAccessor ctx)
    {
        var userId = GetUserId(ctx);

        var plan = await session.Query<MealPlan>()
            .FirstOrDefaultAsync(p => p.UserId == userId && p.WeekStartDate == cmd.WeekStartDate);

        if (plan is null) return null;

        plan.Slots.RemoveAll(s => s.Date == cmd.Date && s.MealType == cmd.MealType);

        session.Store(plan);
        await session.SaveChangesAsync();
        return plan;
    }

    private static string GetUserId(IHttpContextAccessor ctx) =>
        ctx.HttpContext!.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
        ?? ctx.HttpContext!.User.FindFirst("sub")?.Value
        ?? throw new UnauthorizedAccessException();
}
