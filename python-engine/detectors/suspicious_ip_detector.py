"""
====================================
LogHawk – Suspicious IP Detector
====================================
detectors/suspicious_ip_detector.py

Detects suspicious IP behavior including:
- Known bad IP ranges (RFC 5737 documentation ranges used as examples)
- IPs with high volume of connections
- Internal IPs appearing in external-facing logs

Future: Integration with AbuseIPDB and VirusTotal APIs.
"""

import re
from collections import Counter


class SuspiciousIPDetector:
    """Detects suspicious IP address patterns."""

    IP_PATTERN = re.compile(r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})')

    # Known suspicious/documentation IP ranges for demonstration
    SUSPICIOUS_RANGES = [
        '192.0.2.',     # TEST-NET-1 (RFC 5737)
        '198.51.100.',  # TEST-NET-2 (RFC 5737)
        '203.0.113.',   # TEST-NET-3 (RFC 5737)
    ]

    # Threshold: IPs with more than this many events are flagged
    HIGH_VOLUME_THRESHOLD = 50

    def detect(self, entries):
        """Analyze entries for suspicious IP behavior."""
        threats = []
        ip_counter = Counter()

        # Count IP occurrences
        for entry in entries:
            raw = entry.get('raw', '')
            ips = self.IP_PATTERN.findall(raw)
            for ip in ips:
                ip_counter[ip] += 1

        # Flag high-volume IPs
        for ip, count in ip_counter.items():
            if count >= self.HIGH_VOLUME_THRESHOLD:
                threats.append({
                    'type': 'suspicious_ip',
                    'severity': 'medium' if count < 100 else 'high',
                    'confidence': min(85, 40 + count // 5),
                    'source_ip': ip,
                    'description': f'High volume activity: {count} events from {ip}',
                    'event_count': count,
                    'recommendation': 'Investigate IP reputation via AbuseIPDB/VirusTotal',
                })

            # Check against suspicious ranges
            for prefix in self.SUSPICIOUS_RANGES:
                if ip.startswith(prefix):
                    threats.append({
                        'type': 'suspicious_ip',
                        'severity': 'high',
                        'confidence': 60,
                        'source_ip': ip,
                        'description': f'IP {ip} belongs to a known suspicious/test range',
                        'recommendation': 'Verify if this IP should be communicating with your systems',
                    })

        return threats
