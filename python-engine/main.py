"""
====================================
LogHawk – Python Security Analysis Engine
====================================
main.py

Entry point for the log analysis pipeline.
Accepts log files via CLI arguments, parses them,
runs threat detection, and outputs results as JSON.

Usage:
    python main.py --file <path> --type <log_type> --output json

Supported log types:
    - linux_auth   : /var/log/auth.log
    - windows_event: Windows Security Event Log (exported)
    - apache       : Apache access/error logs
    - nginx        : Nginx access/error logs
    - firewall     : Firewall connection logs
"""

import argparse
import json
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from parsers.log_parser import LogParser
from detectors.brute_force_detector import BruteForceDetector
from detectors.privilege_escalation_detector import PrivilegeEscalationDetector
from detectors.reconnaissance_detector import ReconnaissanceDetector
from detectors.suspicious_ip_detector import SuspiciousIPDetector
from detectors.portscan_detector import PortScanDetector
from detectors.password_spray_detector import PasswordSprayDetector
from detectors.account_enumeration_detector import AccountEnumerationDetector
from detectors.abnormal_login_detector import AbnormalLoginDetector


def main():
    parser = argparse.ArgumentParser(description='LogHawk Security Log Analyzer')
    parser.add_argument('--file', required=True, help='Path to the log file')
    parser.add_argument('--type', required=True,
                        choices=['linux_auth', 'windows_event', 'apache', 'nginx', 'firewall'],
                        help='Type of log file')
    parser.add_argument('--output', default='json', choices=['json', 'text'],
                        help='Output format')
    args = parser.parse_args()

    # Validate file exists
    if not os.path.exists(args.file):
        print(json.dumps({'error': f'File not found: {args.file}'}))
        sys.exit(1)

    # Step 1: Parse the log file
    log_parser = LogParser()
    parsed_entries = log_parser.parse(args.file, args.type)

    # Step 2: Run all detectors
    detectors = [
        BruteForceDetector(),
        PasswordSprayDetector(),
        AccountEnumerationDetector(),
        AbnormalLoginDetector(),
        PrivilegeEscalationDetector(),
        ReconnaissanceDetector(),
        SuspiciousIPDetector(),
        PortScanDetector(),
    ]

    all_threats = []
    for detector in detectors:
        threats = detector.detect(parsed_entries)
        all_threats.extend(threats)

    # Step 3: Build results
    results = {
        'status': 'success',
        'file': args.file,
        'log_type': args.type,
        'total_entries': len(parsed_entries),
        'entries': parsed_entries[:100],  # Limit to first 100 for API response
        'threats': all_threats,
        'summary': {
            'total_threats': len(all_threats),
            'critical': len([t for t in all_threats if t.get('severity') == 'critical']),
            'high': len([t for t in all_threats if t.get('severity') == 'high']),
            'medium': len([t for t in all_threats if t.get('severity') == 'medium']),
            'low': len([t for t in all_threats if t.get('severity') == 'low']),
        },
    }

    # Output
    if args.output == 'json':
        print(json.dumps(results, indent=2, default=str))
    else:
        print(f"LogHawk Analysis Report")
        print(f"{'='*40}")
        print(f"File: {args.file}")
        print(f"Type: {args.type}")
        print(f"Total Entries: {len(parsed_entries)}")
        print(f"Threats Found: {len(all_threats)}")


if __name__ == '__main__':
    main()
