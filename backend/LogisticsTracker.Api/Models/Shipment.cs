namespace LogisticsTracker.Api.Models;

public enum ShipmentStatus
{
    Created,
    PickedUp,
    InTransit,
    OutForDelivery,
    Delivered,
    Delayed,
    Exception,
}

/// <summary>
/// A parcel/shipment moving through the network. This flat, read-only projection is what the
/// dashboard renders; live updates arrive as new instances over the SignalR stream.
/// </summary>
public sealed record Shipment
{
    public required string Id { get; init; }               // tracking number, e.g. "SHP-000123"
    public required string Carrier { get; init; }
    public required string Origin { get; init; }
    public required string Destination { get; init; }
    public required string Customer { get; init; }
    public ShipmentStatus Status { get; init; }

    /// <summary>Current position (great-circle interpolated between origin and destination).</summary>
    public double Lat { get; init; }
    public double Lng { get; init; }

    /// <summary>0..100 progress along the route.</summary>
    public int ProgressPct { get; init; }

    /// <summary>Estimated minutes to delivery (0 once delivered).</summary>
    public int EtaMinutes { get; init; }

    public double WeightKg { get; init; }
    public string Priority { get; init; } = "Standard";   // Standard | Express | Overnight
    public DateTime LastUpdated { get; init; }
}
