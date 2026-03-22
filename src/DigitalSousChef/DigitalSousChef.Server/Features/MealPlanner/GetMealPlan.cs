using Marten;

namespace DigitalSousChef.Server.Features.MealPlanner;

public record GetMealPlanQuery(DateOnly WeekStartDate);

public class GetMealPlanHandler
{
    public static async Task<MealPlan> Handle(
        GetMealPlanQuery query,
        IDocumentSession session,
        IHttpContextAccessor ctx)
    {
        var userId = GetUserId(ctx);
        var plan = await session.Query<MealPlan>()
            .FirstOrDefaultAsync(p => p.UserId == userId && p.WeekStartDate == query.WeekStartDate);

        if (plan is not null) return plan;

        plan = new MealPlan
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            WeekStartDate = query.WeekStartDate
        };
        session.Store(plan);
        await session.SaveChangesAsync();
        return plan;
    }

    private static string GetUserId(IHttpContextAccessor ctx) =>
        ctx.HttpContext!.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
        ?? ctx.HttpContext!.User.FindFirst("sub")?.Value
        ?? throw new UnauthorizedAccessException();
}
