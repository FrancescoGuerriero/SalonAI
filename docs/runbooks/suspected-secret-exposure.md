# Runbook: suspected secret exposure

1. Assume the credential is compromised.
2. Revoke or rotate it at the provider.
3. Identify where it was committed, copied, logged, or packaged.
4. Remove it from the working tree and Git history where applicable.
5. Update the private production environment file with the replacement value.
6. Restart only the services that consume the credential.
7. Review provider audit logs for misuse.
8. Run the Phase 7.11 repository scan and production secret audit.
9. Record the incident timeline, affected systems, rotation evidence, and follow-up controls.

Never paste the exposed value into tickets, chat messages, screenshots, or security reports.
