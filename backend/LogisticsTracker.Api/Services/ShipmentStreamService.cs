using LogisticsTracker.Api.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace LogisticsTracker.Api.Services;

/// <summary>
/// Background loop that drives the live stream: every <see cref="Interval"/> it advances the
/// simulation and broadcasts the changed rows to all connected clients over SignalR. This is the
/// server-push half of the architecture — front-ends never poll for these updates.
/// </summary>
public sealed class ShipmentStreamService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMilliseconds(1000);

    private readonly ShipmentDataService _data;
    private readonly IHubContext<ShipmentsHub> _hub;
    private readonly ILogger<ShipmentStreamService> _logger;

    public ShipmentStreamService(
        ShipmentDataService data,
        IHubContext<ShipmentsHub> hub,
        ILogger<ShipmentStreamService> logger)
    {
        _data = data;
        _hub = hub;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "ShipmentStreamService started: streaming {Count} shipments, tick every {Ms}ms",
            _data.Count, Interval.TotalMilliseconds);

        using var timer = new PeriodicTimer(Interval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                var updated = _data.Tick();
                await _hub.Clients.All.SendAsync("ShipmentsUpdated", updated, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Stream tick failed");
            }
        }
    }
}
