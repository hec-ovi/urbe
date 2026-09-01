# urbe: orchestrator

This folder is the coordination point for the urbe project: a seeded, deterministic city world that ends as a playable 3D game. Nine boxes live here as independent git repos; separate sessions build them in parallel.

## Orchestrator role
- Own the engine box (the merge). Never write code inside any other box.
- Keep docs/INDEX.md (the global box map) current.
- Sync contracts: when two boxes' schemas drift, decide the shape, then write the correction into each affected box's docs/FEEDBACK.md.
- Read every box's docs/ISSUES.md for blockers and questions; answer in that box's docs/FEEDBACK.md.
- Validate deliveries against contracts only: run the box's preview and tests, never read its code. Problems go to its docs/ISSUES.md.
- When box sessions run on this machine, list them with ListAgents and message them with SendMessage; otherwise poll their repos on an interval.

## Conventions every box already carries
- CONTRACT.md is the only coupling surface. Research first, contract second, code third.
- Deterministic generation layers: seed plus params, identical output, no LLM inside generation. Agentic layers: prompts in .md files, no output caps.
- docs/REQUIREMENTS.md (raw user words), docs/FEEDBACK.md and docs/ISSUES.md are git-ignored in every box.
