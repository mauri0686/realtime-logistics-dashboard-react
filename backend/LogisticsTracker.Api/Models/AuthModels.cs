namespace LogisticsTracker.Api.Models;

public sealed record LoginRequest(string Username, string Password);

public sealed record LoginResponse(string Token, string Username, DateTime ExpiresAt);
