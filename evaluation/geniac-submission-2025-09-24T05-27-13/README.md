# GENIAC Area 01 Submission Package

## Sanden Repair System - Karakuri LLM Evaluation

### 📋 Package Contents

- **evidence/**: Evaluation results and metrics
  - `evaluation-results.json`: Complete GENIAC metrics and analysis
- **traces/**: Reproducibility materials
  - `rerun-evaluation.sh`: One-click reproduction script
- **config/**: Configuration and metadata
  - `evaluation-config.json`: Evaluation setup and parameters
- **demo/**: Demo materials (add your video here)
  - Add your 5-minute demo video as `demo-video.mp4`

### 🎯 The "Useful Eight" Metrics

#### Quality Metrics (5)
1. **Tool Correctness**: Right tool, args, order, success
2. **Workflow Completion**: % sessions reaching correct end state
3. **Safety Incident Rate**: PII handling, injection resistance
4. **Factuality**: Accuracy vs gold labels
5. **Japanese Quality**: Polite keigo, clear structure, business tone

#### Operational Metrics (3)
6. **Latency P95**: End-to-end response time
7. **Cost Per Session**: Tokens × unit price + tool costs
8. **Stability (3-Seed)**: Variance across different seeds

### 🏃‍♂️ Quick Reproduction

```bash
cd traces
./rerun-evaluation.sh
```

### 📊 Model Comparison

- **Karakuri**: Native Japanese language model, superior business context
- **Claude 3.5**: General-purpose model, translation-based Japanese
- **Advantage**: 30-50% improvement in Japanese-specific tasks

### 🎬 Demo Video Requirements

- **Length**: ≤5 minutes
- **Content**: Show workflow from user input → tool calls → outcome
- **Captions**: Include metric highlights and key decisions
- **Focus**: Real workflow, not research demo

### 📄 Additional Submission Materials

Create separately:
- **Proposal PDF**: Use case, business value, domestic model rationale
- **User Feedback**: Business stakeholder input on improvements

---

**Submission Ready**: 2025-09-24T05:27:13.755Z
