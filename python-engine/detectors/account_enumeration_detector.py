"""
====================================
LogHawk – Account Enumeration Detector
====================================
detectors/account_enumeration_detector.py

Detects user account discovery / enumeration by identifying a single
source IP attempting authentication with a large number of unique
usernames (including invalid/non-existent ones).

Detection Logic:
    - 1 IP + >= 10 unique usernames (including invalid users) = MEDIUM
    - 1 IP + >= 20 unique usernames = HIGH

This differs from password spray in that enumeration aims to discover
valid accounts, often accepting ANY result (success or failure) as
valuable intel. High unique-username counts from one IP signal a
systematic account scan.
"""

import re
from collections import defaultdict


class AccountEnumerationDetector:
    """Detects systematic account enumeration / user discovery activity."""

    # Patterns that reveal a username is being tried
    ENUM_PATTERNS = [
        re.compile(r'(?:invalid user|Failed password for invalid user)\s+(\S+)', re.IGNORECASE),
        re.compile(r'Failed password for\s+(\S+)', re.IGNORECASE),
        re.compile(r'authentication failure.*?user=(\S+)', re.IGNORECASE),
        re.compile(r'user not found[:\s]+(\S+)', re.IGNORECASE),
        re.compile(r'no such user[:\s]+(\S+)', re.IGNORECASE),
    ]

    # Generic "any auth attempt" patterns
    AUTH_ATTEMPT_PATTERNS = [
        re.compile(r'Failed password', re.IGNORECASE),
        re.compile(r'authentication failure', re.IGNORECASE),
        re.compile(r'invalid user', re.IGNORECASE),
        re.compile(r'Accepted password', re.IGNORECASE),
        re.compile(r'no such user', re.IGNORECASE),
    ]

    IP_PATTERN = re.compile(r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})')

    # Thresholds
    MEDIUM_THRESHOLD = 10   # unique usernames to flag as Medium
    HIGH_THRESHOLD = 20     # unique usernames to flag as High

    def _extract_username(self, raw):
        for pattern in self.ENUM_PATTERNS:
            m = pattern.search(raw)
            if m:
                return m.group(1).strip().rstrip('.,;:')
        return None

    def detect(self, entries):
        """
        Analyze log entries for account enumeration patterns.

        Args:
            entries (list[dict]): Parsed log entries

        Returns:
            list[dict]: Detected threats
        """
        threats = []
        ip_to_users = defaultdict(set)
        ip_to_total_attempts = defaultdict(int)

        for entry in entries:
            raw = entry.get('raw', '') or entry.get('message', '') or entry.get('rawLog', '')

            is_auth_attempt = any(p.search(raw) for p in self.AUTH_ATTEMPT_PATTERNS)
            if not is_auth_attempt:
                continue

            ip_match = self.IP_PATTERN.search(raw)
            ip = ip_match.group(1) if ip_match else 'unknown'

            ip_to_total_attempts[ip] += 1
            username = self._extract_username(raw)
            if username:
                ip_to_users[ip].add(username)

        for ip, users in ip_to_users.items():
            count = len(users)
            total = ip_to_total_attempts.get(ip, count)

            if count >= self.HIGH_THRESHOLD:
                threats.append({
                    'type': 'account_enumeration',
                    'severity': 'high',
                    'confidence': min(90, 55 + count * 2),
                    'source_ip': ip,
                    'description': (
                        f'Account enumeration from {ip}: {count} unique usernames probed '
                        f'across {total} total attempts. Likely automated user discovery scan.'
                    ),
                    'event_count': total,
                    'unique_usernames': count,
                    'unique_usernames_list': list(users)[:20],
                    'recommendation': (
                        'Block source IP. Audit authentication systems for exposed user lists. '
                        'Implement account enumeration protections (consistent error messages, rate limiting).'
                    ),
                })
            elif count >= self.MEDIUM_THRESHOLD:
                threats.append({
                    'type': 'account_enumeration',
                    'severity': 'medium',
                    'confidence': min(75, 40 + count * 2),
                    'source_ip': ip,
                    'description': (
                        f'Account enumeration suspected from {ip}: {count} unique usernames '
                        f'probed in {total} attempts.'
                    ),
                    'event_count': total,
                    'unique_usernames': count,
                    'unique_usernames_list': list(users)[:20],
                    'recommendation': (
                        'Monitor source IP activity. Consider rate limiting authentication attempts. '
                        'Review for subsequent brute force activity.'
                    ),
                })

        return threats
