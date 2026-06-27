"""
====================================
LogHawk – Reconnaissance Detector
====================================
detectors/reconnaissance_detector.py

Detects reconnaissance and enumeration activities
such as directory traversal, user enumeration, and
information gathering attempts.
"""

import re


class ReconnaissanceDetector:
    """Detects reconnaissance and enumeration activity."""

    RECON_PATTERNS = [
        (re.compile(r'\.\./\.\./|%2e%2e', re.IGNORECASE), 'high', 'Directory traversal attempt'),
        (re.compile(r'/etc/passwd|/etc/shadow', re.IGNORECASE), 'critical', 'Sensitive file access attempt'),
        (re.compile(r'\.env|wp-config|config\.php', re.IGNORECASE), 'high', 'Configuration file probing'),
        (re.compile(r'/admin|/phpmyadmin|/wp-admin', re.IGNORECASE), 'medium', 'Admin panel enumeration'),
        (re.compile(r'nmap|nikto|dirb|gobuster|masscan', re.IGNORECASE), 'high', 'Security scanner detected'),
        (re.compile(r'User-Agent:.*bot|crawler|spider', re.IGNORECASE), 'low', 'Bot/crawler activity'),
        (re.compile(r'Invalid user \w+ from', re.IGNORECASE), 'medium', 'Username enumeration'),
    ]

    def detect(self, entries):
        """Analyze entries for reconnaissance indicators."""
        threats = []

        for entry in entries:
            raw = entry.get('raw', '') or entry.get('message', '')

            for pattern, severity, desc in self.RECON_PATTERNS:
                if pattern.search(raw):
                    threats.append({
                        'type': 'reconnaissance',
                        'severity': severity,
                        'confidence': 70,
                        'description': f'{desc}: {raw[:120]}',
                        'source_ip': entry.get('ip', entry.get('src_ip', 'N/A')),
                        'recommendation': 'Monitor source IP for further activity, consider WAF rules',
                    })

        return threats
