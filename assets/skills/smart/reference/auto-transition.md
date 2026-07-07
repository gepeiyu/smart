# Automatic Handoff to Next Phase Protocol

Canonical path: `smart/reference/auto-transition.md`

This protocol is shared by all smart sub-skills. It defines the automatic handoff rules after phase guard advancement.

## Terminology Distinction

"Phase advancement" is performed by guard `--apply`, which updates the `phase` field in `.smart.yaml` — this **always happens** and is independent of `auto_transition`. This protocol's "automatic handoff" only determines **whether to automatically invoke the next skill**, controlled by `auto_transition`.

## Execution

After exit conditions are met and the phase guard has advanced phase, run:

```bash
"$SMART_BASH" "$SMART_STATE" next <change-name>
```

The script outputs a deterministic next step based on `phase`, `workflow`, and `auto_transition`:

- `NEXT: auto` → invoke the skill pointed to by `SKILL` to enter the next phase
- `NEXT: manual` → do not invoke the next skill; prompt user to manually run `/<SKILL>` per `HINT`
- `NEXT: done` → workflow is complete, no further action needed

## Mode Routing

When `workflow: bugfix`, `phase: issue` or `phase: build` returns `smart-bugfix`; when `workflow: quick`, `phase: issue` or `phase: build` returns `smart-quick`. All other phases (`verify`, `archive`) return standard skill names (`smart-verify`, `smart-archive`) regardless of workflow type. The "continuous execution mode" within mode skills may override `auto_transition` behavior — see the corresponding mode's `<IMPORTANT>` block.
