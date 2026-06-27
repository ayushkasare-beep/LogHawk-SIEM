"""
====================================
LogHawk – Log Parser
====================================
parsers/log_parser.py

Multi-format log parser supporting Linux auth logs,
Apache/Nginx access logs, Windows event logs, and firewall logs.
Uses regex-based pattern matching for field extraction.
"""

import re
from datetime import datetime
from dateutil import parser as date_parser


class LogParser:
    """
    Universal log parser that detects log format and extracts
    structured fields from raw log lines.
    """

    # Regex patterns for different log types
    PATTERNS = {
        'linux_auth': re.compile(
            r'(?P<timestamp>\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+'
            r'(?P<hostname>\S+)\s+'
            r'(?P<service>\S+?)(?:\[(?P<pid>\d+)\])?:\s+'
            r'(?P<message>.*)'
        ),
        'apache': re.compile(
            r'(?P<ip>\d+\.\d+\.\d+\.\d+)\s+-\s+'
            r'(?P<user>\S+)\s+'
            r'\[(?P<timestamp>[^\]]+)\]\s+'
            r'"(?P<method>\w+)\s+(?P<path>\S+)\s+(?P<protocol>\S+)"\s+'
            r'(?P<status>\d{3})\s+'
            r'(?P<size>\d+|-)'
        ),
        'nginx': re.compile(
            r'(?P<ip>\d+\.\d+\.\d+\.\d+)\s+-\s+'
            r'(?P<user>\S+)\s+'
            r'\[(?P<timestamp>[^\]]+)\]\s+'
            r'"(?P<method>\w+)\s+(?P<path>\S+)\s+(?P<protocol>\S+)"\s+'
            r'(?P<status>\d{3})\s+'
            r'(?P<size>\d+)'
        ),
        'firewall': re.compile(
            r'(?P<timestamp>\S+\s+\S+)\s+'
            r'(?P<action>\w+)\s+'
            r'(?P<protocol>\w+)\s+'
            r'(?P<src_ip>\d+\.\d+\.\d+\.\d+):(?P<src_port>\d+)\s*->\s*'
            r'(?P<dst_ip>\d+\.\d+\.\d+\.\d+):(?P<dst_port>\d+)'
        ),
    }

    def parse(self, file_path, log_type):
        """
        Parse a log file and return structured entries.

        Args:
            file_path (str): Path to the log file
            log_type (str): Type of log (linux_auth, apache, nginx, firewall)

        Returns:
            list[dict]: List of parsed log entries
        """
        entries = []

        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                for line_num, line in enumerate(f, 1):
                    line = line.strip()
                    if not line:
                        continue

                    entry = self._parse_line(line, log_type, line_num)
                    if entry:
                        entries.append(entry)
        except Exception as e:
            return [{'error': str(e), 'line': 0}]

        return entries

    def _parse_line(self, line, log_type, line_num):
        """Parse a single log line based on its type."""
        pattern = self.PATTERNS.get(log_type)

        if not pattern:
            # Fallback: return raw line as entry
            return {
                'line_number': line_num,
                'raw': line,
                'source': log_type,
                'parsed': False,
            }

        match = pattern.match(line)
        if not match:
            return {
                'line_number': line_num,
                'raw': line,
                'source': log_type,
                'parsed': False,
            }

        entry = match.groupdict()
        entry['line_number'] = line_num
        entry['raw'] = line
        entry['source'] = log_type
        entry['parsed'] = True

        # Normalize timestamp
        if 'timestamp' in entry:
            try:
                entry['timestamp'] = str(date_parser.parse(entry['timestamp']))
            except (ValueError, TypeError):
                pass

        return entry
