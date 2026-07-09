# File Structure Reference

Canonical path: `smart/reference/file-structure.md`

This file is the Smart project file structure reference. Consult on demand; not loaded inline with skills.

```text
openspec/                              # OpenSpec — WHAT
├── config.yaml
├── changes/
│   ├── <name>/                        # Active change
│   │   ├── .openspec.yaml
│   │   ├── proposal.md                # Why + What
│   │   ├── design.md                  # High-level architecture decisions
│   │   ├── specs/<capability>/spec.md # Delta capability spec
│   │   └── tasks.md                   # Task checklist
│   └── archive/YYYY-MM-DD-<name>/     # Archived
└── specs/<capability>/spec.md         # Main specs (merged on archive via OpenSpec delta semantics)

smartdocs/                             # Smart — STATE + EVIDENCE
└── changes/
    └── <name>/
        ├── .smart.yaml                # Smart workflow state
        └── handoff/                   # Script-generated phase handoff packages

docs/superpowers/                      # Superpowers — HOW
├── specs/YYYY-MM-DD-<topic>-design.md # Design doc (technical RFC; annotated on archive)
└── plans/YYYY-MM-DD-<feature>.md      # Implementation plan (file header contains change metadata)

.smart/
└── config.yaml                        # Smart project config (context_compression defaults to off; set to beta to enable)
```
