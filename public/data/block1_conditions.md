# Block Conditions — Transfer Design

## Core logic

The **target category is always {ABCD}** (roles eA, eB, eC, eD).

- **Source machine (M1):** establishes whether {ABCD} is the machine's positive set (PP/PN) or negative set (NP/NN).
- **Mediator machine (M2):** provides individual-element evidence that equates the prior for eC to exactly 50% — always the opposite of M1's behavior on eC.
- **Target machine (M3):** training observations establish its category rule; prediction on eC is where the condition matters.

| Condition | M1 on {ABCD} | M3 on {ABCD} | M2 on eC | Prior for eC (before prediction) | Prediction answer |
|-----------|:------------:|:------------:|:--------:|:---------------------------------:|:-----------------:|
| **PP** | + (accepts) | + (accepts) | r | 1a (M1) : 1r (M2) = **50%** | **active** |
| **PN** | + (accepts) | − (rejects) | r | 1a (M1) : 1r (M2) = **50%** | **idle** |
| **NP** | − (rejects) | + (accepts) | a | 1r (M1) : 1a (M2) = **50%** | **active** |
| **NN** | − (rejects) | − (rejects) | a | 1r (M1) : 1a (M2) = **50%** | **idle** |

Base rate per machine is always **50%** (equal accepts and rejects observed).

---

## What changes across conditions

| Machine | Component | PP | PN | NP | NN |
|---------|-----------|:--:|:--:|:--:|:--:|
| M1 | eA,eB,eC,eD | a | a | **r** | **r** |
| M1 | eE,eF,eG,eH | r | r | **a** | **a** |
| M1 | AC: eA | a | a | **r** | **r** |
| M1 | AC: eD | a | a | **r** | **r** |
| M1 | AC: eG | r | r | **a** | **a** |
| M2 | eN | a | a | **r** | **r** |
| M2 | eC | r | r | **a** | **a** |
| M3 | eA,eB,eD (training) | a | **r** | a | **r** |
| M3 | eI,eJ,eK (training) | r | **a** | r | **a** |
| M3 | AC: eA | a | **r** | a | **r** |
| M3 | AC: eJ | r | **a** | r | **a** |
| M3 | Prediction eC | **a** | **r** | **a** | **r** |

---

## Full trial sequence — all four conditions

| # | Type | Slot | Role | PP | PN | NP | NN |
|---|------|------|------|:--:|:--:|:--:|:--:|
| 1 | Obs | m1 | eA | a | a | r | r |
| 2 | Obs | m1 | eB | a | a | r | r |
| — | AC | m1 | eA | a | a | r | r |
| 3 | Obs | m1 | eC | a | a | r | r |
| 4 | Obs | m1 | eD | a | a | r | r |
| 5 | Obs | m1 | eE | r | r | a | a |
| — | AC | m1 | eD | a | a | r | r |
| 6 | Obs | m1 | eF | r | r | a | a |
| 7 | Obs | m1 | eG | r | r | a | a |
| 8 | Obs | m1 | eH | r | r | a | a |
| 9 | Obs | m2 | eM | a | a | a | a |
| — | AC | m1 | eG | r | r | a | a |
| 10 | Obs | m2 | eN | a | a | r | r |
| 11 | Obs | m2 | eO | r | r | r | r |
| — | AC | m2 | eM | a | a | a | a |
| 12 | Obs | m2 | eC | r | r | a | a |
| 13 | Obs | m3 | eA | a | r | a | r |
| 14 | Obs | m3 | eB | a | r | a | r |
| 15 | Obs | m3 | eD | a | r | a | r |
| — | AC | m3 | eA | a | r | a | r |
| 16 | Obs | m3 | eI | r | a | r | a |
| 17 | Obs | m3 | eJ | r | a | r | a |
| — | AC | m3 | eJ | r | a | r | a |
| 18 | Obs | m3 | eK | r | a | r | a |
| P | Pred | m3 | eC | **a** | **r** | **a** | **r** |

---

## Interpretation

| Condition | Source→Target transfer | Rational-transfer prediction | Prediction answer |
|-----------|------------------------|------------------------------|:-----------------:|
| PP | M1+ → M3+ | active (eC in M1's positive set → should also work for M3) | active ✓ |
| PN | M1+ → M3− | active (eC in M1's positive set → but M3 rejects it) | idle ✗ |
| NP | M1− → M3+ | idle (eC not in M1's positive set → but M3 accepts it) | active ✗ |
| NN | M1− → M3− | idle (eC not in M1's positive set → M3 also rejects it) | idle ✓ |

PP and NN are "congruent" (transfer rule matches); PN and NP are "incongruent."

---

## JSON blocks

### Block 1 — PP (positive source, positive target)

M1 accepts {ABCD}, M3 accepts {ABCD}.

```json
{
  "trials": [
    { "type": "observation",    "machineSlot": "m1", "elementRole": "eA", "state": "a", "title": "Observation 1" },
    { "type": "observation",    "machineSlot": "m1", "elementRole": "eB", "state": "a", "title": "Observation 2" },
    { "type": "attentionCheck", "machineSlot": "m1", "elementRole": "eA", "state": "a", "title": "Attention Check 1" },
    { "type": "observation",    "machineSlot": "m1", "elementRole": "eC", "state": "a", "title": "Observation 3" },
    { "type": "observation",    "machineSlot": "m1", "elementRole": "eD", "state": "a", "title": "Observation 4" },
    { "type": "observation",    "machineSlot": "m1", "elementRole": "eE", "state": "r", "title": "Observation 5" },
    { "type": "attentionCheck", "machineSlot": "m1", "elementRole": "eD", "state": "a", "title": "Attention Check 2" },
    { "type": "observation",    "machineSlot": "m1", "elementRole": "eF", "state": "r", "title": "Observation 6" },
    { "type": "observation",    "machineSlot": "m1", "elementRole": "eG", "state": "r", "title": "Observation 7" },
    { "type": "observation",    "machineSlot": "m1", "elementRole": "eH", "state": "r", "title": "Observation 8" },

    { "type": "observation",    "machineSlot": "m2", "elementRole": "eM", "state": "a", "title": "Observation 9" },
    { "type": "attentionCheck", "machineSlot": "m1", "elementRole": "eG", "state": "r", "title": "Attention Check 3" },
    { "type": "observation",    "machineSlot": "m2", "elementRole": "eN", "state": "a", "title": "Observation 10" },
    { "type": "observation",    "machineSlot": "m2", "elementRole": "eO", "state": "r", "title": "Observation 11" },
    { "type": "attentionCheck", "machineSlot": "m2", "elementRole": "eM", "state": "a", "title": "Attention Check 4" },
    { "type": "observation",    "machineSlot": "m2", "elementRole": "eC", "state": "r", "title": "Observation 12" },

    { "type": "observation",    "machineSlot": "m3", "elementRole": "eA", "state": "a", "title": "Observation 13" },
    { "type": "observation",    "machineSlot": "m3", "elementRole": "eB", "state": "a", "title": "Observation 14" },
    { "type": "observation",    "machineSlot": "m3", "elementRole": "eD", "state": "a", "title": "Observation 15" },
    { "type": "attentionCheck", "machineSlot": "m3", "elementRole": "eA", "state": "a", "title": "Attention Check 5" },
    { "type": "observation",    "machineSlot": "m3", "elementRole": "eI", "state": "r", "title": "Observation 16" },
    { "type": "observation",    "machineSlot": "m3", "elementRole": "eJ", "state": "r", "title": "Observation 17" },
    { "type": "attentionCheck", "machineSlot": "m3", "elementRole": "eJ", "state": "r", "title": "Attention Check 6" },
    { "type": "observation",    "machineSlot": "m3", "elementRole": "eK", "state": "r", "title": "Observation 18" },
    { "type": "prediction",     "machineSlot": "m3", "elementRole": "eC", "state": "a", "title": "Prediction 1" }
  ]
}
```

### Block 2 — PN (positive source, negative target)

M1 accepts {ABCD}, M3 rejects {ABCD}. Only M3 observations and ACs change vs PP.

```json
{
  "trials": [
    { "type": "observation",    "machineSlot": "m1", "elementRole": "eA", "state": "a", "title": "Observation 1" },
    { "type": "observation",    "machineSlot": "m1", "elementRole": "eB", "state": "a", "title": "Observation 2" },
    { "type": "attentionCheck", "machineSlot": "m1", "elementRole": "eA", "state": "a", "title": "Attention Check 1" },
    { "type": "observation",    "machineSlot": "m1", "elementRole": "eC", "state": "a", "title": "Observation 3" },
    { "type": "observation",    "machineSlot": "m1", "elementRole": "eD", "state": "a", "title": "Observation 4" },
    { "type": "observation",    "machineSlot": "m1", "elementRole": "eE", "state": "r", "title": "Observation 5" },
    { "type": "attentionCheck", "machineSlot": "m1", "elementRole": "eD", "state": "a", "title": "Attention Check 2" },
    { "type": "observation",    "machineSlot": "m1", "elementRole": "eF", "state": "r", "title": "Observation 6" },
    { "type": "observation",    "machineSlot": "m1", "elementRole": "eG", "state": "r", "title": "Observation 7" },
    { "type": "observation",    "machineSlot": "m1", "elementRole": "eH", "state": "r", "title": "Observation 8" },

    { "type": "observation",    "machineSlot": "m2", "elementRole": "eM", "state": "a", "title": "Observation 9" },
    { "type": "attentionCheck", "machineSlot": "m1", "elementRole": "eG", "state": "r", "title": "Attention Check 3" },
    { "type": "observation",    "machineSlot": "m2", "elementRole": "eN", "state": "a", "title": "Observation 10" },
    { "type": "observation",    "machineSlot": "m2", "elementRole": "eO", "state": "r", "title": "Observation 11" },
    { "type": "attentionCheck", "machineSlot": "m2", "elementRole": "eM", "state": "a", "title": "Attention Check 4" },
    { "type": "observation",    "machineSlot": "m2", "elementRole": "eC", "state": "r", "title": "Observation 12" },

    { "type": "observation",    "machineSlot": "m3", "elementRole": "eA", "state": "r", "title": "Observation 13" },
    { "type": "observation",    "machineSlot": "m3", "elementRole": "eB", "state": "r", "title": "Observation 14" },
    { "type": "observation",    "machineSlot": "m3", "elementRole": "eD", "state": "r", "title": "Observation 15" },
    { "type": "attentionCheck", "machineSlot": "m3", "elementRole": "eA", "state": "r", "title": "Attention Check 5" },
    { "type": "observation",    "machineSlot": "m3", "elementRole": "eI", "state": "a", "title": "Observation 16" },
    { "type": "observation",    "machineSlot": "m3", "elementRole": "eJ", "state": "a", "title": "Observation 17" },
    { "type": "attentionCheck", "machineSlot": "m3", "elementRole": "eJ", "state": "a", "title": "Attention Check 6" },
    { "type": "observation",    "machineSlot": "m3", "elementRole": "eK", "state": "a", "title": "Observation 18" },
    { "type": "prediction",     "machineSlot": "m3", "elementRole": "eC", "state": "r", "title": "Prediction 1" }
  ]
}
```

### Block 3 — NP (negative source, positive target)

M1 rejects {ABCD} (accepts {EFGH}), M3 accepts {ABCD}. M1 and M2 change vs PP; M3 same as PP.

```json
{
  "trials": [
    { "type": "observation",    "machineSlot": "m1", "elementRole": "eA", "state": "r", "title": "Observation 1" },
    { "type": "observation",    "machineSlot": "m1", "elementRole": "eB", "state": "r", "title": "Observation 2" },
    { "type": "attentionCheck", "machineSlot": "m1", "elementRole": "eA", "state": "r", "title": "Attention Check 1" },
    { "type": "observation",    "machineSlot": "m1", "elementRole": "eC", "state": "r", "title": "Observation 3" },
    { "type": "observation",    "machineSlot": "m1", "elementRole": "eD", "state": "r", "title": "Observation 4" },
    { "type": "observation",    "machineSlot": "m1", "elementRole": "eE", "state": "a", "title": "Observation 5" },
    { "type": "attentionCheck", "machineSlot": "m1", "elementRole": "eD", "state": "r", "title": "Attention Check 2" },
    { "type": "observation",    "machineSlot": "m1", "elementRole": "eF", "state": "a", "title": "Observation 6" },
    { "type": "observation",    "machineSlot": "m1", "elementRole": "eG", "state": "a", "title": "Observation 7" },
    { "type": "observation",    "machineSlot": "m1", "elementRole": "eH", "state": "a", "title": "Observation 8" },

    { "type": "observation",    "machineSlot": "m2", "elementRole": "eM", "state": "a", "title": "Observation 9" },
    { "type": "attentionCheck", "machineSlot": "m1", "elementRole": "eG", "state": "a", "title": "Attention Check 3" },
    { "type": "observation",    "machineSlot": "m2", "elementRole": "eN", "state": "r", "title": "Observation 10" },
    { "type": "observation",    "machineSlot": "m2", "elementRole": "eO", "state": "r", "title": "Observation 11" },
    { "type": "attentionCheck", "machineSlot": "m2", "elementRole": "eM", "state": "a", "title": "Attention Check 4" },
    { "type": "observation",    "machineSlot": "m2", "elementRole": "eC", "state": "a", "title": "Observation 12" },

    { "type": "observation",    "machineSlot": "m3", "elementRole": "eA", "state": "a", "title": "Observation 13" },
    { "type": "observation",    "machineSlot": "m3", "elementRole": "eB", "state": "a", "title": "Observation 14" },
    { "type": "observation",    "machineSlot": "m3", "elementRole": "eD", "state": "a", "title": "Observation 15" },
    { "type": "attentionCheck", "machineSlot": "m3", "elementRole": "eA", "state": "a", "title": "Attention Check 5" },
    { "type": "observation",    "machineSlot": "m3", "elementRole": "eI", "state": "r", "title": "Observation 16" },
    { "type": "observation",    "machineSlot": "m3", "elementRole": "eJ", "state": "r", "title": "Observation 17" },
    { "type": "attentionCheck", "machineSlot": "m3", "elementRole": "eJ", "state": "r", "title": "Attention Check 6" },
    { "type": "observation",    "machineSlot": "m3", "elementRole": "eK", "state": "r", "title": "Observation 18" },
    { "type": "prediction",     "machineSlot": "m3", "elementRole": "eC", "state": "a", "title": "Prediction 1" }
  ]
}
```

### Block 4 — NN (negative source, negative target)

M1 rejects {ABCD}, M3 rejects {ABCD}. Both M1/M2 change (as NP) and M3 changes (as PN).

```json
{
  "trials": [
    { "type": "observation",    "machineSlot": "m1", "elementRole": "eA", "state": "r", "title": "Observation 1" },
    { "type": "observation",    "machineSlot": "m1", "elementRole": "eB", "state": "r", "title": "Observation 2" },
    { "type": "attentionCheck", "machineSlot": "m1", "elementRole": "eA", "state": "r", "title": "Attention Check 1" },
    { "type": "observation",    "machineSlot": "m1", "elementRole": "eC", "state": "r", "title": "Observation 3" },
    { "type": "observation",    "machineSlot": "m1", "elementRole": "eD", "state": "r", "title": "Observation 4" },
    { "type": "observation",    "machineSlot": "m1", "elementRole": "eE", "state": "a", "title": "Observation 5" },
    { "type": "attentionCheck", "machineSlot": "m1", "elementRole": "eD", "state": "r", "title": "Attention Check 2" },
    { "type": "observation",    "machineSlot": "m1", "elementRole": "eF", "state": "a", "title": "Observation 6" },
    { "type": "observation",    "machineSlot": "m1", "elementRole": "eG", "state": "a", "title": "Observation 7" },
    { "type": "observation",    "machineSlot": "m1", "elementRole": "eH", "state": "a", "title": "Observation 8" },

    { "type": "observation",    "machineSlot": "m2", "elementRole": "eM", "state": "a", "title": "Observation 9" },
    { "type": "attentionCheck", "machineSlot": "m1", "elementRole": "eG", "state": "a", "title": "Attention Check 3" },
    { "type": "observation",    "machineSlot": "m2", "elementRole": "eN", "state": "r", "title": "Observation 10" },
    { "type": "observation",    "machineSlot": "m2", "elementRole": "eO", "state": "r", "title": "Observation 11" },
    { "type": "attentionCheck", "machineSlot": "m2", "elementRole": "eM", "state": "a", "title": "Attention Check 4" },
    { "type": "observation",    "machineSlot": "m2", "elementRole": "eC", "state": "a", "title": "Observation 12" },

    { "type": "observation",    "machineSlot": "m3", "elementRole": "eA", "state": "r", "title": "Observation 13" },
    { "type": "observation",    "machineSlot": "m3", "elementRole": "eB", "state": "r", "title": "Observation 14" },
    { "type": "observation",    "machineSlot": "m3", "elementRole": "eD", "state": "r", "title": "Observation 15" },
    { "type": "attentionCheck", "machineSlot": "m3", "elementRole": "eA", "state": "r", "title": "Attention Check 5" },
    { "type": "observation",    "machineSlot": "m3", "elementRole": "eI", "state": "a", "title": "Observation 16" },
    { "type": "observation",    "machineSlot": "m3", "elementRole": "eJ", "state": "a", "title": "Observation 17" },
    { "type": "attentionCheck", "machineSlot": "m3", "elementRole": "eJ", "state": "a", "title": "Attention Check 6" },
    { "type": "observation",    "machineSlot": "m3", "elementRole": "eK", "state": "a", "title": "Observation 18" },
    { "type": "prediction",     "machineSlot": "m3", "elementRole": "eC", "state": "r", "title": "Prediction 1" }
  ]
}
```
