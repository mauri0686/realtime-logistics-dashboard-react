using LogisticsTracker.Api.Models;
using LogisticsTracker.Api.Services;
using Microsoft.AspNetCore.SignalR;

namespace LogisticsTracker.Api.Hubs;

/// <summary>
/// SignalR hub the front-ends connect to for live shipment updates. The server pushes
/// "ShipmentsUpdated" (a batch of changed <see cref="Shipment"/> rows) on every simulation tick.
/// Clients bootstrap with the REST snapshot, then stay fresh from this stream — REST for
/// request/response, WebSocket for push.
/// </summary>
public sealed class ShipmentsHub : Hub
{
    private readonly ShipmentDataService _data;

    public ShipmentsHub(ShipmentDataService data) => _data = data;

    /// <summary>Lets a freshly (re)connected client pull the current snapshot over the socket too.</summary>
    public IReadOnlyCollection<Shipment> GetSnapshot() => _data.Snapshot();
}
