using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json.Serialization;
using LogisticsTracker.Api.Hubs;
using LogisticsTracker.Api.Models;
using LogisticsTracker.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// --- Config -----------------------------------------------------------------
// Demo-only symmetric key. In a real deployment this comes from a secret store; here it guards
// nothing but simulated data, and having auth at all lets the front-ends demonstrate the
// JWT interceptor + route guard pattern against a genuinely protected API.
var jwtKey = builder.Configuration["Jwt:Key"] ?? "logistics-tracker-demo-signing-key-0123456789abcdef";
var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
const string CorsPolicy = "frontends";

// --- Services ---------------------------------------------------------------
builder.Services.AddSingleton(new ShipmentDataService(count: 5000));
builder.Services.AddHostedService<ShipmentStreamService>();

builder.Services.AddSignalR().AddJsonProtocol(o =>
    o.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors(options => options.AddPolicy(CorsPolicy, policy => policy
    .WithOrigins(
        "http://localhost:4200", "http://127.0.0.1:4200",  // Angular dev server
        "http://localhost:5173", "http://127.0.0.1:5173")  // React (Vite) dev server
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials())); // credentials needed for the SignalR WebSocket handshake

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = "logistics-tracker",
            ValidAudience = "logistics-tracker-clients",
            IssuerSigningKey = signingKey,
        };

        // Browsers can't set an Authorization header on the WebSocket upgrade request, so SignalR
        // sends the JWT as ?access_token=...; lift it into the auth context for hub routes only.
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(accessToken) &&
                    context.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            },
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();
app.UseCors(CorsPolicy);
app.UseAuthentication();
app.UseAuthorization();

// --- REST endpoints ---------------------------------------------------------
app.MapGet("/", () => Results.Ok(new { service = "Logistics Tracker API", status = "ok", docs = "/swagger" }))
    .WithTags("Meta");

app.MapGet("/api/health", () => Results.Ok(new { status = "healthy", utc = DateTime.UtcNow }))
    .WithTags("Meta");

// Demo auth: any non-empty username/password gets a signed JWT (there are no user accounts —
// the point is exercising the token flow end to end).
app.MapPost("/api/auth/login", (LoginRequest req) =>
{
    if (string.IsNullOrWhiteSpace(req.Username) || string.IsNullOrWhiteSpace(req.Password))
        return Results.BadRequest(new { message = "Username and password are required." });

    var expires = DateTime.UtcNow.AddHours(8);
    var token = new JwtSecurityToken(
        issuer: "logistics-tracker",
        audience: "logistics-tracker-clients",
        claims: new[] { new Claim(ClaimTypes.Name, req.Username) },
        expires: expires,
        signingCredentials: new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256));

    var jwt = new JwtSecurityTokenHandler().WriteToken(token);
    return Results.Ok(new LoginResponse(jwt, req.Username, expires));
}).WithTags("Auth");

// Initial snapshot (request/response). Live deltas come from the SignalR hub.
app.MapGet("/api/shipments", (ShipmentDataService data) => Results.Ok(data.Snapshot()))
    .RequireAuthorization()
    .WithTags("Shipments");

app.MapGet("/api/shipments/summary", (ShipmentDataService data) =>
{
    var shipments = data.Snapshot();
    return Results.Ok(new
    {
        total = shipments.Count,
        inTransit = shipments.Count(s => s.Status == ShipmentStatus.InTransit),
        outForDelivery = shipments.Count(s => s.Status == ShipmentStatus.OutForDelivery),
        delayed = shipments.Count(s => s.Status is ShipmentStatus.Delayed or ShipmentStatus.Exception),
        delivered = shipments.Count(s => s.Status == ShipmentStatus.Delivered),
        avgEtaMinutes = shipments.Count == 0 ? 0 : Math.Round(shipments.Average(s => s.EtaMinutes)),
    });
}).RequireAuthorization().WithTags("Shipments");

app.MapHub<ShipmentsHub>("/hubs/shipments").RequireAuthorization();

app.Run();
