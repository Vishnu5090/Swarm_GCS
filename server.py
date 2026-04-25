"""
GCS Server Layer 2 - Python WebSocket + MAVLink bridge
Ports: 8765 (Frontend) | 8766 (Swarm Layer)
"""
import asyncio
import json
import logging
import socket
import struct

import websockets

logging.basicConfig(level=logging.INFO, format="%(asctime)s [SERVER] %(message)s")
log = logging.getLogger(__name__)

CRC_EXTRA = {0: 50, 1: 124, 24: 24, 30: 39, 33: 104, 62: 183, 74: 20, 76: 152, 253: 83}
COPTER_MODES = ['STABILIZE', 'ACRO', 'ALT_HOLD', 'AUTO', 'GUIDED', 'LOITER', 'RTL', 'CIRCLE', '', 'LAND', '', '', '', 'SPORT', 'FLIP', 'AUTOTUNE', 'POSHOLD', 'BRAKE']
MODE_MAP = {'STABILIZE': 0, 'ACRO': 1, 'ALT_HOLD': 2, 'AUTO': 3, 'GUIDED': 4, 'LOITER': 5, 'RTL': 6, 'CIRCLE': 7, 'LAND': 9, 'POSHOLD': 16, 'BRAKE': 17, 'SMART_RTL': 21}
GPS_FIX = ['NO_GPS', 'NO_FIX', '2D', '3D', 'DGPS', 'RTK_FLOAT', 'RTK_FIXED']
SEVERITY = ['EMERGENCY', 'ALERT', 'CRITICAL', 'ERROR', 'WARNING', 'NOTICE', 'INFO', 'DEBUG']

frontend_clients = set()
swarm_clients = set()
drone_sessions = {}


def crc_acc(b, crc):
    tmp = (b ^ (crc & 0xFF)) & 0xFF
    tmp = (tmp ^ ((tmp << 4) & 0xFF)) & 0xFF
    return ((crc >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4)) & 0xFFFF


def calc_crc(buf, extra):
    crc = 0xFFFF
    for b in buf:
        crc = crc_acc(b, crc)
    return crc_acc(extra, crc)


_seq = 0


def mav1(sysid, compid, msg_id, payload):
    global _seq
    header = bytes([0xFE, len(payload), _seq & 0xFF, sysid, compid, msg_id])
    _seq = (_seq + 1) & 0xFF
    crc = calc_crc(header[1:] + payload, CRC_EXTRA.get(msg_id, 0))
    return header + payload + bytes([crc & 0xFF, (crc >> 8) & 0xFF])


def cmd_long(target_sysid, target_compid, cmd, params=None):
    params = (list(params or []) + [0] * 7)[:7]
    payload = bytearray(33)
    for i, value in enumerate(params):
        struct.pack_into('<f', payload, i * 4, float(value))
    struct.pack_into('<H', payload, 28, cmd)
    payload[30] = target_sysid
    payload[31] = target_compid
    payload[32] = 0
    return mav1(255, 190, 76, bytes(payload))


def heartbeat():
    payload = bytearray(9)
    struct.pack_into('<I', payload, 0, 0)
    payload[4] = 6
    payload[5] = 8
    payload[6] = 192
    payload[7] = 4
    payload[8] = 3
    return mav1(255, 190, 0, bytes(payload))


class Parser:
    def __init__(self):
        self.buf = b''

    def feed(self, data):
        self.buf += data
        packets = []
        while self.buf:
            start = next((i for i, b in enumerate(self.buf) if b in (0xFE, 0xFD)), -1)
            if start == -1:
                self.buf = b''
                break
            if start > 0:
                self.buf = self.buf[start:]
            if self.buf[0] == 0xFE:
                if len(self.buf) < 8:
                    break
                size = self.buf[1]
                total = 8 + size
                if len(self.buf) < total:
                    break
                packets.append({
                    'msg_id': self.buf[5],
                    'sysid': self.buf[3],
                    'compid': self.buf[4],
                    'payload': bytes(self.buf[6:6 + size]),
                })
                self.buf = self.buf[total:]
            else:
                if len(self.buf) < 12:
                    break
                size = self.buf[1]
                total = 12 + size
                if len(self.buf) < total:
                    break
                msg_id = self.buf[7] | (self.buf[8] << 8) | (self.buf[9] << 16)
                packets.append({
                    'msg_id': msg_id,
                    'sysid': self.buf[5],
                    'compid': self.buf[6],
                    'payload': bytes(self.buf[10:10 + size]),
                })
                self.buf = self.buf[total:]
        return packets


def decode(msg_id, payload):
    try:
        if msg_id == 0:
            base_mode = payload[6]
            custom_mode = struct.unpack_from('<I', payload, 0)[0]
            return {
                'type': 'HEARTBEAT',
                'armed': bool(base_mode & 128),
                'custom_mode': custom_mode,
                'mode': COPTER_MODES[custom_mode] if custom_mode < len(COPTER_MODES) else 'UNKNOWN',
                'system_status': payload[7],
            }
        if msg_id == 1 and len(payload) >= 31:
            return {
                'type': 'SYS_STATUS',
                'voltage_battery': struct.unpack_from('<H', payload, 14)[0] / 1000,
                'current_battery': struct.unpack_from('<h', payload, 16)[0] / 100,
                'battery_remaining': struct.unpack_from('<b', payload, 30)[0],
            }
        if msg_id == 24 and len(payload) >= 30:
            fix_type = payload[28]
            return {
                'type': 'GPS_RAW_INT',
                'fix_type': fix_type,
                'fix_str': GPS_FIX[fix_type] if fix_type < len(GPS_FIX) else 'UNK',
                'satellites_visible': payload[29],
                'hdop': struct.unpack_from('<H', payload, 20)[0] / 100,
            }
        if msg_id == 30 and len(payload) >= 28:
            return {
                'type': 'ATTITUDE',
                'roll': struct.unpack_from('<f', payload, 4)[0],
                'pitch': struct.unpack_from('<f', payload, 8)[0],
                'yaw': struct.unpack_from('<f', payload, 12)[0],
            }
        if msg_id == 33 and len(payload) >= 28:
            return {
                'type': 'GLOBAL_POSITION_INT',
                'lat': struct.unpack_from('<i', payload, 4)[0] / 1e7,
                'lon': struct.unpack_from('<i', payload, 8)[0] / 1e7,
                'alt': struct.unpack_from('<i', payload, 12)[0] / 1000,
                'relative_alt': struct.unpack_from('<i', payload, 16)[0] / 1000,
                'vx': struct.unpack_from('<h', payload, 20)[0] / 100,
                'vy': struct.unpack_from('<h', payload, 22)[0] / 100,
                'vz': struct.unpack_from('<h', payload, 24)[0] / 100,
                'hdg': struct.unpack_from('<H', payload, 26)[0] / 100,
            }
        if msg_id == 62 and len(payload) >= 26:
            return {'type': 'NAV_CONTROLLER_OUTPUT', 'wp_dist': struct.unpack_from('<H', payload, 24)[0]}
        if msg_id == 74 and len(payload) >= 20:
            return {
                'type': 'VFR_HUD',
                'airspeed': struct.unpack_from('<f', payload, 0)[0],
                'groundspeed': struct.unpack_from('<f', payload, 4)[0],
                'alt': struct.unpack_from('<f', payload, 8)[0],
                'climb': struct.unpack_from('<f', payload, 12)[0],
                'heading': struct.unpack_from('<h', payload, 16)[0],
                'throttle': struct.unpack_from('<H', payload, 18)[0],
            }
        if msg_id == 253:
            severity = payload[0]
            return {
                'type': 'STATUSTEXT',
                'severity': severity,
                'severity_str': SEVERITY[severity] if severity < len(SEVERITY) else 'INFO',
                'text': payload[1:].decode('utf-8', errors='ignore').rstrip('\x00').strip(),
            }
    except Exception:
        pass
    return None


async def send_json(ws, obj):
    try:
        await ws.send(json.dumps(obj))
    except Exception:
        pass


async def broadcast_swarm(obj):
    msg = json.dumps(obj)
    dead = set()
    for ws in swarm_clients:
        try:
            await ws.send(msg)
        except Exception:
            dead.add(ws)
    swarm_clients.difference_update(dead)


def find_duplicate_session(current_session, proto, host, port):
    for session in drone_sessions.values():
        if session is current_session or not session.connected:
            continue
        if proto == 'UDP' and session.proto == 'UDP' and session.port == port:
            return session
        if proto == 'TCP' and session.proto == 'TCP' and session.host == host and session.port == port:
            return session
    return None


class DroneSession:
    def __init__(self, ws):
        self.ws = ws
        self.drone_id = None
        self.connected = False
        self.proto = None
        self.host = None
        self.port = None
        self.remote_sysid = 1
        self.remote_compid = 1
        self.reader = None
        self.writer = None
        self.udp_transport = None
        self.udp_remote = None
        self.udp_closed = None
        self.link_ready = False
        self.heartbeat_task = None
        self.read_task = None
        self.parser = Parser()

    async def send_status(self):
        await send_json(self.ws, {
            'ev': 'status',
            'droneId': self.drone_id,
            'connected': self.connected,
            'linkReady': self.link_ready,
            'proto': self.proto,
            'host': self.host,
            'port': self.port,
        })

    async def send_error(self, msg):
        await send_json(self.ws, {'ev': 'error', 'droneId': self.drone_id, 'msg': msg})

    async def handle_data(self, data):
        if not self.link_ready:
            self.link_ready = True
            await self.send_status()
            await broadcast_swarm({
                'ev': 'status',
                'droneId': self.drone_id,
                'connected': self.connected,
                'linkReady': self.link_ready,
                'proto': self.proto,
                'host': self.host,
                'port': self.port,
            })
        for packet in self.parser.feed(data):
            self.remote_sysid = packet['sysid']
            self.remote_compid = packet['compid']
            msg = decode(packet['msg_id'], packet['payload'])
            if msg:
                event = {'ev': 'mav', 'droneId': self.drone_id, 'msg': msg}
                await send_json(self.ws, event)
                await broadcast_swarm(event)

    async def send_drone(self, data):
        if self.writer:
            try:
                self.writer.write(data)
                await self.writer.drain()
            except Exception as exc:
                log.warning("TCP send D%s: %s", self.drone_id, exc)
        elif self.udp_transport and self.udp_remote:
            try:
                self.udp_transport.sendto(data, self.udp_remote)
            except Exception as exc:
                log.warning("UDP send D%s: %s", self.drone_id, exc)

    async def heartbeat_loop(self):
        try:
            while True:
                await self.send_drone(heartbeat())
                await asyncio.sleep(1)
        except asyncio.CancelledError:
            raise

    async def disconnect(self, silent=False):
        heartbeat_task = self.heartbeat_task
        self.heartbeat_task = None
        if heartbeat_task:
            heartbeat_task.cancel()
            try:
                await heartbeat_task
            except asyncio.CancelledError:
                pass

        read_task = self.read_task
        self.read_task = None
        if read_task and read_task is not asyncio.current_task():
            read_task.cancel()
            try:
                await read_task
            except asyncio.CancelledError:
                pass

        if self.writer:
            try:
                self.writer.close()
                await self.writer.wait_closed()
            except Exception:
                pass
            self.writer = None
            self.reader = None

        if self.udp_transport:
            try:
                self.udp_transport.close()
            except Exception:
                pass
            if self.udp_closed:
                try:
                    await asyncio.wait_for(self.udp_closed, timeout=1)
                except Exception:
                    pass
            self.udp_transport = None
            self.udp_remote = None
            self.udp_closed = None

        was_connected = self.connected
        self.connected = False
        self.link_ready = False
        self.proto = None
        self.host = None
        self.port = None
        self.parser = Parser()

        if not silent and (was_connected or self.drone_id is not None):
            await self.send_status()
            await broadcast_swarm({'ev': 'status', 'droneId': self.drone_id, 'connected': False})

    def build_cmd(self, cmd):
        command = cmd.get('command')
        target_sysid, target_compid = self.remote_sysid, self.remote_compid
        if command == 'arm':
            return cmd_long(target_sysid, target_compid, 400, [1])
        if command == 'disarm':
            return cmd_long(target_sysid, target_compid, 400, [0])
        if command == 'takeoff':
            return cmd_long(target_sysid, target_compid, 22, [0, 0, 0, 0, 0, 0, float(cmd.get('alt', 10))])
        if command == 'land':
            return cmd_long(target_sysid, target_compid, 21, [0])
        if command == 'rtl':
            return cmd_long(target_sysid, target_compid, 20, [0])
        if command == 'set_mode':
            return cmd_long(target_sysid, target_compid, 176, [1, MODE_MAP.get(cmd.get('mode', ''), 0)])
        if command == 'goto':
            return cmd_long(target_sysid, target_compid, 192, [0, 0, 0, 0, float(cmd.get('lat', 0)), float(cmd.get('lon', 0)), float(cmd.get('alt', 10))])
        if command == 'velocity':
            payload = bytearray(37)
            struct.pack_into('<I', payload, 0, 0)
            struct.pack_into('<H', payload, 4, 0b0000111111000111)
            values = [0, 0, 0, float(cmd.get('vx', 0)), float(cmd.get('vy', 0)), float(cmd.get('vz', 0)), 0, 0, 0]
            for i, value in enumerate(values):
                if i * 4 + 4 <= len(payload):
                    struct.pack_into('<f', payload, 6 + i * 4, value)
            return mav1(255, 190, 84, bytes(payload))
        return None

    async def connect_tcp(self, host, port):
        await self.disconnect(silent=True)
        try:
            self.reader, self.writer = await asyncio.wait_for(asyncio.open_connection(host, port), timeout=8)
            self.connected = True
            self.link_ready = True
            self.proto = 'TCP'
            self.host = host
            self.port = port
            await self.send_status()
            await broadcast_swarm({'ev': 'status', 'droneId': self.drone_id, 'connected': True, 'linkReady': True, 'proto': 'TCP', 'host': host, 'port': port})
            self.heartbeat_task = asyncio.create_task(self.heartbeat_loop())
            log.info("Drone %s TCP -> %s:%s", self.drone_id, host, port)

            async def reader_loop():
                try:
                    while True:
                        data = await self.reader.read(4096)
                        if not data:
                            break
                        await self.handle_data(data)
                except asyncio.CancelledError:
                    raise
                except Exception as exc:
                    await self.send_error(str(exc))
                finally:
                    await self.disconnect(silent=False)

            self.read_task = asyncio.create_task(reader_loop())
        except asyncio.TimeoutError:
            await self.send_error(f'TCP timeout {host}:{port}')
        except Exception as exc:
            await self.send_error(str(exc))

    async def connect_udp(self, port):
        await self.disconnect(silent=True)
        try:
            loop = asyncio.get_running_loop()
            session = self

            class UDPProto(asyncio.DatagramProtocol):
                def connection_made(self, transport):
                    session.udp_transport = transport

                def datagram_received(self, data, addr):
                    session.udp_remote = addr
                    asyncio.create_task(session.handle_data(data))

                def error_received(self, exc):
                    log.warning("UDP D%s: %s", session.drone_id, exc)

                def connection_lost(self, exc):
                    if session.udp_closed and not session.udp_closed.done():
                        session.udp_closed.set_result(True)

            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind(('0.0.0.0', port))
            sock.setblocking(False)
            self.udp_closed = loop.create_future()
            transport, _ = await loop.create_datagram_endpoint(lambda: UDPProto(), sock=sock)
            self.udp_transport = transport
            self.connected = True
            self.link_ready = False
            self.proto = 'UDP'
            self.host = None
            self.port = port
            await self.send_status()
            await broadcast_swarm({'ev': 'status', 'droneId': self.drone_id, 'connected': True, 'linkReady': False, 'proto': 'UDP', 'port': port})
            self.heartbeat_task = asyncio.create_task(self.heartbeat_loop())
            log.info("Drone %s UDP port %s", self.drone_id, port)
        except Exception as exc:
            await self.send_error(str(exc))


async def route_swarm_command(message):
    drone_id = message.get('droneId')
    if drone_id is not None:
        session = drone_sessions.get(drone_id)
        if not session or not session.connected:
            return
        packet = session.build_cmd(message)
        if packet:
            await session.send_drone(packet)
        return

    for session in list(drone_sessions.values()):
        if not session.connected:
            continue
        packet = session.build_cmd(message)
        if packet:
            await session.send_drone(packet)


async def fe_handler(ws):
    frontend_clients.add(ws)
    session = DroneSession(ws)
    log.info("Frontend: %s", ws.remote_address)
    try:
        await session.send_status()
        async for raw in ws:
            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_type = message.get('type')
            if msg_type == 'connect':
                session.drone_id = message.get('droneId')
                if session.drone_id is not None:
                    old = drone_sessions.get(session.drone_id)
                    if old and old is not session:
                        await old.disconnect(silent=False)
                    drone_sessions[session.drone_id] = session
                proto = message.get('proto', 'TCP')
                host = message.get('host', '127.0.0.1')
                port = int(message.get('port', 14670 if proto == 'UDP' else 5760))
                duplicate = find_duplicate_session(session, proto, host, port)
                if duplicate:
                    endpoint = f"UDP {port}" if proto == 'UDP' else f"TCP {host}:{port}"
                    await session.send_error(f'Connection already in use by drone {duplicate.drone_id}: {endpoint}')
                    continue
                if proto == 'UDP':
                    await session.connect_udp(port)
                else:
                    await session.connect_tcp(host, port)
            elif msg_type == 'disconnect':
                await session.disconnect(silent=False)
            elif msg_type == 'command':
                if not session.connected:
                    await session.send_error('Not connected')
                    continue
                if session.proto == 'UDP' and not session.link_ready:
                    await session.send_error(f'No telemetry received yet on UDP port {session.port}')
                    continue
                packet = session.build_cmd(message)
                if packet:
                    await session.send_drone(packet)
            elif msg_type == 'swarm_command':
                await broadcast_swarm(message)
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        await session.disconnect(silent=True)
        if session.drone_id is not None and drone_sessions.get(session.drone_id) is session:
            del drone_sessions[session.drone_id]
        frontend_clients.discard(ws)
        log.info("Frontend disconnected: %s", ws.remote_address)


async def sw_handler(ws):
    swarm_clients.add(ws)
    log.info("Swarm layer: %s", ws.remote_address)
    try:
        statuses = [
            {
                'droneId': session.drone_id,
                'connected': session.connected,
                'proto': session.proto,
                'host': session.host,
                'port': session.port,
            }
            for session in drone_sessions.values()
            if session.drone_id is not None
        ]
        await send_json(ws, {'ev': 'status', 'connected': any(s['connected'] for s in statuses), 'drones': statuses})
        async for raw in ws:
            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_type = message.get('type')
            if msg_type == 'command':
                await route_swarm_command(message)
            elif msg_type == 'swarm_status':
                await send_json_to_frontends({'ev': 'swarm', 'data': message})
            elif msg_type == 'swarm_positions':
                await send_json_to_frontends({
                    'ev': 'swarm_positions',
                    'drones': message.get('drones', []),
                    'swarm_mode': message.get('swarm_mode', 'idle'),
                    'search_progress': message.get('search_progress', 0),
                    'formation': message.get('formation', 'wedge'),
                    'drone_count': message.get('drone_count', 0),
                })
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        swarm_clients.discard(ws)
        log.info("Swarm layer disconnected: %s", ws.remote_address)


async def send_json_to_frontends(obj):
    msg = json.dumps(obj)
    dead = set()
    for ws in frontend_clients:
        try:
            await ws.send(msg)
        except Exception:
            dead.add(ws)
    frontend_clients.difference_update(dead)


async def main():
    log.info("Starting GCS Server (Layer 2)...")
    fe_srv = await websockets.serve(fe_handler, '0.0.0.0', 8765, ping_interval=20, ping_timeout=10)
    sw_srv = await websockets.serve(sw_handler, '0.0.0.0', 8766, ping_interval=20, ping_timeout=10)
    log.info("GCS Server ready:")
    log.info("   Frontend WS -> ws://localhost:8765/ws")
    log.info("   Swarm Layer -> ws://localhost:8766/swarm")
    await asyncio.gather(fe_srv.wait_closed(), sw_srv.wait_closed())


if __name__ == '__main__':
    asyncio.run(main())
