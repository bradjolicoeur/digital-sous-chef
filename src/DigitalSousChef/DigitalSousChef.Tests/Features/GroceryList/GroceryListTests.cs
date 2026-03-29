using DigitalSousChef.Tests.TestFixtures;
using Shouldly;
using GroceryListDoc = DigitalSousChef.Server.Features.GroceryList.GroceryList;
using GroceryItem = DigitalSousChef.Server.Features.GroceryList.GroceryItem;

namespace DigitalSousChef.Tests.Features.GroceryList;

// Response DTOs used purely for assertions — decoupled from server domain types.
file record GroceryListResponse(Guid Id, string UserId, List<GroceryItemResponse> Items);
file record GroceryItemResponse(Guid Id, string Name, int Quantity, bool IsPurchased, string? Store);

[Collection("integration")]
public class GroceryListTests : IntegrationContext
{
    public GroceryListTests(AppFixture fixture) : base(fixture) { }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private static GroceryListDoc NewList() => new()
    {
        Id = Guid.NewGuid(),
        UserId = AppFixture.TestUserId,
        ForWeek = DateOnly.FromDateTime(DateTime.UtcNow)
    };

    private async Task<GroceryListDoc> SeedListAsync(params GroceryItem[] items)
    {
        var list = NewList();
        list.Items.AddRange(items);
        await using var session = Store.LightweightSession();
        session.Store(list);
        await session.SaveChangesAsync();
        return list;
    }

    // ------------------------------------------------------------------
    // POST /api/grocery/items
    // ------------------------------------------------------------------

    [Fact]
    public async Task add_item_without_store_appears_in_master_list()
    {
        var result = await Host.Scenario(x =>
        {
            x.Post.Json(new { name = "Milk", quantity = 1 }).ToUrl("/api/grocery/items");
            x.StatusCodeShouldBe(200);
        });

        var body = result.ReadAsJson<GroceryListResponse>()!;
        var item = body.Items.ShouldHaveSingleItem();
        item.Store.ShouldBeNullOrEmpty();
    }

    [Fact]
    public async Task add_item_with_store_assigns_to_that_store()
    {
        var result = await Host.Scenario(x =>
        {
            x.Post.Json(new { name = "Milk", quantity = 1, store = "ShopRite" })
             .ToUrl("/api/grocery/items");
            x.StatusCodeShouldBe(200);
        });

        var body = result.ReadAsJson<GroceryListResponse>()!;
        var item = body.Items.ShouldHaveSingleItem();
        item.Store.ShouldBe("ShopRite");
    }

    // ------------------------------------------------------------------
    // PATCH /api/grocery/items/{itemId}
    // ------------------------------------------------------------------

    [Fact]
    public async Task patch_item_store_moves_item_to_store()
    {
        var item = new GroceryItem { Id = Guid.NewGuid(), Name = "Eggs", Quantity = 1 };
        await SeedListAsync(item);

        var result = await Host.Scenario(x =>
        {
            x.Patch.Json(new { store = "Costco" }).ToUrl($"/api/grocery/items/{item.Id}");
            x.StatusCodeShouldBe(200);
        });

        var body = result.ReadAsJson<GroceryListResponse>()!;
        var updated = body.Items.Single(i => i.Id == item.Id);
        updated.Store.ShouldBe("Costco");
    }

    [Fact]
    public async Task patch_item_store_moves_item_between_stores()
    {
        var item = new GroceryItem
        {
            Id = Guid.NewGuid(),
            Name = "Cheese",
            Quantity = 1,
            Store = "ShopRite"
        };
        await SeedListAsync(item);

        var result = await Host.Scenario(x =>
        {
            x.Patch.Json(new { store = "Costco" }).ToUrl($"/api/grocery/items/{item.Id}");
            x.StatusCodeShouldBe(200);
        });

        var body = result.ReadAsJson<GroceryListResponse>()!;
        var updated = body.Items.Single(i => i.Id == item.Id);
        updated.Store.ShouldBe("Costco");
    }

    [Fact]
    public async Task toggle_purchased_for_store_item()
    {
        var item = new GroceryItem
        {
            Id = Guid.NewGuid(),
            Name = "Butter",
            Quantity = 1,
            Store = "ShopRite",
            IsPurchased = false
        };
        await SeedListAsync(item);

        var result = await Host.Scenario(x =>
        {
            x.Patch.Json(new { isPurchased = true }).ToUrl($"/api/grocery/items/{item.Id}");
            x.StatusCodeShouldBe(200);
        });

        var body = result.ReadAsJson<GroceryListResponse>()!;
        var updated = body.Items.Single(i => i.Id == item.Id);
        updated.IsPurchased.ShouldBeTrue();
        updated.Store.ShouldBe("ShopRite");
    }

    // ------------------------------------------------------------------
    // DELETE /api/grocery/items?purchased=true[&store=...]
    // ------------------------------------------------------------------

    [Fact]
    public async Task clear_purchased_with_store_filter_only_removes_that_stores_items()
    {
        var shopRiteItem = new GroceryItem
        {
            Id = Guid.NewGuid(),
            Name = "Milk",
            Quantity = 1,
            Store = "ShopRite",
            IsPurchased = true
        };
        var costcoItem = new GroceryItem
        {
            Id = Guid.NewGuid(),
            Name = "Rice",
            Quantity = 1,
            Store = "Costco",
            IsPurchased = true
        };
        await SeedListAsync(shopRiteItem, costcoItem);

        var result = await Host.Scenario(x =>
        {
            x.Delete.Url("/api/grocery/items?purchased=true&store=ShopRite");
            x.StatusCodeShouldBe(200);
        });

        var body = result.ReadAsJson<GroceryListResponse>()!;
        body.Items.ShouldNotContain(i => i.Id == shopRiteItem.Id);
        body.Items.ShouldContain(i => i.Id == costcoItem.Id);
        body.Items.Single(i => i.Id == costcoItem.Id).Store.ShouldBe("Costco");
    }

    [Fact]
    public async Task clear_purchased_without_store_filter_removes_all_purchased()
    {
        var shopRiteItem = new GroceryItem
        {
            Id = Guid.NewGuid(),
            Name = "Milk",
            Quantity = 1,
            Store = "ShopRite",
            IsPurchased = true
        };
        var costcoItem = new GroceryItem
        {
            Id = Guid.NewGuid(),
            Name = "Rice",
            Quantity = 1,
            Store = "Costco",
            IsPurchased = true
        };
        var unpurchasedItem = new GroceryItem
        {
            Id = Guid.NewGuid(),
            Name = "Bread",
            Quantity = 1,
            IsPurchased = false
        };
        await SeedListAsync(shopRiteItem, costcoItem, unpurchasedItem);

        var result = await Host.Scenario(x =>
        {
            x.Delete.Url("/api/grocery/items?purchased=true");
            x.StatusCodeShouldBe(200);
        });

        var body = result.ReadAsJson<GroceryListResponse>()!;
        body.Items.ShouldNotContain(i => i.IsPurchased);
        body.Items.ShouldContain(i => i.Id == unpurchasedItem.Id);
    }
}
