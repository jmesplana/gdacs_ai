# Immunization planning

First-party module for coverage analysis, session planning and resource estimates.
Entry point: index.js. Metadata: manifest.json.

This module currently uses platform-provided helpers in lib/planning, its import
worker in workers, and shared styles in components/platform. Its source archive
therefore targets this platform repository; it is not a standalone application.

Validate with `npm run app:validate -- components/apps/immunization`.
