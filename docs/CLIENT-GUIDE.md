# ShipTrack Ops — A Plain-Language Guide

*You don't need to be a developer to follow this page. It explains what this application is,
what you're looking at, and why it's built the way it is.*

## What is this?

ShipTrack Ops is a **live operations dashboard for a delivery company**. Imagine a control room
where dispatchers watch every package the company is moving — five thousand of them — with the
screen updating **by itself, every second**, as trucks move and packages get delivered.
No refresh button. No waiting.

![The dashboard](screenshot-dashboard.png)

## See it running in 3 steps

You need two free tools installed: the [.NET SDK 8](https://dotnet.microsoft.com/download)
and [Node.js 20+](https://nodejs.org). Then, in a terminal:

```bash
# 1. Start the server (the "brain" that tracks shipments)
cd backend/LogisticsTracker.Api
dotnet run --urls http://localhost:5080

# 2. In a second terminal, start the screen (the dashboard)
cd frontend-react
npm install
npm run dev

# 3. Open http://localhost:5173 in your browser
```

Sign in with **any** username and password (it's a demo — try `ops-lead` / `demo123`).

## What am I looking at?

| Part of the screen | What it tells you |
|---|---|
| **LIVE badge + "350 upd/s"** | The dashboard is connected and receiving ~350 shipment updates every second. |
| **Five big numbers** | The fleet at a glance: how many packages are moving, out for delivery, delayed, delivered. They tick in real time. |
| **Search box** | Type a city, customer or tracking number — the table narrows instantly. |
| **The table** | Every shipment: where it's going, who it's for, how far along it is (the progress bar), and when it should arrive (ETA). |

## Why is it smooth with 5,000 rows?

Most web pages get slow when you throw thousands of constantly-changing rows at them.
This one stays fast because of three decisions:

1. **It only draws what you can see.** Even though 5,000 shipments are tracked, only the
   ~30 rows visible on screen actually exist in the browser. Scroll, and rows are recycled.
2. **The server sends only what changed.** Instead of re-sending all 5,000 shipments every
   second, it pushes just the rows that moved — about 350 — over a live connection (WebSocket).
3. **The screen only repaints what changed.** Unchanged rows are never re-drawn.

These are the exact techniques used by professional dashboards (flight trackers,
trading terminals, fleet operations software).

## Is the data real?

No — and that's deliberate. The server simulates a realistic nationwide delivery network
(cities, carriers, delays, deliveries) so the whole project **runs on any laptop with zero
setup**: no database to install, no accounts to create, nothing external. Swapping the
simulation for a real data source would not change the dashboard at all — it consumes a
standard, documented interface.

## Is it tested?

Yes. Every change runs through an automated pipeline (the **CI badge** on the front page):

- The server is compiled from scratch.
- The dashboard's code is linted and type-checked, and the production bundle is built from scratch.
- An end-to-end suite has verified the full journey — sign-in, live data, search,
  virtualized table, sign-out — with **zero browser console errors**.

## Who built it, and why?

Built by [Mauricio Acuña](https://github.com/mauri0686) — a senior .NET full-stack engineer —
as a compact, honest demonstration of production techniques: real-time data delivery,
high-volume UI performance, secured APIs, and automated testing.
The same backend also powers an [Angular version of this dashboard](https://github.com/mauri0686/realtime-logistics-dashboard-angular),
so you can compare the two most popular front-end frameworks side by side.

*Technical readers: the [README](../README.md) has the architecture diagram and the
framework-level details.*
