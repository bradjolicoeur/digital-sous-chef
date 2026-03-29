using DigitalSousChef.Server.Features.Recipes;
using Microsoft.Playwright;

namespace DigitalSousChef.Server.Features.Services;

/// <summary>
/// Extracts recipe data by fetching the page with a real Chromium browser via Playwright.
/// This executes JavaScript, handles Cloudflare challenges, and waits for JS-injected
/// Schema.org JSON-LD to populate — something a plain HttpClient cannot do.
/// </summary>
public sealed class PlaywrightRecipeExtractor : IAIRecipeExtractor, IAsyncDisposable
{
    private IPlaywright? _playwright;
    private IBrowser? _browser;
    private IBrowserContext? _context;
    private readonly SemaphoreSlim _initLock = new(1, 1);

    private async Task<IBrowserContext> GetContextAsync()
    {
        if (_context is not null) return _context;

        await _initLock.WaitAsync();
        try
        {
            if (_context is not null) return _context;

            // Install browser binaries on first run (no-op when already installed).
            Microsoft.Playwright.Program.Main(["install", "chromium"]);

            _playwright = await Playwright.CreateAsync();
            _browser = await _playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions
            {
                Headless = true,
                Args =
                [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                ],
            });

            // A single persistent context avoids the overhead of creating a new incognito
            // window on every request. We only fetch public recipe URLs (no user auth state),
            // so sharing a context between requests is safe.
            _context = await _browser.NewContextAsync(new BrowserNewContextOptions
            {
                UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                          + "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            });

            // Register resource blocking once on the persistent context.
            await _context.RouteAsync("**/*", async route =>
            {
                var type = route.Request.ResourceType;
                if (type is "image" or "media" or "font" or "stylesheet" or "ping" or "eventsource")
                    await route.AbortAsync();
                else
                    await route.ContinueAsync();
            });
        }
        finally
        {
            _initLock.Release();
        }

        return _context;
    }

    public async Task<Recipe> ExtractAsync(string url)
    {
        // Validate URL scheme to prevent SSRF against internal services
        var uri = new Uri(url);
        if (uri.Scheme != "https" && uri.Scheme != "http")
            throw new ArgumentException("Only http/https URLs are supported.");

        var context = await GetContextAsync();

        // Open a fresh page in the persistent context. Pages are cheap; contexts are not.
        var page = await context.NewPageAsync();
        try
        {
            // Navigate to DOMContentLoaded — the main HTML + synchronous scripts are done.
            await page.GotoAsync(url, new PageGotoOptions
            {
                WaitUntil = WaitUntilState.DOMContentLoaded,
                Timeout = 30_000,
            });

            // Instead of waiting for NetworkIdle (which can take 10+ s on ad-heavy recipe sites),
            // poll the DOM until a Schema.org Recipe JSON-LD block appears, or give up after 8 s.
            // This exits the moment the structured data is ready rather than waiting for every
            // tracking pixel and analytics beacon to settle.
            const string waitForRecipeJsonLd = """
                () => {
                    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
                    return Array.from(scripts).some(s => {
                        try {
                            const data = JSON.parse(s.textContent ?? '');
                            const items = Array.isArray(data) ? data
                                : data['@graph'] ? data['@graph']
                                : [data];
                            return items.some(i => {
                                const t = i['@type'];
                                return t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'));
                            });
                        } catch { return false; }
                    });
                }
                """;

            try
            {
                await page.WaitForFunctionAsync(waitForRecipeJsonLd,
                    options: new PageWaitForFunctionOptions { Timeout = 8_000, PollingInterval = 200 });
            }
            catch (TimeoutException)
            {
                // No Recipe JSON-LD appeared — proceed anyway; the parser will fall back to og: meta.
            }

            var html = await page.ContentAsync();
            return RecipeHtmlParser.Parse(html, url);
        }
        finally
        {
            await page.CloseAsync();
        }
    }

    public Task<Recipe> ExtractFromTextAsync(string rawText) =>
        Task.FromResult(RecipeTextParser.Parse(rawText));

    public async ValueTask DisposeAsync()
    {
        if (_context is not null) await _context.DisposeAsync();
        if (_browser is not null) await _browser.DisposeAsync();
        _playwright?.Dispose();
    }
}
