"""
====================================
LogHawk – Port Scan Detector
====================================
detectors/portscan_detector.py

Detects port scanning activity by identifying
single IPs connecting to multiple destination ports
within a short time frame.
"""

import re
from collections import defaultdict


class PortScanDetector:
    """Detects port scanning behavior in log entries."""

    PORT_PATTERN = re.compile(r':(\d{1,5})\b')
    IP_PATTERN = re.compile(r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})')

    # If an IP connects to this many unique ports, flag it
    PORT_THRESHOLD = 10

    def detect(self, entries):
        """Analyze entries for port scanning patterns."""
        threats = []
        ip_ports = defaultdict(set)  # IP -> set of destination ports

        for entry in entries:
            raw = entry.get('raw', '')
            ips = self.IP_PATTERN.findall(raw)
            ports = self.PORT_PATTERN.findall(raw)

            src_ip = ips[0] if ips else None
            for port in ports:
                port_num = int(port)
                if src_ip and 1 <= port_num <= 65535:
                    ip_ports[src_ip].add(port_num)

        # Flag IPs scanning multiple ports
        for ip, ports in ip_ports.items():
            port_count = len(ports)
            if port_count >= self.PORT_THRESHOLD:
                severity = 'critical' if port_count >= 50 else 'high' if port_count >= 20 else 'medium'
                threats.append({
                    'type': 'port_scan',
                    'severity': severity,
                    'confidence': min(90, 30 + port_count * 2),
                    'source_ip': ip,
                    'description': f'Port scan detected: {ip} probed {port_count} unique ports',
                    'ports_scanned': port_count,
                    'sample_ports': sorted(list(ports))[:20],
                    'recommendation': 'Block IP at firewall, investigate for further intrusion attempts',
                })

        return threats
