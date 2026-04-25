# ArduPilot Ground Control Station (React)

A Mission Planner–style GCS built with React + Vite. Connects to ArduPilot/SITL via TCP or UDP using raw MAVLink.

## Features
- **Artificial Horizon (HUD)** — roll/pitch/yaw, speed tape, altitude tape, heading compass, throttle bar
- **Satellite Map** — Google Maps with live drone marker and flight path trail
- **Telemetry Gauges** — Altitude, GroundSpeed, Dist to WP, Yaw, Vertical Speed, and more
- **MAVLink Commands** — ARM, DISARM, TAKEOFF, LAND, RTL, flight mode selection
- **Draggable/Resizable Panels** — every window is moveable
- **Message Log** — live STATUSTEXT stream from the vehicle
- **Status Bar** — battery voltage, GPS fix, satellites, HDOP

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 1b. Install Python backend dependency
```bash
python -m pip install -r requirements.txt
```

### 2. Add Google Maps API key
Edit `src/components/MapView.jsx` line 4:
```js
const GOOGLE_MAPS_API_KEY = 'YOUR_API_KEY_HERE'
```

### 3. Start the GCS
```bash
npm run dev
```
Opens at **http://localhost:3000**

---

## Connecting to ArduPilot SITL

### Option A — TCP (recommended)
Start SITL normally and connect via TCP:
```bash
./sim_vehicle.py -v ArduCopter -I2 --custom-location=13.0827,80.2703,10,0 --sysid 3
```
In GCS: select **TCP**, host `127.0.0.1`, port `5762` (5760 + instance×1), click **CONNECT**.

### Option B — UDP (your current setup)
```bash
./sim_vehicle.py -v ArduCopter -I2 --custom-location=13.0827,80.2703,10,0 --sysid 3 --out=127.0.0.1:14670
```
In GCS: select **UDP**, port `14670`, click **CONNECT**.

---

## MAVLink Commands Reference

| GCS Button | MAVLink Command | Terminal equivalent |
|-----------|----------------|---------------------|
| ARM | MAV_CMD_COMPONENT_ARM_DISARM (400, p1=1) | `arm throttle` |
| DISARM | MAV_CMD_COMPONENT_ARM_DISARM (400, p1=0) | `disarm` |
| TAKEOFF | MAV_CMD_NAV_TAKEOFF (22, p7=altitude) | `takeoff 10` |
| LAND | MAV_CMD_NAV_LAND (21) | `mode land` |
| RTL | MAV_CMD_NAV_RETURN_TO_LAUNCH (20) | `mode rtl` |
| Set Mode | MAV_CMD_DO_SET_MODE (176) | `mode guided` |

### Ubuntu MAVProxy terminal control
You can also control the drone directly via MAVProxy:
```bash
mavproxy.py --master=127.0.0.1:5762

# Then in MAVProxy console:
arm throttle          # ARM
mode guided           # Switch to GUIDED
takeoff 10            # Takeoff to 10m
wp simple 13.08 80.27 20 0   # Fly to waypoint
mode rtl              # Return to launch
disarm                # DISARM
```

---
