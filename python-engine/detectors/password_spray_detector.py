"""
====================================
LogHawk – Password Spray Detector
====================================
detectors/password_spray_detector.py

Detects password spray attacks by identifying a single source IP
attempting failed logins against multiple unique usernames.

Detection Logic:
    - 1 IP + >= 4 unique usernames targeted with failures = HIGH
    - 1 IP + >= 8 unique usernames targeted with failures = CRITICAL

Unlike brute force (many attempts against one account), password spray
spreads low-count attempts across many accounts to evade lockout policies.
"""

import re
from collections import defaultdict


class PasswordSprayDetector:
    """Detects password spray attacks across multiple user accounts."""

    FAILED_AUTH_PATTERNS = [
        re.compile(r'Failed password for(?: invalid user)?\s+(\S+)', re.IGNORECASE),
        re.compile(r'authentication failure.*user=(\S+)', re.IGNORECASE),
        re.compile(r'invalid user\s+(\S+)', re.IGNORECASE),
        re.compile(r'failed login.*?user[:\s]+(\S+)', re.IGNORECASE),
    ]

    # Generic failed pattern (no username capture)
    GENERIC_FAILED = [
        re.compile(r'Failed password', re.IGNORECASE),
        re.compile(r'authentication failure', re.IGNORECASE),
        re.compile(r'invalid user', re.IGNORECASE),
    ]

    IP_PATTERN = re.compile(r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})')

    # Thresholds
    HIGH_THRESHOLD = 4     # unique usernames
    CRITICAL_THRESHOLD = 8

    def _extract_username(self, raw):
        """Try to extract a username from a failed auth log line."""
        for pattern in self.FAILED_AUTH_PATTERNS:
            m = pattern.search(raw)
            if m:
                return m.group(1).strip()
        return None

    def detect(self, entries):
        """
        Analyze log entries for password spray patterns.

        Args:
            entries (list[dict]): Parsed log entries

        Returns:
            list[dict]: Detected threats
        """
        threats = []
        # ip -> set of unique usernames targeted
        ip_to_users = defaultdict(set)
        # ip -> first entry index seen
        ip_first_seen = {}

        for i, entry in enumerate(entries):
            raw = entry.get('raw', '') or entry.get('message', '') or entry.get('rawLog', '')

            # Only process failed auth events
            is_failed = any(p.search(raw) for p in self.GENERIC_FAILED)
            if not is_failed:
                continue

            ip_match = self.IP_PATTERN.search(raw)
            ip = ip_match.group(1) if ip_match else 'unknown'

            username = self._extract_username(raw)
            if username and username not in ('root',):  # exclude trivially known accounts
                ip_to_users[ip].add(username)
            elif username:
                ip_to_users[ip].add(username)

            if ip not in ip_first_seen:
                ip_first_seen[ip] = i

        # Generate threats based on unique usernames per IP
        for ip, users in ip_to_users.items():
            count = len(users)
            if count >= self.CRITICAL_THRESHOLD:
                threats.append({
                    'type': 'password_spray',
                    'severity': 'critical',
                    'confidence': min(95, 60 + count * 3),
                    'source_ip': ip,
                    'description': (
                        f'Critical: Password spray from {ip} — {count} unique accounts targeted. '
                        f'Accounts: {", ".join(sorted(users)[:5])}{"..." if count > 5 else ""}'
                    ),
                    'event_count': count,
                    'targeted_users': list(users),
                    'targeted_users_count': count,
                    'recommendation': (
                        'Block source IP immediately. Audit all targeted accounts for compromise. '
                        'Enable MFA across organization.'
                    ),
                })
            elif count >= self.HIGH_THRESHOLD:
                threats.append({
                    'type': 'password_spray',
                    'severity': 'high',
                    'confidence': min(85, 45 + count * 5),
                    'source_ip': ip,
                    'description': (
                        f'Password spray detected from {ip} — {count} unique accounts targeted. '
                        f'Accounts: {", ".join(sorted(users)[:5])}{"..." if count > 5 else ""}'
                    ),
                    'event_count': count,
                    'targeted_users': list(users),
                    'targeted_users_count': count,
                    'recommendation': (
                        'Investigate source IP. Monitor targeted accounts for unauthorized access. '
                        'Consider temporary IP block.'
                    ),
                })

        return threats
