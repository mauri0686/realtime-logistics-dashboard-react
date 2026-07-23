using System.Collections.Concurrent;
using LogisticsTracker.Api.Models;

namespace LogisticsTracker.Api.Services;

/// <summary>
/// In-memory simulation of a nationwide shipment network. Seeds ~5,000 shipments and advances
/// them along their routes on every tick, emitting only the changed rows (deltas) so the
/// real-time stream stays lean. Route endpoints are kept server-side (not serialized) — the
/// wire format stays a flat, render-ready row. Thread-safe; deterministic seed for reproducible demos.
/// </summary>
public sealed class ShipmentDataService
{
    private static readonly string[] Carriers =
        { "NovaExpress", "Atlas Freight", "BluePoint", "Meridian Post", "Vector Cargo" };

    private static readonly (string City, double Lat, double Lng)[] Cities =
    {
        ("New York", 40.71, -74.01), ("Los Angeles", 34.05, -118.24), ("Chicago", 41.88, -87.63),
        ("Houston", 29.76, -95.37), ("Phoenix", 33.45, -112.07), ("Seattle", 47.61, -122.33),
        ("Miami", 25.76, -80.19), ("Denver", 39.74, -104.99), ("Boston", 42.36, -71.06),
        ("Atlanta", 33.75, -84.39), ("Dallas", 32.78, -96.80), ("San Francisco", 37.77, -122.42),
        ("Portland", 45.52, -122.68), ("Nashville", 36.16, -86.78), ("Minneapolis", 44.98, -93.27),
        ("Detroit", 42.33, -83.05), ("Austin", 30.27, -97.74), ("Charlotte", 35.23, -80.84),
    };

    private static readonly string[] FirstNames =
        { "Alex", "Sam", "Jordan", "Casey", "Riley", "Morgan", "Taylor", "Jamie", "Avery", "Drew" };

    private static readonly string[] LastNames =
        { "Rivera", "Chen", "Patel", "Novak", "Silva", "Klein", "Moreau", "Haas", "Ortiz", "Kim" };

    private static readonly string[] Priorities = { "Standard", "Standard", "Standard", "Express", "Overnight" };

    private sealed record Route(double OriginLat, double OriginLng, double DestLat, double DestLng);

    private readonly ConcurrentDictionary<string, Shipment> _shipments = new();
    private readonly ConcurrentDictionary<string, Route> _routes = new();
    private readonly Random _rng = new(424242);
    private readonly object _tickLock = new();
    private int _seq;

    public ShipmentDataService(int count = 5000)
    {
        for (var i = 0; i < count; i++)
        {
            var s = NewShipment(progress: _rng.Next(0, 101));
            _shipments[s.Id] = s;
        }
    }

    public int Count => _shipments.Count;

    public IReadOnlyCollection<Shipment> Snapshot() =>
        _shipments.Values.OrderBy(s => s.Id).ToList();

    /// <summary>
    /// One simulation step: advance a random subset of shipments along their route, occasionally
    /// deliver/replace them or flag delays. Returns only the rows that changed.
    /// </summary>
    public IReadOnlyList<Shipment> Tick(int changes = 350)
    {
        lock (_tickLock)
        {
            var updated = new List<Shipment>(changes);
            var keys = _shipments.Keys.ToArray();
            var now = DateTime.UtcNow;

            for (var i = 0; i < changes; i++)
            {
                var key = keys[_rng.Next(keys.Length)];
                if (!_shipments.TryGetValue(key, out var s)) continue;

                Shipment next;
                if (s.Status == ShipmentStatus.Delivered)
                {
                    // Recycle delivered shipments so the fleet size stays constant: a fresh
                    // shipment enters the network under a new tracking number.
                    _shipments.TryRemove(key, out _);
                    _routes.TryRemove(key, out _);
                    next = NewShipment(progress: 0);
                }
                else
                {
                    var step = s.Priority switch
                    {
                        "Overnight" => _rng.Next(2, 6),
                        "Express" => _rng.Next(1, 4),
                        _ => _rng.Next(0, 3),
                    };
                    var progress = Math.Min(100, s.ProgressPct + step);
                    var roll = _rng.NextDouble();
                    var status = progress switch
                    {
                        >= 100 => ShipmentStatus.Delivered,
                        >= 90 => ShipmentStatus.OutForDelivery,
                        > 0 when roll < 0.015 => ShipmentStatus.Delayed,
                        > 0 when roll < 0.018 => ShipmentStatus.Exception,
                        > 5 => ShipmentStatus.InTransit,
                        _ => ShipmentStatus.PickedUp,
                    };

                    var (lat, lng) = PositionAt(key, progress, s);
                    next = s with
                    {
                        ProgressPct = progress,
                        Status = status,
                        Lat = lat,
                        Lng = lng,
                        EtaMinutes = status == ShipmentStatus.Delivered
                            ? 0
                            : Math.Max(1, (100 - progress) * 14 + _rng.Next(-10, 10)),
                        LastUpdated = now,
                    };
                }

                _shipments[next.Id] = next;
                updated.Add(next);
            }

            return updated;
        }
    }

    private Shipment NewShipment(int progress)
    {
        var origin = Cities[_rng.Next(Cities.Length)];
        var dest = Cities[_rng.Next(Cities.Length)];
        while (dest.City == origin.City) dest = Cities[_rng.Next(Cities.Length)];

        var id = $"SHP-{Interlocked.Increment(ref _seq):D6}";
        _routes[id] = new Route(origin.Lat, origin.Lng, dest.Lat, dest.Lng);

        return new Shipment
        {
            Id = id,
            Carrier = Carriers[_rng.Next(Carriers.Length)],
            Origin = origin.City,
            Destination = dest.City,
            Customer = $"{FirstNames[_rng.Next(FirstNames.Length)]} {LastNames[_rng.Next(LastNames.Length)]}",
            Status = progress switch
            {
                0 => ShipmentStatus.Created,
                >= 90 => ShipmentStatus.OutForDelivery,
                > 5 => ShipmentStatus.InTransit,
                _ => ShipmentStatus.PickedUp,
            },
            Lat = Lerp(origin.Lat, dest.Lat, progress),
            Lng = Lerp(origin.Lng, dest.Lng, progress),
            ProgressPct = progress,
            EtaMinutes = Math.Max(1, (100 - progress) * 14),
            WeightKg = Math.Round(_rng.NextDouble() * 48 + 0.2, 1),
            Priority = Priorities[_rng.Next(Priorities.Length)],
            LastUpdated = DateTime.UtcNow,
        };
    }

    private (double Lat, double Lng) PositionAt(string id, int progress, Shipment current)
    {
        if (!_routes.TryGetValue(id, out var route))
            return (current.Lat, current.Lng);
        return (Lerp(route.OriginLat, route.DestLat, progress), Lerp(route.OriginLng, route.DestLng, progress));
    }

    private static double Lerp(double from, double to, int progressPct) =>
        Math.Round(from + (to - from) * progressPct / 100.0, 4);
}
