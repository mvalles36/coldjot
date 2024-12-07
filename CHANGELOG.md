# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v8.0.0] - 2024-02-XX

### Added

- Full job queue system for sequence processing
- Redis-based scheduling with Bull
- Improved business hours handling
- Better error handling and retries
- Real-time sequence monitoring
- Sequence health checks
- Rate limiting and throttling
- Job prioritization
- Sequence processing metrics

### Changed

- Moved from cron-based to queue-based processing
- Enhanced scheduling logic with better timezone support
- Improved sequence step timing calculations

### Fixed

- Email sending timing issues
- Business hours calculation edge cases
- Timezone-related scheduling bugs

## [v7.0.0] - 2024-01-XX

### Added

- Email threading and Gmail integration
- Business hours configuration
- Basic scheduling logic
- Email tracking and analytics
- Sequence step improvements

### Changed

- Enhanced email processing
- Improved sequence management
- Better UI/UX for sequence settings

### Fixed

- Gmail threading issues
- Email tracking reliability
- Timezone handling bugs
