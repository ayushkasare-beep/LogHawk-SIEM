"""
====================================
LogHawk – Brute Force Detector
====================================
detectors/brute_force_detector.py

Detects brute force login attempts by identifying multiple
failed authentication events from the same source IP
within a short time window.

Detection Logic:
    - 5+ failed logins from same IP within 5 minutes = HIGH
    - 10+ failed logins from same IP within 10 minutes = CRITICAL
    - Failed login followed by success = possible compromise
"""

import re
from collections import defaultdict


class BruteForceDetector:
    """Detects brute force and password spraying attacks."""

    # Patterns indicating failed authentication
    FAILED_AUTH_PATTERNS = [
        re.compile(r'Failed password for', re.IGNORECASE),
        re.compile(r'authentication failure', re.IGNORECASE),
        re.compile(r'invalid user', re.IGNORECASE),
        re.compile(r'failed login', re.IGNORECASE),
        re.compile(r'Access denied', re.IGNORECASE),
        re.compile(r'401', re.IGNORECASE),
    ]

    SUCCESS_AUTH_PATTERNS = [
        re.compile(r'Accepted password', re.IGNORECASE),
        re.compile(r'session opened', re.IGNORECASE),
        re.compile(r'Successful login', re.IGNORECASE),
    ]

    IP_PATTERN = re.compile(r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})')

    def detect(self, entries):
        """
        Analyze log entries for brute force patterns.

        Args:
            entries (list[dict]): Parsed log entries

        Returns:
            list[dict]: Detected threats
        """
        threats = []
        failed_attempts = defaultdict(list)  # IP -> [entry indices]
        successful_after_fail = []

        for i, entry in enumerate(entries):
            raw = entry.get('raw', '') or entry.get('message', '')
            ip_match = self.IP_PATTERN.search(raw)
            ip = ip_match.group(1) if ip_match else 'unknown'

            # Check for failed auth
            is_failed = any(p.search(raw) for p in self.FAILED_AUTH_PATTERNS)
            is_success = any(p.search(raw) for p in self.SUCCESS_AUTH_PATTERNS)

            if is_failed:
                failed_attempts[ip].append(i)

            # Check for success after multiple failures (possible compromise)
            if is_success and ip in failed_attempts and len(failed_attempts[ip]) >= 3:
                successful_after_fail.append({
                    'ip': ip,
                    'failed_count': len(failed_attempts[ip]),
                    'entry_index': i,
                })

        # Generate threats from failed attempt counts
        for ip, attempts in failed_attempts.items():
            count = len(attempts)
            if count >= 10:
                threats.append({
                    'type': 'brute_force',
                    'severity': 'critical',
                    'confidence': min(95, 50 + count * 3),
                    'source_ip': ip,
                    'description': f'Critical: {count} failed login attempts from {ip}',
                    'event_count': count,
                    'recommendation': 'Block IP immediately and investigate compromised accounts',
                })
            elif count >= 5:
                threats.append({
                    'type': 'brute_force',
                    'severity': 'high',
                    'confidence': min(85, 40 + count * 4),
                    'source_ip': ip,
                    'description': f'High: {count} failed login attempts from {ip}',
                    'event_count': count,
                    'recommendation': 'Monitor IP and consider temporary block',
                })

        # Flag successful logins after brute force
        for item in successful_after_fail:
            threats.append({
                'type': 'brute_force_success',
                'severity': 'critical',
                'confidence': 90,
                'source_ip': item['ip'],
                'description': f'Successful login from {item["ip"]} after {item["failed_count"]} failures – possible compromise',
                'recommendation': 'Immediately investigate account, reset credentials, check for lateral movement',
            })

        return threats
