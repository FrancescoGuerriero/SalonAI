# Consultation definition runtime convergence

Issue: #307

This increment makes the WhatsApp consultation runtime resolve deterministic assessment through the canonical consultation definition registry rather than importing the Hair Colour evaluator directly.

## Active definition

Only `hair-colour-chemical` version `1` remains active. This change does not activate another vertical or consultation type.

## Runtime contract

- WhatsApp assessment resolves `consultationType` + `definitionVersion` through `consultationDefinitionRegistry.js`.
- Unknown consultation types fail closed with `CONSULTATION_DEFINITION_NOT_ACTIVE`.
- Unsupported definition versions fail closed with the same governed error.
- Newly created WhatsApp consultation sessions take their type/version from the active registered definition.
- Existing deterministic Hair Colour question ordering and human-review handoff behaviour are preserved.

## Safety boundary

This is an architectural convergence only. It does not materialise production training data, activate ML inference, promote a model, bypass deterministic safety rules, add a second booking/customer authority, or perform a production mutation.

## Remaining convergence

`consultationSessionService.js` still contains direct Hair Colour feature/evaluator coupling. That service should be migrated separately to definition-scoped feature sanitisation and deterministic evaluation so the generic session CRUD path and WhatsApp path share the same registry contract without widening the current active product scope.
