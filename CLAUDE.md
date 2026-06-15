# CLAUDE.md

## Code Review Graph (code-review-graph MCP)

This repo has a code knowledge graph. It is the primary tool for exploring and
reviewing this codebase — faster, cheaper, and more structurally aware than
Grep/Glob/Read.

### Always keep it fresh

- At the start of any session that touches code, run
  `build_or_update_graph_tool` (incremental — it only re-parses changed files)
  so the graph reflects the current tree before relying on it.
- After making edits, run `build_or_update_graph_tool` again to keep callers,
  callees, tests, and impact data accurate.
- Use `list_graph_stats_tool` to confirm the graph is current (check
  "last updated") if unsure.
- Do a `full_rebuild=true` only if the graph is empty/stale or a large
  refactor happened.

### Always use it when working in this repo

- **Exploring code**: `semantic_search_nodes_tool` / `query_graph_tool`
  (callers_of, callees_of, imports_of, tests_for, children_of) before Grep.
- **Impact / blast radius**: `get_impact_radius_tool`, `get_affected_flows_tool`.
- **Code review**: `detect_changes_tool` + `get_review_context_tool` instead of
  reading whole files.
- **Architecture**: `get_architecture_overview_tool`, `list_communities_tool`.
- **Start lean**: `get_minimal_context_tool` first (~100 tokens) to orient.

Fall back to Grep/Glob/Read only when the graph doesn't cover what you need.
