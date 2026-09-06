# Architecture and analytical contract

The browser posts a complete monitoring snapshot to an authenticated stateless Worker. The Worker invokes one pure analysis module and returns deterministic JSON.

Baseline observations establish a mean and sample standard deviation. The response includes a descriptive three-sigma band and EWMA with lambda 0.2. A control-limit signal means an observation differs strongly from the submitted baseline; it is not proof of a product effect.

Target persistence requires the latest three observations to meet the declared relative-change target in the beneficial direction. Reversal requires at least six post-decision observations, an early window meeting the target and a later window falling below it. Guardrails are explicit minimum or maximum thresholds.

The MVP intentionally uses complete-snapshot analysis. It neither stores proprietary data nor pretends to monitor continuously. Persistence, scheduled ingestion and notifications are later stages that require identity, tenant isolation and operational controls.
