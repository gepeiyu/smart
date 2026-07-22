---
name: smart-quick
description: "Smart certified quick route for small, low-risk changes with explicit verification."
---

# Smart Quick Route

Read `smart/reference/workflow-runtime.md`. Use this route only for small copy, documentation,
prompt, or configuration value changes with no architecture or cross-module coordination:

```bash
smart run init <change-name> --workflow official/quick --route quick
```

Dispatch the resolved `currentStage`. The official quick preset omits design but still requires
requirements, build evidence, verification, and archive. Small does not mean untested.

Upgrade when the change affects multiple modules, adds/removes configuration structure, changes an
API or schema, needs significant new tests, or requires a specification/design decision. Explain the
reason, wait for approval, then run:

```bash
smart run switch <change-name> official/full --confirmed
```

Custom workflows control their own stages and must not inherit quick-route shortcuts implicitly.
