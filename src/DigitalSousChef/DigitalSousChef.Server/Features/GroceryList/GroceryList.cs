namespace DigitalSousChef.Server.Features.GroceryList;

public class GroceryList
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = "";
    public DateOnly ForWeek { get; set; }
    public List<GroceryItem> Items { get; set; } = [];
}

public class GroceryItem
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string? Note { get; set; }
    public int Quantity { get; set; } = 1;
    public string Category { get; set; } = "";
    public bool IsPurchased { get; set; }
    public string? Store { get; set; }
    public Guid? SourceRecipeId { get; set; }
}
