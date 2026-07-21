# Project Guidelines & Rules: Top VNSport

## Code Review Graph MCP Tools

**IMPORTANT: This project has a structural knowledge graph. ALWAYS use the `code-review-graph` MCP tools BEFORE using standard Grep/Glob/Read tools (like `grep_search`, `view_file`, or `list_dir`) to explore the codebase.** The graph is faster, consumes significantly fewer tokens, and provides structural context (callers, dependents, test coverage) that file scanning cannot.

### Guidelines for Tool Usage:
1. **Exploring code / Finding symbols**: Use `semantic_search_nodes_tool` or `query_graph_tool` instead of `grep_search`.
2. **Understanding impact / Blast radius**: Use `get_impact_radius_tool` instead of manually tracing imports.
3. **Code review / Analyzing changes**: Use `detect_changes_tool` + `get_review_context_tool` instead of reading entire files.
4. **Finding relationships**: Use `query_graph_tool` with callers_of/callees_of/imports_of/tests_for.
5. **Architecture overview**: Use `get_architecture_overview_tool` + `list_communities_tool`.

*Only fall back to standard `grep_search`, `view_file`, or `list_dir` when the code-review-graph tools do not cover what you need.*
