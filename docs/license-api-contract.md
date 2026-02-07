# License API Contract (Hardware Tolerance)

## Goal
- Bind license to a hardware fingerprint with tolerance, not Windows system ID.
- Support user rebind when switching computers (especially portable builds).

## Client Payload Fields
All license endpoints now include these fields:
- `deviceId`: stable hash derived from local hardware profile.
- `hardwareProfile`: structured hardware snapshot.
- `toleranceKeys`: multiple hash keys for fuzzy matching.
- `distributionChannel`: `portable` or `installed`.

## Endpoints
### `POST /startTrial`
Request:
```json
{
  "deviceId": "...",
  "hardwareProfile": { "platform": "win32", "arch": "x64", "cpuModel": "...", "cpuCount": 8, "totalMemoryGb": 16, "macs": ["..."] },
  "toleranceKeys": ["..."],
  "distributionChannel": "portable"
}
```

### `POST /verify`
Request:
```json
{
  "deviceId": "...",
  "licenseToken": "...",
  "hardwareProfile": { ... },
  "toleranceKeys": ["..."],
  "distributionChannel": "installed"
}
```

### `POST /activate`
Request:
```json
{
  "deviceId": "...",
  "orderNo": "ORDER-XXXX",
  "activationCode": "...",
  "hardwareProfile": { ... },
  "toleranceKeys": ["..."],
  "distributionChannel": "portable"
}
```

### `POST /rebind`
Request:
```json
{
  "deviceId": "...",
  "orderNo": "ORDER-XXXX",
  "hardwareProfile": { ... },
  "toleranceKeys": ["..."],
  "distributionChannel": "portable"
}
```

## Suggested Server Rule
- Keep one active binding per order.
- Rebind allowed when:
  1. user has valid order; and
  2. previous active device is replaced, or explicit user-confirmed rebind.
- Tolerance match recommendation:
  - `deviceId` exact match => trusted device.
  - Else if enough `toleranceKeys` overlap with previous record => treat as same/compatible device.
  - Else require explicit rebind flow.
