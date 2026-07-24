# Review Toolchain

Run these tools before verifying AC items.

## Tools

1. **OCR Review**
   ```bash
   ocr review --from main --to <RESULT_REF> --format json
   ```
   OCR auto-detects changed files from the git range.

## Aggregation

- Run all tools, collect findings.
- Map findings to AC items where relevant.
- Include tool output in the verdict report.
