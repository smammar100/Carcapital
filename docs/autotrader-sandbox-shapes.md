# AutoTrader Connect — captured sandbox shapes

Captured 2026-05-26 against `https://api-sandbox.autotrader.co.uk`,
advertiser `10008899`, reg `EK18FUT`, via `scripts/autotrader-probe.mjs`.
**No tokens or secrets in this file** — structure + sample public values only.

## Auth — `POST /authenticate`

Request (either JSON or form-encoded body works):
```json
{ "key": "<KEY>", "secret": "<SECRET>" }
```
Response `200`:
```json
{ "access_token": "<~97-char token>", "expires_at": "<ISO timestamp>" }
```
Token life ~15 min. `expires_at` is an ISO datetime string (not a
duration). Send the token as `Authorization: Bearer <token>`.

## Vehicle lookup — `GET /vehicles`

Query params: `advertiserId` (required), `registration` (required), plus
optional flags: `valuations=true` (REQUIRES `odometerReadingMiles`),
`features=true`, `motTests=true`, `competitors=true`,
`firstRegistrationDate=YYYY-MM-DD`.

`200` top-level: `{ vehicle, valuations?, motTests?, features?, links? }`.

### `vehicle` (fields we map)
```
make, model, generation, derivative, derivativeId, trim, bodyType,
fuelType, transmissionType, engineCapacityCC, co2EmissionGPKM,
firstRegistrationDate, colour, vehicleType, doors, seats, …(many more)
```
`derivativeId` is the stable taxonomy key — needed for stock create.

### `valuations` (with `valuations=true&odometerReadingMiles=N`)
```json
{
  "retail":       { "amountGBP": 11003 },
  "partExchange": { "amountGBP": 8536  },
  "trade":        { "amountGBP": 8582  },
  "private":      { "amountGBP": 10540 }
}
```
**Whole GBP** (not pence) — matches the `vehicles.listing_price` convention.

### `motTests` (with `motTests=true`) — BONUS
Same shape as DVSA MOT History:
```
[{ completedDate, expiryDate, testResult, odometerValue, odometerUnit,
   motTestNumber, rfrAndComments[] }]
```
> Discovered opportunity: while the DVSA MOT History WAF is blocking us
> (see F-MOT-A in UAT-DVLA-DVSA-LOOKUP.md), AutoTrader's `motTests` could
> serve as the MOT source. Tracked as a follow-up, not in this scope.

## Stock — `POST /stock?advertiserId=…`

Captured live 2026-05-30. **Required** `vehicle` fields (the API rejects
null make/model even when a `derivativeId` is given — it validated each
field-by-field via 400 warnings until all were present):

```json
{
  "vehicle": {
    "vehicleType": "Car",
    "registration": "EK18FUT",
    "make": "Hyundai",
    "model": "Tucson",
    "generation": "SUV (2015 - 2018)",
    "derivative": "1.6 GDi Blue Drive SE Nav SUV 5dr Petrol Manual Euro 6 (s/s) (132 ps)",
    "derivativeId": "35eef09b60b1422b8d4902aa22f841cd",
    "fuelType": "Petrol",
    "bodyType": "SUV",
    "transmissionType": "Manual",
    "odometerReadingMiles": 45000
  },
  "adverts": {
    "retailAdverts": {
      "suppliedPrice": { "amountGBP": 10995 },
      "attentionGrabber": "Full service history",
      "description": "…",
      "autotraderAdvert":  { "status": "NOT_PUBLISHED" },
      "advertiserAdvert":  { "status": "NOT_PUBLISHED" },
      "locatorAdvert":     { "status": "NOT_PUBLISHED" },
      "exportAdvert":      { "status": "NOT_PUBLISHED" },
      "profileAdvert":     { "status": "NOT_PUBLISHED" }
    }
  },
  "metadata": { "lifecycleState": "FORECOURT", "externalStockReference": "<our stock id>" }
}
```

Response `201`:
```json
{ "metadata": {
    "stockId": "8a46844d9e4aa706019e7a88f05f4808",
    "searchId": "202605309845233",
    "versionNumber": 1,
    "lifecycleState": "FORECOURT",
    "dateOnForecourt": "2026-05-30"
} }
```
`metadata.stockId` is what we persist to `listings.at_stock_id`. Field
casing matters: vehicleType `Car`/`Van`, fuelType `Petrol`/`Diesel`/
`Electric`/`Petrol Hybrid`, bodyType `SUV`/`Hatchback`/… (see the maps in
`autotrader-stock-mapper.ts`). All advertising locations created
`NOT_PUBLISHED` — the advert is NOT live on the marketplace.

> Test advert created during validation: Stock ID
> `8a46844d9e4aa706019e7a88f05f4808` (sandbox advertiser 10008899,
> NOT_PUBLISHED — safe to leave or delete in the sandbox portal).

## Notes for the service
- No `priceIndicator` in the vehicle lookup — the Great/Good indicator is
  an advert-side concept. We derive a simple indicator client-side
  (listing price vs `retail.amountGBP`).
- Valuations need mileage; the Add Vehicle form passes the entered
  mileage, so the lookup is best done after mileage is known (or re-fetched).
