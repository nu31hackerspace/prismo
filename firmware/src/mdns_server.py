import socket
import struct
import time
from src import health_log

class MDNSServer:
    def __init__(self, ip, hostname):
        self.ip = ip
        self.hostname = hostname
        self.sock = None
        self.running = False


    def run(self):
        self.running = True
        time.sleep(3)
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

        bound = False
        for attempt in range(8):
            try:
                self.sock.bind(('', 5353))
                bound = True
                break
            except OSError as e:
                if e.args[0] == 112:  # EADDRINUSE
                    health_log.write_warn("mDNS EADDRINUSE, retrying...", attempt=attempt + 1)
                    time.sleep(2)
                else:
                    health_log.write_error("mDNS bind error", error=str(e))
                    self.sock.close()
                    return

        if not bound:
            health_log.write_error("mDNS failed to bind after retries, skipping mDNS")
            self.sock.close()
            return

        try:
            mreq = struct.pack("4sl", socket.inet_aton("224.0.0.251"), socket.INADDR_ANY)
            self.sock.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, mreq)
        except Exception as e:
            health_log.write_warn("mDNS multicast join failed", error=str(e))

        self.sock.settimeout(2.0)
        health_log.write_info("mDNS started", hostname=self.hostname + ".local", ip=self.ip)

        while self.running:
            try:
                data, addr = self.sock.recvfrom(1024)
                if not data:
                    continue
                if self.hostname.encode() in data and b'local' in data:
                    self.send_response(data, addr)
            except OSError:
                pass
            except Exception as e:
                health_log.write_warn("mDNS loop error", error=str(e))
                time.sleep(1)

        if self.sock:
            self.sock.close()

    def send_response(self, data, addr):
        # Construct response
        # Transaction ID: 0x0000 (standard for mDNS responses)
        # Flags: 0x8400 (Authoritative Answer)
        
        tid = b'\x00\x00'
        flags = b'\x84\x00'
        qdcount = b'\x00\x00'
        ancount = b'\x00\x01'
        nscount = b'\x00\x00'
        arcount = b'\x00\x00'
        
        # Answer Name
        # Format: [len]label[len]label[0]
        # e.g. [6]prismo[5]local[0]
        name_bytes = b''
        parts = (self.hostname + '.local').split('.')
        for part in parts:
            name_bytes += bytes([len(part)]) + part.encode()
        name_bytes += b'\x00'
        
        # Type A (1), Class IN (1) + Cache Flush (0x8000) => 0x8001
        type_a = b'\x00\x01'
        class_in = b'\x00\x01' # Using standard class for simplicity
        ttl = b'\x00\x00\x00\x3c' # 60 seconds
        dlen = b'\x00\x04' # 4 bytes
        
        ip_parts = [int(x) for x in self.ip.split('.')]
        ip_bytes = bytes(ip_parts)
        
        answer = name_bytes + type_a + class_in + ttl + dlen + ip_bytes
        
        response = tid + flags + qdcount + ancount + nscount + arcount + answer
        
        try:
            # Send to multicast group
            self.sock.sendto(response, ('224.0.0.251', 5353))
        except Exception as e:
            health_log.write_warn("mDNS send error", error=str(e))

    def stop(self):
        self.running = False
        if self.sock:
            self.sock.close()
