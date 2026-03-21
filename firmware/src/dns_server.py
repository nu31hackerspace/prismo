import socket
import time
from src import health_log

class DNSServer:
    def __init__(self, ip):
        self.ip = ip
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.sock.bind(('', 53))
        self.running = True
        
    def handle_request(self, data, addr):
        # Header: ID (2B), Flags (2B), QDCOUNT (2B), ANCOUNT (2B), ...
        # Response: ID, Flags (0x8180), QDCOUNT, ANCOUNT (1), ...
        
        # Simple parsing to get query domain
        # Should actually fully parse answer...
        # But for captive portal we return our IP for everything
        
        # Parse query ID
        tid = data[0:2]
        
        # Flags
        # 0x8180 Standard query response, No error
        flags = b'\x81\x80'
        
        # Counts
        qdcount = data[4:6]
        ancount = b'\x00\x01'
        nscount = b'\x00\x00'
        arcount = b'\x00\x00'
        
        # Query section (Question) - we just copy it back
        # The query name is variable length.
        # It ends with 0x00.
        # Then type (2B) and class (2B).
        
        # Find end of query name
        idx = 12
        while data[idx] != 0:
            idx += data[idx] + 1
        idx += 1 # 0 byte
        idx += 4 # Type and Class
        
        query_section = data[12:idx]
        
        # Answer section
        # Name ptr (pointer to offset 12) => 0xC00C
        name_ptr = b'\xC0\x0C'
        type_a = b'\x00\x01'
        class_in = b'\x00\x01'
        ttl = b'\x00\x00\x00\x3C' # 60s
        dlen = b'\x00\x04' # 4 bytes IP
        
        # Convert IP string to bytes
        ip_parts = map(int, self.ip.split('.'))
        addr_bytes = bytes(ip_parts)
        
        response = tid + flags + qdcount + ancount + nscount + arcount + query_section + name_ptr + type_a + class_in + ttl + dlen + addr_bytes
        
        self.sock.sendto(response, addr)

    def run(self):
        health_log.write_info("DNS server started", ip=self.ip)
        while self.running:
            try:
                # Use select or non-blocking?
                # For simplicity in this loop, blocking recv
                data, addr = self.sock.recvfrom(1024)
                if data:
                    self.handle_request(data, addr)
            except Exception as e:
                health_log.write_error("DNS error", error=str(e))
                # Avoid tight loop on error
                time.sleep(1)

    def stop(self):
        self.running = False
        self.sock.close()