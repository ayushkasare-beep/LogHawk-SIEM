"""
====================================
LogHawk – Linux Auth Log Parser
====================================
parsers/linux_auth_parser.py

Parses Linux authentication logs (/var/log/auth.log, /var/log/secure)
into structured JSON events.

Supported log patterns:
  - SSH login attempts (Failed password, Accepted password)
  - Invalid user probes
  - Sudo usage (success and failure)
  - PAM session events (opened/closed)
  - Key-based authentication

Usage:
    python linux_auth_parser.py --file /path/to/auth.log --output json

Output JSON:
{
  "status": "success",
  "total": 1247,
  "events": [ { "timestamp": "...", "username": "...", ... } ],
  "stats": { "total": 1247, "failed": 892, "successful": 355, "unknown": 0 }
}
"""

import argparse
import json
import re
import sys
import os
from datetime import datetime


# ====================================
# Regex Patterns
# ====================================

# Standard syslog header: "Jun 15 10:01:23 hostname service[pid]:"
SYSLOG_HEADER = re.compile(
    r'^(?P<month>\w{3})\s+(?P<day>\d{1,2})\s+(?P<time>\d{2}:\d{2}:\d{2})\s+'
    r'(?P<hostname>\S+)\s+(?P<service>\S+?)(?:\[\d+\])?:\s*(?P<message>.*)'
)

# SSH patterns
RE_FAILED_PASSWORD = re.compile(
    r'Failed password for (?:invalid user )?(\S+) from ([\d.]+)', re.IGNORECASE
)
RE_ACCEPTED_PASSWORD = re.compile(
    r'Accepted password for (\S+) from ([\d.]+)', re.IGNORECASE
)
RE_ACCEPTED_PUBKEY = re.compile(
    r'Accepted publickey for (\S+) from ([\d.]+)', re.IGNORECASE
)
RE_INVALID_USER = re.compile(
    r'Invalid user (\S+) from ([\d.]+)', re.IGNORECASE
)
RE_SESSION_OPENED = re.compile(
    r'session opened for user (\S+)', re.IGNORECASE
)
RE_SESSION_CLOSED = re.compile(
    r'session closed for user (\S+)', re.IGNORECASE
)
RE_DISCONNECTED = re.compile(
    r'Disconnected from(?: invalid user)? (\S+)? ?([\d.]+)', re.IGNORECASE
)

# Sudo patterns — message starts with "username : TTY=..."
RE_SUDO_SUCCESS = re.compile(r'^(\S+)\s*:\s*TTY=')
RE_SUDO_FAILURE = re.compile(
    r'authentication failure.*(?:logname|user)=(\S+)', re.IGNORECASE
)
RE_SUDO_NOT_ALLOWED = re.compile(
    r'(\S+)\s*:\s*.*NOT in sudoers', re.IGNORECASE
)


def parse_timestamp(month, day, time_str):
    """
    Parse a syslog timestamp into an ISO 8601 string.
    Since syslog doesn't include the year, we use the current year.
    """
    try:
        current_year = datetime.now().year
        dt = datetime.strptime(
            f'{current_year} {month} {day.strip()} {time_str}',
            '%Y %b %d %H:%M:%S'
        )
        return dt.isoformat()
    except (ValueError, TypeError):
        return None


def classify_message(service, message):
    """
    Classify a single log message and extract structured fields.

    Returns:
        tuple: (username, ip_address, event_type, status)
    """
    service_lower = service.lower()

    # ---- SSH / SSHD events ----
    if 'sshd' in service_lower or 'ssh' in service_lower:

        # Failed password attempt
        m = RE_FAILED_PASSWORD.search(message)
        if m:
            return m.group(1), m.group(2), 'Login', 'Failed'

        # Accepted password
        m = RE_ACCEPTED_PASSWORD.search(message)
        if m:
            return m.group(1), m.group(2), 'Login', 'Success'

        # Accepted public key
        m = RE_ACCEPTED_PUBKEY.search(message)
        if m:
            return m.group(1), m.group(2), 'Authentication', 'Success'

        # Invalid user (SSH probe — no valid account)
        m = RE_INVALID_USER.search(message)
        if m:
            return m.group(1), m.group(2), 'Authentication', 'Failed'

        # Session opened (login successful)
        m = RE_SESSION_OPENED.search(message)
        if m:
            return m.group(1), None, 'Session', 'Success'

        # Session closed
        m = RE_SESSION_CLOSED.search(message)
        if m:
            return m.group(1), None, 'Session', 'Unknown'

        # Disconnected
        m = RE_DISCONNECTED.search(message)
        if m:
            user = m.group(1) if m.group(1) else None
            ip = m.group(2) if m.group(2) else None
            return user, ip, 'Authentication', 'Unknown'

    # ---- Sudo events ----
    if 'sudo' in service_lower:

        # Not in sudoers — privilege escalation attempt
        m = RE_SUDO_NOT_ALLOWED.search(message)
        if m:
            return m.group(1), None, 'Sudo', 'Failed'

        # Authentication failure (bad sudo password)
        m = RE_SUDO_FAILURE.search(message)
        if m:
            return m.group(1), None, 'Sudo', 'Failed'

        # Successful sudo command: "username : TTY=pts/0 ..."
        m = RE_SUDO_SUCCESS.match(message)
        if m:
            return m.group(1), None, 'Sudo', 'Success'

    # ---- SU / PAM events ----
    if 'su' in service_lower or 'pam' in service_lower:

        m = RE_SESSION_OPENED.search(message)
        if m:
            return m.group(1), None, 'Authentication', 'Success'

        m = RE_SUDO_FAILURE.search(message)
        if m:
            return m.group(1), None, 'Authentication', 'Failed'

    return None, None, 'Other', 'Unknown'


def parse_file(file_path):
    """
    Read and parse a Linux auth log file.

    Args:
        file_path (str): Absolute path to the log file

    Returns:
        list[dict]: Parsed event objects
    """
    events = []

    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue

            match = SYSLOG_HEADER.match(line)
            if not match:
                # Line doesn't match standard syslog format — skip
                continue

            groups = match.groupdict()
            timestamp = parse_timestamp(
                groups['month'], groups['day'], groups['time']
            )
            service = groups.get('service', '')
            message = groups.get('message', '').strip()

            username, ip_address, event_type, status = classify_message(
                service, message
            )

            events.append({
                'timestamp': timestamp,
                'username': username,
                'ipAddress': ip_address,
                'eventType': event_type,
                'status': status,
                'rawLog': line,
            })

    return events


def build_stats(events):
    """Summarize event counts by status."""
    failed = sum(1 for e in events if e['status'] == 'Failed')
    successful = sum(1 for e in events if e['status'] == 'Success')
    unknown = sum(1 for e in events if e['status'] == 'Unknown')
    return {
        'total': len(events),
        'failed': failed,
        'successful': successful,
        'unknown': unknown,
    }


def main():
    parser = argparse.ArgumentParser(
        description='LogHawk Linux Auth Log Parser'
    )
    parser.add_argument(
        '--file', required=True,
        help='Path to the log file to parse'
    )
    parser.add_argument(
        '--output', default='json', choices=['json', 'text'],
        help='Output format (default: json)'
    )
    parser.add_argument(
        '--enabled-rules', default=None,
        help='JSON array of rule IDs that are enabled (e.g. ["brute_force","port_scan"]). '
             'If omitted, all detectors run.'
    )
    args = parser.parse_args()

    if not os.path.exists(args.file):
        result = {'status': 'error', 'error': f'File not found: {args.file}'}
        print(json.dumps(result))
        sys.exit(1)

    if os.path.getsize(args.file) == 0:
        result = {'status': 'error', 'error': 'File is empty'}
        print(json.dumps(result))
        sys.exit(1)

    try:
        # Add parent directory to sys.path to find detectors
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        
        events = parse_file(args.file)
        stats = build_stats(events)

        # Prepare entries in format expected by detectors
        detector_entries = []
        for ev in events:
            detector_entries.append({
                'raw': ev.get('rawLog', ''),
                'message': ev.get('rawLog', ''),
                'ip': ev.get('ipAddress', ''),
                'src_ip': ev.get('ipAddress', ''),
            })

        # Determine which rule IDs are enabled
        # Frontend rule IDs map to detector class names:
        import json as _json
        try:
            enabled_ids = _json.loads(args.enabled_rules) if args.enabled_rules else None
        except Exception:
            enabled_ids = None  # Malformed input: run everything

        # Map frontend rule IDs to (module, class) pairs
        RULE_MAP = {
            'brute_force':         ('detectors.brute_force_detector',          'BruteForceDetector'),
            'privilege_escalation': ('detectors.privilege_escalation_detector', 'PrivilegeEscalationDetector'),
            'reconnaissance':      ('detectors.reconnaissance_detector',        'ReconnaissanceDetector'),
            'suspicious_ip':       ('detectors.suspicious_ip_detector',         'SuspiciousIPDetector'),
            'port_scan':           ('detectors.portscan_detector',              'PortScanDetector'),
            'abnormal_login':      ('detectors.abnormal_login_detector',        'AbnormalLoginDetector'),
            'account_enum':        ('detectors.account_enumeration_detector',   'AccountEnumerationDetector'),
            'password_spray':      ('detectors.password_spray_detector',        'PasswordSprayDetector'),
        }

        # Import and execute threat detectors — all 8 signatures active
        import importlib
        detectors = []
        for rule_id, (module_path, class_name) in RULE_MAP.items():
            # Skip if the user has explicitly disabled this rule
            if enabled_ids is not None and rule_id not in enabled_ids:
                continue
            try:
                mod = importlib.import_module(module_path)
                cls = getattr(mod, class_name)
                detectors.append(cls())
            except Exception as import_err:
                sys.stderr.write(f'Could not load detector {class_name}: {str(import_err)}\n')

        threats = []
        for detector in detectors:
            try:
                det_threats = detector.detect(detector_entries)
                if det_threats:
                    threats.extend(det_threats)
            except Exception as det_err:
                sys.stderr.write(f"Detector error in {detector.__class__.__name__}: {str(det_err)}\n")

        result = {
            'status': 'success',
            'total': len(events),
            'events': events,
            'threats': threats,
            'stats': stats,
        }

        if args.output == 'json':
            print(json.dumps(result, default=str))
        else:
            print(f'LogHawk Linux Auth Parser')
            print(f'{"=" * 40}')
            print(f'File:        {args.file}')
            print(f'Total Lines: {len(events)}')
            print(f'Failed:      {stats["failed"]}')
            print(f'Successful:  {stats["successful"]}')
            print(f'Unknown:     {stats["unknown"]}')

    except Exception as e:
        result = {'status': 'error', 'error': str(e)}
        print(json.dumps(result))
        sys.exit(1)


if __name__ == '__main__':
    main()
