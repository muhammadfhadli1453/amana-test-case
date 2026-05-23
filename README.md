# BD Proposal Checking Agent

AI-powered proposal review system for Business Development teams.

This project was built for the AI Engineer case study from AMANA Solutions.

## Demo

- Demo Video: https://youtu.be/fm2ymD8AxAU
- Document sample: https://drive.google.com/drive/folders/1Cy-PqZ_nZKJyaETV1W0sNVoOHDwj5N5r?usp=sharing

## Features

- Upload proposal documents in:
  - PDF
  - DOCX
  - TXT / Markdown
  - Google Docs URL
- Upload TOR / Client Brief
- AI-powered proposal analysis
- Structured JSON review output
- Completeness checklist
- Requirement matching against TOR/RFP
- Commercial risk analysis
- Key gap detection
- Readiness scoring
- Citations & references
- Multi-provider LLM support:
  - Anthropic Claude
  - OpenAI
  - Google Gemini
  - OpenRouter
  - Ollama
  - vLLM

---

# Tech Stack

## Frontend
- React
- JavaScript
- Inline CSS

## AI / LLM
- Anthropic API
- OpenAI API
- Gemini API
- OpenRouter
- Ollama
- vLLM

## Document Processing
- Mammoth.js (DOCX extraction)
- Native PDF handling
- Google Docs text export

---

# System Architecture

The architecture is designed as a lightweight AI Agent workflow:

```text
User Input
    │
    ├── Proposal Document
    └── TOR / Client Brief
            │
            ▼
Document Extraction Layer
    ├── PDF Handler
    ├── DOCX Parser
    ├── Google Docs Fetcher
    └── Text Reader
            │
            ▼
Preprocessing Layer
    ├── Normalize text
    ├── Build prompts
    └── Attach citations context
            │
            ▼
LLM Analysis Engine
    ├── Proposal understanding
    ├── Requirement matching
    ├── Risk detection
    ├── Gap analysis
    └── Recommendation generation
            │
            ▼
Structured JSON Output
            │
            ▼
Frontend Review Dashboard
```

---

# Agentic Workflow

The proposal checking workflow consists of several logical agents:

## 1. Document Ingestion Agent
Responsible for:
- Reading PDF/DOCX/TXT files
- Reading Google Docs
- Converting documents into raw text

## 2. Proposal Understanding Agent
Responsible for:
- Extracting proposal summary
- Identifying sections
- Understanding scope and objectives

## 3. TOR Matching Agent
Responsible for:
- Comparing proposal against client requirements
- Detecting matched / partial / missing requirements

## 4. Risk Analysis Agent
Responsible for:
- Detecting commercial risks
- Finding missing assumptions
- Checking pricing completeness
- Identifying unclear scope

## 5. Recommendation Agent
Responsible for:
- Generating actionable improvements
- Prioritizing revisions
- Calculating readiness score

## 6. Output Formatter Agent
Responsible for:
- Returning structured JSON
- Providing citations
- Preparing frontend-friendly data

---

# Structured JSON Output

Example output:

```json
{
  "proposal_summary": {
    "title": "Smart CCTV Monitoring Proposal",
    "client": "ABC Manufacturing",
    "objective": "Deploy AI-based safety monitoring",
    "proposed_solution": "Computer vision monitoring system",
    "estimated_value": "$50,000",
    "duration": "3 months"
  },
  "completeness_checklist": [
    {
      "section": "Pricing",
      "status": "missing",
      "note": "Pricing section not found"
    }
  ],
  "requirement_match": [
    {
      "requirement": "Real-time monitoring",
      "status": "matched",
      "note": "Covered in methodology section"
    }
  ],
  "key_gaps": [
    {
      "title": "Missing pricing",
      "severity": "high",
      "description": "Proposal does not include commercial pricing",
      "citation": "Page 7"
    }
  ],
  "commercial_risks": [
    {
      "risk": "Undefined maintenance scope",
      "severity": "medium",
      "mitigation": "Add SLA details"
    }
  ],
  "recommendations": [
    {
      "priority": "high",
      "action": "Add pricing breakdown",
      "rationale": "Commercial terms are incomplete"
    }
  ],
  "readiness_score": 68,
  "readiness_label": "Needs Minor Revisions",
  "citations": [
    {
      "ref": "Page 5",
      "context": "Scope of work section"
    }
  ]
}
```

---

# Evaluation Strategy

To evaluate whether the AI output is accurate and useful:

## Accuracy
- Compare AI findings against manually reviewed proposals
- Validate requirement matching manually
- Verify citation correctness

## Groundedness
- Ensure all findings reference proposal content
- Prevent hallucinated requirements or risks

## Consistency
- Run the same proposal multiple times
- Compare output stability

## Usefulness
- Collect feedback from BD reviewers
- Measure time saved during proposal review

## Failure Case Testing
Test cases include:
- Missing pricing
- Missing assumptions
- Weak scope definition
- Incomplete deliverables
- Empty proposal sections

---

# Debugging Scenario

## Problem
The AI says the proposal is ready to submit, but the proposal does not include pricing and assumptions.

## What I Would Check

### 1. Prompt Design
Check whether the system prompt explicitly requires:
- pricing validation
- assumptions validation
- completeness enforcement

### 2. Extraction Quality
Verify:
- PDF text extraction worked correctly
- important pages were not skipped

### 3. JSON Validation Logic
Add rule-based validation after LLM output:
- If pricing section missing → readiness cannot be "Ready"
- If assumptions missing → add high severity gap

### 4. Hallucination Control
Ensure:
- AI references citations
- missing sections are not inferred

### 5. Confidence Rules
Introduce deterministic checks before final scoring.

Example:
```js
if (!pricingFound || !assumptionsFound) {
  readiness_score = Math.min(readiness_score, 60);
}
```

---

# Installation

## Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/bd-proposal-checking-agent.git
cd bd-proposal-checking-agent
```

## Install Dependencies

```bash
npm install
```

## Run Development Server

```bash
npm run dev
```

or

```bash
npm start
```

---

# Environment Variables

Depending on provider:

```env
OPENAI_API_KEY=xxx
ANTHROPIC_API_KEY=xxx
GEMINI_API_KEY=xxx
OPENROUTER_API_KEY=xxx
```

---

# Supported Providers

| Provider | Native PDF Support |
|---|---|
| Anthropic | Yes |
| OpenAI | Yes |
| Gemini | Partial |
| OpenRouter | Text & Docx only |
| Ollama | Text only |
| vLLM | Text # BD Proposal Checking Agent

AI-powered proposal review system for Business Development teams.

This project was built for the AI Engineer case study from AMANA Solutions.

## Demo

- Demo Video: https://youtu.be/fm2ymD8AxAU

## Features

- Upload proposal documents in:
  - PDF
  - DOCX
  - TXT / Markdown
  - Google Docs URL
- Upload TOR / Client Brief
- AI-powered proposal analysis
- Structured JSON review output
- Completeness checklist
- Requirement matching against TOR/RFP
- Commercial risk analysis
- Key gap detection
- Readiness scoring
- Citations & references
- Multi-provider LLM support:
  - Anthropic Claude
  - OpenAI
  - Google Gemini
  - OpenRouter
  - Ollama
  - vLLM

---

# Tech Stack

## Frontend
- React
- JavaScript
- Inline CSS

## AI / LLM
- Anthropic API
- OpenAI API
- Gemini API
- OpenRouter
- Ollama
- vLLM

## Document Processing
- Mammoth.js (DOCX extraction)
- Native PDF handling
- Google Docs text export

---

# System Architecture

The architecture is designed as a lightweight AI Agent workflow:

```text
User Input
    │
    ├── Proposal Document
    └── TOR / Client Brief
            │
            ▼
Document Extraction Layer
    ├── PDF Handler
    ├── DOCX Parser
    ├── Google Docs Fetcher
    └── Text Reader
            │
            ▼
Preprocessing Layer
    ├── Normalize text
    ├── Build prompts
    └── Attach citations context
            │
            ▼
LLM Analysis Engine
    ├── Proposal understanding
    ├── Requirement matching
    ├── Risk detection
    ├── Gap analysis
    └── Recommendation generation
            │
            ▼
Structured JSON Output
            │
            ▼
Frontend Review Dashboard
```

---

# Agentic Workflow

The proposal checking workflow consists of several logical agents:

## 1. Document Ingestion Agent
Responsible for:
- Reading PDF/DOCX/TXT files
- Reading Google Docs
- Converting documents into raw text

## 2. Proposal Understanding Agent
Responsible for:
- Extracting proposal summary
- Identifying sections
- Understanding scope and objectives

## 3. TOR Matching Agent
Responsible for:
- Comparing proposal against client requirements
- Detecting matched / partial / missing requirements

## 4. Risk Analysis Agent
Responsible for:
- Detecting commercial risks
- Finding missing assumptions
- Checking pricing completeness
- Identifying unclear scope

## 5. Recommendation Agent
Responsible for:
- Generating actionable improvements
- Prioritizing revisions
- Calculating readiness score

## 6. Output Formatter Agent
Responsible for:
- Returning structured JSON
- Providing citations
- Preparing frontend-friendly data

---

# Structured JSON Output

Example output:

```json
{
  "proposal_summary": {
    "title": "Smart CCTV Monitoring Proposal",
    "client": "ABC Manufacturing",
    "objective": "Deploy AI-based safety monitoring",
    "proposed_solution": "Computer vision monitoring system",
    "estimated_value": "$50,000",
    "duration": "3 months"
  },
  "completeness_checklist": [
    {
      "section": "Pricing",
      "status": "missing",
      "note": "Pricing section not found"
    }
  ],
  "requirement_match": [
    {
      "requirement": "Real-time monitoring",
      "status": "matched",
      "note": "Covered in methodology section"
    }
  ],
  "key_gaps": [
    {
      "title": "Missing pricing",
      "severity": "high",
      "description": "Proposal does not include commercial pricing",
      "citation": "Page 7"
    }
  ],
  "commercial_risks": [
    {
      "risk": "Undefined maintenance scope",
      "severity": "medium",
      "mitigation": "Add SLA details"
    }
  ],
  "recommendations": [
    {
      "priority": "high",
      "action": "Add pricing breakdown",
      "rationale": "Commercial terms are incomplete"
    }
  ],
  "readiness_score": 68,
  "readiness_label": "Needs Minor Revisions",
  "citations": [
    {
      "ref": "Page 5",
      "context": "Scope of work section"
    }
  ]
}
```

---

# Evaluation Strategy

To evaluate whether the AI output is accurate and useful:

## Accuracy
- Compare AI findings against manually reviewed proposals
- Validate requirement matching manually
- Verify citation correctness

## Groundedness
- Ensure all findings reference proposal content
- Prevent hallucinated requirements or risks

## Consistency
- Run the same proposal multiple times
- Compare output stability

## Usefulness
- Collect feedback from BD reviewers
- Measure time saved during proposal review

## Failure Case Testing
Test cases include:
- Missing pricing
- Missing assumptions
- Weak scope definition
- Incomplete deliverables
- Empty proposal sections

---

# Debugging Scenario

## Problem
The AI says the proposal is ready to submit, but the proposal does not include pricing and assumptions.

## What I Would Check

### 1. Prompt Design
Check whether the system prompt explicitly requires:
- pricing validation
- assumptions validation
- completeness enforcement

### 2. Extraction Quality
Verify:
- PDF text extraction worked correctly
- important pages were not skipped

### 3. JSON Validation Logic
Add rule-based validation after LLM output:
- If pricing section missing → readiness cannot be "Ready"
- If assumptions missing → add high severity gap

### 4. Hallucination Control
Ensure:
- AI references citations
- missing sections are not inferred

### 5. Confidence Rules
Introduce deterministic checks before final scoring.

Example:
```js
if (!pricingFound || !assumptionsFound) {
  readiness_score = Math.min(readiness_score, 60);
}
```

---

# Installation

## Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/bd-proposal-checking-agent.git
cd bd-proposal-checking-agent
```

## Install Dependencies

```bash
npm install
```

## Run Development Server

```bash
npm run dev
```

or

```bash
npm start
```

---

# Environment Variables

Depending on provider:

```env
OPENAI_API_KEY=xxx
ANTHROPIC_API_KEY=xxx
GEMINI_API_KEY=xxx
OPENROUTER_API_KEY=xxx
```

---

# Supported Providers

| Provider | Native PDF Support |
|---|---|
| Anthropic | Yes |
| OpenAI | Yes |
| Gemini | Partial |
| OpenRouter | Partial |
| Ollama | Text only |
| vLLM | Partial |

---

# Notes

- Anthropic uses native PDF document blocks
- OpenAI uses Files API + Responses API
- DOCX extraction uses Mammoth.js
- Legacy `.doc` files are partially supported

---

# Submission

- Demo Video: https://youtu.be/fm2ymD8AxAU
- GitHub Repository: (add your repo link here)

---

# Notes

- Anthropic uses native PDF document blocks
- OpenAI uses Files API + Responses API
- DOCX extraction uses Mammoth.js
- Legacy `.doc` files are partially supported

---

# Submission

- Demo Video: https://youtu.be/fm2ymD8AxAU

---

# Author

Muhammad Fhadli  
AI Engineer