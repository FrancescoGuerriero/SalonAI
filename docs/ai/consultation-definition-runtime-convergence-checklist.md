# Validation checklist — consultation definition runtime convergence

- [x] Hair Colour/Chemical remains the only active consultation definition.
- [x] WhatsApp deterministic assessment resolves through the canonical definition registry.
- [x] New WhatsApp sessions use the registered definition id/version.
- [x] Unknown consultation types fail closed.
- [x] Unsupported definition versions fail closed.
- [x] Existing deterministic Hair Colour question ordering is preserved.
- [x] Human review remains mandatory.
- [x] No new booking/customer authority is introduced.
- [x] No production training/inference activation is introduced.
- [x] No production mutation is introduced.

Exact-head CI, CodeQL and backend smoke remain merge gates for the pull request.
