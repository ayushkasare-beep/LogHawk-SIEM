"""
====================================
LogHawk – Privilege Escalation Detector
====================================
detectors/privilege_escalation_detector.py

Detects privilege escalation attempts by identifying
sudo usage, su commands, and unauthorized privilege changes.
"""

import re


class PrivilegeEscalationDetector:
    """Detects privilege escalation attempts in log entries."""

    ESCALATION_PATTERNS = [
        (re.compile(r'sudo.*FAILED', re.IGNORECASE), 'high', 'Failed sudo attempt'),
        (re.compile(r'sudo.*NOT\s+in\s+sudoers', re.IGNORECASE), 'critical', 'User not in sudoers file'),
        (re.compile(r'su\[\d+\]:\s+FAILED', re.IGNORECASE), 'high', 'Failed su command'),
        (re.compile(r'privilege\s+escalation', re.IGNORECASE), 'critical', 'Privilege escalation detected'),
        (re.compile(r'changed\s+password', re.IGNORECASE), 'medium', 'Password change detected'),
        (re.compile(r'useradd|usermod|groupadd', re.IGNORECASE), 'medium', 'User/group modification'),
        (re.compile(r'chmod\s+[47]', re.IGNORECASE), 'high', 'Dangerous permission change (SUID/world-writable)'),
    ]

    def detect(self, entries):
        """Analyze entries for privilege escalation indicators."""
        threats = []

        for entry in entries:
            raw = entry.get('raw', '') or entry.get('message', '')

            for pattern, severity, desc in self.ESCALATION_PATTERNS:
                if pattern.search(raw):
                    threats.append({
                        'type': 'privilege_escalation',
                        'severity': severity,
                        'confidence': 75,
                        'description': f'{desc}: {raw[:120]}',
                        'source_ip': entry.get('ip', entry.get('src_ip', 'N/A')),
                        'recommendation': 'Review user activity, verify authorization, check for persistence mechanisms',
                    })

        return threats
