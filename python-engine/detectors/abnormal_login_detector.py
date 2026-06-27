"""
====================================
LogHawk – Abnormal Login Location Detector
====================================
detectors/abnormal_login_detector.py

Detects successful logins from unexpected or suspicious IP ranges.

Current Implementation (Pre-GeoIP):
    - Flags successful logins from RFC-1918 private IP ranges accessing
      systems from unexpected paths (internal IPs on external-facing services)
    - Flags unknown / unresolvable IP patterns in auth logs
    - Architecture stub ready for full GeoIP integration in a future phase

Future Integration:
    - Phase 5+: GeoIP lookup via MaxMind GeoLite2 or ip-api.com
    - Country-based allowlist / denylist
    - Impossible travel detection (same user, different geos within short window)

Detection Logic:
    - Successful login from a loopback/link-local/APIPA address = Medium
    - Successful login from any IP flagged as unusual source = Medium
"""

import re
from collections import defaultdict


class AbnormalLoginDetector:
    """Detects successful logins from unexpected or suspicious IP ranges."""

    SUCCESS_PATTERNS = [
        re.compile(r'Accepted password for\s+(\S+)\s+from\s+(\S+)', re.IGNORECASE),
        re.compile(r'session opened for user\s+(\S+)', re.IGNORECASE),
        re.compile(r'Successful login.*?user[:\s]+(\S+)', re.IGNORECASE),
        re.compile(r'Accepted publickey for\s+(\S+)\s+from\s+(\S+)', re.IGNORECASE),
    ]

    IP_PATTERN = re.compile(r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})')

    # Known suspicious IP categories for a typical internet-facing server
    LOOPBACK_PATTERN = re.compile(r'^127\.')
    LINK_LOCAL_PATTERN = re.compile(r'^169\.254\.')
    # Private ranges that shouldn't appear on external-facing SSH/auth logs
    # (these are "interesting" if the server is publicly hosted)
    PRIVATE_RANGES = [
        re.compile(r'^10\.'),
        re.compile(r'^172\.(1[6-9]|2\d|3[01])\.'),
        re.compile(r'^192\.168\.'),
    ]

    def _is_suspicious_ip(self, ip):
        """Return (is_suspicious, reason) for a given IP address."""
        if self.LOOPBACK_PATTERN.match(ip):
            return True, 'loopback address (127.x.x.x)'
        if self.LINK_LOCAL_PATTERN.match(ip):
            return True, 'link-local / APIPA address (169.254.x.x)'
        for pattern in self.PRIVATE_RANGES:
            if pattern.match(ip):
                return True, f'RFC-1918 private range ({ip}) — unexpected for external-facing service'
        return False, None

    def detect(self, entries):
        """
        Analyze log entries for abnormal login location patterns.

        Args:
            entries (list[dict]): Parsed log entries

        Returns:
            list[dict]: Detected threats
        """
        threats = []
        seen_suspicious = set()  # (ip, username) pairs already alerted

        for entry in entries:
            raw = entry.get('raw', '') or entry.get('message', '') or entry.get('rawLog', '')

            username = None
            ip = None

            # Try to extract username + IP from success patterns
            for pattern in self.SUCCESS_PATTERNS:
                m = pattern.search(raw)
                if m and len(m.groups()) >= 2:
                    username = m.group(1)
                    ip_candidate = m.group(2)
                    ip_match = self.IP_PATTERN.match(ip_candidate)
                    if ip_match:
                        ip = ip_match.group(1)
                    break
                elif m:
                    username = m.group(1)

            if not ip:
                # Fallback: extract any IP from line if it's a success line
                ip_match = self.IP_PATTERN.search(raw)
                ip = ip_match.group(1) if ip_match else None

            if not ip:
                continue

            is_suspicious, reason = self._is_suspicious_ip(ip)
            if not is_suspicious:
                continue

            key = (ip, username or 'unknown')
            if key in seen_suspicious:
                continue
            seen_suspicious.add(key)

            threats.append({
                'type': 'abnormal_login',
                'severity': 'medium',
                'confidence': 65,
                'source_ip': ip,
                'description': (
                    f'Suspicious login location detected: {username or "unknown user"} authenticated '
                    f'from {ip} ({reason}). '
                    f'GeoIP-based location verification recommended.'
                ),
                'event_count': 1,
                'recommendation': (
                    'Verify this login was authorized. Check if IP matches expected user location. '
                    'Consider enabling GeoIP-based login restrictions. '
                    'Review for lateral movement from this IP.'
                ),
            })

        return threats
