# Metrics

| Measure | Definition | Use |
|---|---|---|
| Calibration gaps | Failed Project 31 checks | Limits the plan to observed gaps |
| Weighted coverage | Unique risk points covered / all gap risk points | Evaluates plan breadth without double counting |
| Capacity use | Selected candidate effort / declared capacity | Keeps operating-model change feasible |
| Reversibility coverage | Selected experiments with explicit rollback / selected experiments | Must remain 100% by validation |
| Ownership coverage | Selected experiments with named owners / selected experiments | Must remain 100% by validation |
| Measurement coverage | Selected experiments with success, guardrail, and review definitions / selected experiments | Must remain 100% by validation |

The risk-point weights are transparent prioritization constants, not probabilities, loss estimates, or claims of causal impact. Teams should also track experiment completion, rollback use, review timeliness, and later Project 31 movement outside this engine.
