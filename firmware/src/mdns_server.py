import socket
import struct
import time
from src import config

class MDNSServer:
    def __init__(self, ip):
        self.ip = ip
        self.hostname = config.HOSTNAME
        self.sock = None
        self.running = False


    def run(self):
        self.running = True
        try:
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.sock.bind(('', 5353))
            
            mreq = struct.pack("4sl", socket.inet_aton("224.0.0.251"), socket.INADDR_ANY)
            self.sock.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, mreq)
            
            print(f"[mDNS] Started for {self.hostname}.local -> {self.ip}")
            
            while self.running:
                try:
                    data, addr = self.sock.recvfrom(1024)
                    if not data:
                        continue
                    
                    # Basic check for hostname query
                    # This is very simplified matching
                    query_name = self.hostname.encode() + b'.local'
                    
                    # Find query in packet (simple substring search for now)
                    # A proper parser would be better but requires more code/memory
                    # Standard mDNS queries often include the name length-prefixed
                    
                    # Check if 'prismo' and 'local' are in the packet
                    if self.hostname.encode() in data and b'local' in data:
                        self.send_response(data, addr)
                        
                except Exception as e:
                    print(f"[mDNS] Loop error: {e}")
                    time.sleep(1)
                    
        except Exception as e:
            print(f"[mDNS] Start error: {e}")
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
            print(f"[mDNS] Send error: {e}")

    def stop(self):
        self.running = False
        if self.sock:
            self.sock.close()
