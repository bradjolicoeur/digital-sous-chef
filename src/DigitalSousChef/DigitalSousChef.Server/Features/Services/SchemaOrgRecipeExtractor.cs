using DigitalSousChef.Server.Features.Recipes;

namespace DigitalSousChef.Server.Features.Services;

/// <summary>
/// Extracts recipe data by fetching the page with a plain HttpClient then parsing
/// Schema.org JSON-LD structured data via <see cref="RecipeHtmlParser"/>.
/// Works well for sites that don't require JavaScript execution.
/// For Cloudflare-protected sites, use <see cref="PlaywrightRecipeExtractor"/> instead.
/// </summary>
public class SchemaOrgRecipeExtractor : IAIRecipeExtractor
{
    private readonly HttpClient _httpClient;

    public SchemaOrgRecipeExtractor(HttpClient httpClient)
    {
        _httpClient = httpClient;
        _httpClient.Timeout = TimeSpan.FromSeconds(30);
        _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
        _httpClient.DefaultRequestHeaders.Accept.ParseAdd("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
        _httpClient.DefaultRequestHeaders.AcceptLanguage.ParseAdd("en-US,en;q=0.9");
    }

    public async Task<Recipe> ExtractAsync(string url)
    {
        var uri = new Uri(url);
        if (uri.Scheme != "https" && uri.Scheme != "http")
            throw new ArgumentException("Only http/https URLs are supported.");

        using var response = await _httpClient.GetAsync(url);
        response.EnsureSuccessStatusCode();
        var html = await response.Content.ReadAsStringAsync();

        return RecipeHtmlParser.Parse(html, url);
    }

    public Task<Recipe> ExtractFromTextAsync(string rawText) =>
        Task.FromResult(RecipeTextParser.Parse(rawText));
}
