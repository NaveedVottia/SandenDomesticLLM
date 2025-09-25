# GENIAC Evaluation Suite

This folder contains the complete GENIAC Area 01 evaluation framework and results for the Sanden Repair System.

## 📁 Contents

### Core Evaluation Framework
- `geniac-evaluation-framework.js` - Main evaluation engine with Claude and Karakuri model testing
- `run-geniac-evaluation.js` - Command-line script to run evaluations
- `create-geniac-package.js` - Package creation for GENIAC submission

### Test Data & Evidence
- `DATA/` - Test datasets and evaluation rubrics
- `evidence/` - Raw evaluation results and scores
- `traces/` - Execution traces and reproducibility scripts

### Reports & Analysis
- `GENIAC-NOTION-REPORT.md` - Main evaluation report with real Claude data
- `GENIAC-FINAL-SUBMISSION.md` - Submission documentation
- Various result files and analysis

### Test Files
- `test-*` - Various test scripts for different components
- Integration tests for Claude, Karakuri, and evaluation framework

### Charts & Visualizations
- `evaluation-chart-*` - Generated performance charts
- SVG files with radar charts and bar graphs

## 🚀 Usage

```bash
# Run full evaluation with real Claude data
node evaluation/run-geniac-evaluation.js claude

# Create submission package
node evaluation/create-geniac-package.js

# Check results
cat evaluation/GENIAC-NOTION-REPORT.md
```

## 📊 Key Results

**Claude 3.5 Sonnet (Real AWS Bedrock Data):**
- Tool Correctness: 60%
- Workflow Completion: 20% (600% improvement from baseline)
- Safety: 0.20 incidents/test
- Factuality: 1.87 errors/test (28% improvement)
- Japanese Quality: 5.00/5.0 (Perfect)

## 🔧 Claude Improvements Applied

The evaluation demonstrates significant improvements through enhanced prompting:
- Added explicit workflow orchestration steps
- Embedded accurate business context and warranty information
- Improved state management instructions
- Better tool call formatting guidance

## 📦 Submission Package

Final submission package: `geniac-final-improved-claude.zip`

Ready for GENIAC Area 01 submission with complete evidence, traces, and reproducibility.
