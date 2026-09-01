---
layout: default
title: Prompt Engineering Interview Guide
permalink: /prompt-engineering/
---

# Prompt Engineering Interview Guide

## Table of Contents
1. [Prompt Engineering Fundamentals](#prompt-engineering-fundamentals)
2. [Prompt Structure & Design](#prompt-structure--design)
3. [Prompt Engineering Techniques](#prompt-engineering-techniques)
4. [Advanced Techniques](#advanced-techniques)
5. [Chain of Thought & Reasoning](#chain-of-thought--reasoning)
6. [Few-Shot Prompting](#few-shot-prompting)
7. [Prompt Optimization](#prompt-optimization)
8. [Common Pitfalls & Solutions](#common-pitfalls--solutions)
9. [Tools & Frameworks](#tools--frameworks)
10. [Interview Questions & Answers](#interview-questions--answers)

---

## Prompt Engineering Fundamentals

### What is Prompt Engineering?

**Definition:**
Prompt engineering is the practice of designing and refining inputs (prompts) to LLMs to elicit desired outputs. It's the art and science of communicating effectively with AI models.

**Why It Matters:**

1. **Performance:** Output quality dramatically varies with prompt
2. **Efficiency:** Better prompts = fewer iterations
3. **Cost:** Well-crafted prompts reduce token usage
4. **Reliability:** Consistent quality across similar tasks
5. **Safety:** Can guide models away from harmful outputs

**Example - Impact of Prompting:**

**Poor Prompt:**
```
"Summarize this"
→ Unclear what "this" is
→ Might summarize wrong document
→ Vague summary
```

**Good Prompt:**
```
"Summarize the following scientific paper on climate change in 3 key points, 
focusing on actionable solutions. The summary should be understandable to a 
non-technical audience."

→ Clear what to summarize
→ Specific format (3 points)
→ Target audience defined
→ Focus area (solutions)
→ High-quality, relevant summary
```

**Prompt vs Model Quality:**

```
Weak model + Great prompt = 70% quality
Strong model + Weak prompt = 60% quality
Strong model + Great prompt = 95% quality
```

A well-engineered prompt can overcome some model limitations.

---

### Core Principles of Effective Prompts

**1. Clarity**

Be specific and unambiguous

```
❌ Poor: "Tell me about AI"
✓ Good: "Explain how transformer neural networks work, focusing on attention mechanisms. 
         Use analogies suitable for someone with basic Python knowledge."
```

**2. Context**

Provide necessary background

```
❌ Poor: "What's the best approach?"
✓ Good: "We're building a mobile app that needs to analyze images in real-time. 
         Our constraints are: <2 second latency, <100MB app size, offline capability. 
         What approach would you recommend?"
```

**3. Specificity**

Define output format and details

```
❌ Poor: "Generate a poem"
✓ Good: "Generate a 12-line poem in AABB rhyme scheme about autumn, using metaphors 
         about change and transition. Write at a high school reading level."
```

**4. Instruction Hierarchies**

Order instructions by importance

```
❌ Poor (mixed): "Analyze this. Be concise. First, read the context. Use bullet points. 
                  Consider multiple perspectives."

✓ Good (ordered):
1. Read and understand: [context]
2. Analyze from three perspectives: [A, B, C]
3. Format: Use bullet points
4. Length: Keep to 200 words maximum
5. Tone: Professional but accessible
```

**5. Role Definition**

Tell model what role to take

```
❌ Poor: "Write a tutorial"
✓ Good: "You are an experienced software engineering instructor teaching Python to 
         beginners. Write a 500-word tutorial on list comprehensions that includes:
         - Real-world use case
         - Step-by-step breakdown
         - Common mistakes and how to avoid them
         - Practice exercise"
```

---

## Prompt Structure & Design

### Q1: What are the key components of a well-structured prompt?

**Answer:**

**Basic Structure:**

```
[System Context] + [Context/Background] + [Instructions] + [Format] + [Constraints]
```

**Component Breakdown:**

**1. System Message (Role & Behavior)**

Defines model's behavior and persona

```
"You are a helpful, professional customer support specialist who is:
- Empathetic and patient
- Knowledgeable about our products
- Able to troubleshoot issues
- Authorized to offer solutions up to $100
- Professional in tone but warm in manner"
```

Key aspects:
- Define role/expertise
- Set tone and manner
- Establish boundaries/constraints
- Specify capabilities

**2. Context/Background**

Information the model needs

```
"Context: You are analyzing user feedback from our mobile app. 
The app was recently updated with a new UI design. 
Users have reported several issues in the last 2 weeks.

Background:
- App: Budget Tracker v3.2
- Update date: January 15, 2025
- Main features: Expense tracking, budgeting, categorization
- Target users: Personal finance enthusiasts, age 25-45"
```

What to include:
- Relevant history
- Domain knowledge
- User information
- Constraints/requirements
- Relevant data points

**3. Task/Instruction**

What you want the model to do

```
"Task: Analyze the attached user feedback dataset (100 reviews) and:
1. Identify the top 5 most common issues
2. Categorize them by severity (Critical, High, Medium, Low)
3. Suggest root causes for each issue
4. Recommend fixes prioritized by impact"
```

Should be:
- Clear and direct
- Actionable
- Specific about desired output
- In logical order

**4. Output Format**

How you want the result structured

```
"Format your response as:

## Issue #1: [Issue Name]
- Description: [Details]
- Severity: [Critical/High/Medium/Low]
- Frequency: [Number of reports]
- Suggested root cause: [Analysis]
- Recommended fix: [Solution]
- Implementation effort: [Low/Medium/High]
- Expected impact: [High/Medium/Low]

[Repeat for each issue]"
```

Benefits of specifying format:
- Consistent output
- Easier to parse
- Better for automation
- Clearer results

**5. Constraints & Guardrails**

Limitations and guidelines

```
"Constraints:
- Keep each issue description to 2-3 sentences max
- Only cite issues from the provided data
- Do not speculate about issues not mentioned
- Assume good faith from users
- Do not recommend refunding money
- Maximum response length: 1500 words
- Use professional language"
```

Important constraints:
- Output length
- Language/tone
- What NOT to do
- Safety boundaries
- Data usage rules

**6. Examples (Optional but Powerful)**

Show desired behavior

```
"Example output format:

## Issue #1: Login failures on Android
- Description: Users report unable to log in after latest update. 
  Error message: 'Authentication failed.'
- Severity: Critical
- Frequency: 247 reports

[Continue with other fields...]"
```

**Complete Prompt Template:**

```
[System Message]
You are a professional [role] with expertise in [domain].
Your goal is to [primary goal].
You should [key behaviors].
You must NOT [boundaries].

[Context]
Background: [relevant information]
Constraints: [requirements]
Data: [input data or references]

[Task]
Please analyze/summarize/generate [specific task].
Specifically:
1. [Subtask 1]
2. [Subtask 2]
3. [Subtask 3]

[Format]
Return your response in the following format:
[Structured format with sections]

[Examples]
Here's an example of the expected output:
[Example response]

[Constraints]
- [Constraint 1]
- [Constraint 2]
- Maximum length: [X words/tokens]
```

**Why Structure Matters:**

LLMs process information better when organized:
- Clear hierarchy helps understanding
- Section labels provide navigation
- Examples show what's expected
- Constraints prevent errors

**Prompt Length:**

General guidelines:
```
Too short (< 100 tokens): Missing context, poor results
Optimal (300-1000 tokens): Good balance
Too long (> 2000 tokens): May confuse model, wastes tokens
```

---

### Q2: How do you write effective system prompts?

**Answer:**

**System Prompt Purpose:**

Sets up the model's behavior, constraints, and personality for all conversations

```
System Prompt: Defines baseline behavior
User Prompt: Specific request for this turn
System Prompt applies to all user prompts
```

**Components of Effective System Prompts:**

**1. Role Definition**

```
❌ Weak: "You're helpful"
✓ Strong: "You are a senior software architect with 15+ years of experience 
           in cloud infrastructure, microservices, and scalable systems design. 
           You've led teams of 50+ engineers and designed systems handling 
           millions of requests per second."
```

More specific role = Better relevant knowledge accessed

**2. Expertise Areas**

```
"You specialize in:
- Object-oriented and functional programming paradigms
- Cloud platforms (AWS, Azure, GCP)
- Containerization and orchestration (Docker, Kubernetes)
- Database design and optimization
- System performance tuning"
```

**3. Communication Style**

```
"Communicate in a manner that is:
- Technical but not overly verbose
- Practical with real-world examples
- Constructive, offering solutions not just criticism
- Approachable to engineers of varying levels"
```

**4. Constraints & Boundaries**

```
"Important constraints:
- Do NOT recommend proprietary or expensive solutions when open-source alternatives exist
- Do NOT discuss implementation details of systems you're not familiar with
- Always acknowledge trade-offs and limitations
- Explicitly state your assumptions if they're not clear"
```

**5. Output Preferences**

```
"In your responses:
- Use code examples when applicable
- Break down complex concepts into digestible parts
- Provide links to relevant documentation
- Explain 'why' not just 'how'
- Include estimated implementation time"
```

**6. Tone & Personality**

```
"Your tone should be:
- Confident but humble
- Professional but conversational
- Encouraging but honest
- Avoiding jargon when simpler terms work
- Injecting subtle humor where appropriate"
```

**Example Complete System Prompt:**

```
You are an expert copywriter specializing in B2B SaaS marketing. 

Expertise:
- Value proposition messaging
- Technical to non-technical translation
- Conversion rate optimization
- Long-form and short-form content
- A/B testing principles

Style:
- Clear, concise, benefit-focused language
- Active voice, avoiding jargon
- Data-driven insights backed by examples
- Storytelling to illustrate benefits
- Persuasive but not manipulative

Rules:
- Every claim should be defensible
- Focus on user problems, not product features
- Avoid overuse of exclamation marks
- Include concrete metrics when possible
- A/B test variations are expected

Format preferences:
- Use bullet points for lists
- Short paragraphs (2-3 sentences)
- Subheadings for structure
- Clear calls-to-action
```

**System Prompt Best Practices:**

1. **Be Specific:** Generic prompts get generic responses
2. **Show Constraints:** Clear boundaries prevent errors
3. **Define Success:** What does good look like?
4. **Set Tone:** Communication style matters
5. **Update Regularly:** Refine based on output quality

**Testing System Prompts:**

```python
def test_system_prompt(system_prompt, test_queries):
    results = []
    for query in test_queries:
        response = llm.complete(
            system_message=system_prompt,
            user_message=query
        )
        results.append({
            "query": query,
            "response": response,
            "quality": evaluate_quality(response)
        })
    
    avg_quality = sum(r["quality"] for r in results) / len(results)
    return avg_quality, results
```

---

## Prompt Engineering Techniques

### Q3: What are the main prompting techniques?

**Answer:**

**1. Direct Prompting (Straightforward)**

Ask directly for what you want

```
Q: What's the capital of France?
A: The capital of France is Paris.

Simple, works for factual questions
```

**2. Instruction Prompting**

Give clear instructions

```
"Summarize the following text in 3 bullet points:
[Text]"

More structured, consistent output
```

**3. Role-Based Prompting**

Have model adopt a role

```
"You are a professional resume writer. 
Rewrite this job description as a resume bullet point.
[Job description]"

Better quality, role-specific knowledge
```

**4. Chain of Thought (CoT)**

Ask model to explain reasoning

```
Q: If a book costs $10 and I buy 3 with 20% discount, how much do I pay?
A: Let me think step by step:
1. Original total: $10 × 3 = $30
2. Discount: 20% of $30 = $6
3. Final price: $30 - $6 = $24

More accurate, especially for reasoning tasks
```

**5. Few-Shot Prompting**

Provide examples

```
Example 1:
Input: "Happy day"
Sentiment: Positive

Example 2:
Input: "Terrible experience"
Sentiment: Negative

Now classify:
Input: "Amazing product!"
Sentiment: ?

Model learns from examples
```

**6. Zero-Shot Prompting**

No examples, relies on pre-training

```
"Classify the sentiment of: 'I love this product'"

Works if model has seen similar during training
```

**7. Prompt Composition**

Combine multiple techniques

```
"You are a helpful code reviewer.
Please review this code and:

1. Identify bugs (if any)
2. Suggest improvements
3. Rate code quality (1-10)

Review process:
- First, read the code carefully
- Note any issues you see
- Consider performance implications
- Think about maintainability

Code:
[code]

Please provide your analysis."

Combines: role + CoT + structure + instructions
```

**8. Constraint-Based Prompting**

Use constraints to guide behavior

```
"Answer the question but:
- Use only 50 words maximum
- Do not cite sources beyond 2020
- Write at 6th-grade reading level
- Use metaphors to explain

Question: What is photosynthesis?"

Constraints shape the response
```

**9. Comparative Prompting**

Ask to compare options

```
"Compare Python vs JavaScript for:
1. Web backend development
2. Data science
3. Performance

Format: Pros/cons for each use case"

Gives balanced perspective
```

**10. Question Refinement**

Ask follow-up questions

```
Initial: "How do I learn programming?"
Follow-up: "Considering you have 5 hours/week and no prior experience, 
which programming language would you recommend and why?"

Iterative refinement gets better answers
```

**Effectiveness Comparison:**

| Technique | Use Case | Effectiveness |
|-----------|----------|---------------|
| Direct | Factual questions | Good for simple Q&A |
| Instruction | Specific output format | Very good for tasks |
| Role-based | Specialized expertise | Great for domain knowledge |
| Chain of Thought | Reasoning, math | Excellent for complex |
| Few-shot | Novel tasks | Good when examples clear |
| Zero-shot | General knowledge | Fair if well-trained data |
| Composition | Complex tasks | Excellent, most reliable |

---

## Advanced Techniques

### Q4: What are advanced prompt engineering techniques?

**Answer:**

**1. Chain-of-Thought with Self-Critique**

Model explains reasoning then critiques itself

```
Q: Is a tomato a fruit or vegetable?

Model:
Step 1: Botanically, a tomato is a fruit (flowering plant's ripened ovary)
Step 2: Culinarily, it's used as a vegetable (in savory dishes)
Step 3: Supreme Court ruled 1893: vegetable for tariff purposes

Critique of my thinking:
- I'm correct botanically and culinarily
- The legal ruling is interesting but not definitive
- Better answer: It's a fruit botanically, vegetable culinarily

Final Answer: A tomato is botanically a fruit but culinary a vegetable.

More nuanced understanding
```

**2. Tree of Thought (ToT)**

Explore multiple reasoning paths

```
Problem: Arrange numbers 1-9 in a 3×3 grid so sums are magic

Model:
Path A: Start with center = 5
├─ Top row: Try 1,2,3
├─ Check: Does it lead to solution?
└─ Result: Yes, this works

Path B: Start with center = 4
├─ Top row: Try 1,2,3
├─ Check: Does it lead to solution?
└─ Result: No, contradictions

Path C: Different approach...

Better for problems with multiple solution paths
```

**3. Least-to-Most Prompting**

Solve simpler sub-problems first

```
Complex problem: Calculate compound interest over 30 years with varying rates

Breakdown:
1. Simple: Calculate interest for 1 year, single rate
2. Medium: Calculate for 5 years, single rate
3. Hard: Calculate for 30 years, varying rates (5% then 6% then 7%)
4. Complex: Add tax implications

By solving simple first, model understands fundamentals
Then tackles complex with better grounding
```

**4. Meta-Prompting (Self-Improving)**

Ask model to improve its own prompts

```
"Given your response to [question], 
how would you revise the original prompt 
to get an even better answer?

Original prompt: [prompt]
Your response: [response]

Improved prompt: "

Model iteratively refines prompts
```

**5. Analogical Prompting**

Use analogies to explain

```
Q: How does a neural network learn?
A: "Think of it like a student learning:
- Initially, the student guesses randomly (random weights)
- Gets feedback on wrong answers (loss)
- Adjusts studying approach based on feedback (gradient descent)
- Over time, improves predictions (training)
- Tests on unseen problems (validation set)"

Analogies make concepts more understandable
```

**6. Decomposition with Delegation**

Break problem into specialist sub-problems

```
Task: Write marketing email for new product

Delegate:
1. Research Agent: What should email contain?
2. Headlines Agent: Generate 5 compelling subject lines
3. Copy Agent: Write 150-word body
4. CTA Agent: Create call-to-action options
5. Review Agent: Combine and optimize

Then synthesize all pieces into final email
```

**7. Prompt Chaining**

Multiple prompts in sequence

```
Step 1: Summarize article
Input: [Article]
Output: Summary

Step 2: Extract key points
Input: [Summary from Step 1]
Output: Bullet points

Step 3: Generate questions
Input: [Key points from Step 2]
Output: 5 discussion questions

Step 4: Create study guide
Input: [All previous outputs]
Output: Study guide

Each step builds on previous
Complex tasks broken into simple ones
```

**8. Dynamic Prompting**

Adjust prompt based on input characteristics

```python
def dynamic_prompt(input_text):
    length = len(input_text)
    complexity = estimate_complexity(input_text)
    
    if length > 5000:
        # Long text: ask for summary first
        prompt = "Summarize then analyze..."
    elif complexity == "high":
        # Complex topic: use CoT
        prompt = "Explain step by step..."
    else:
        # Simple: direct approach
        prompt = "Directly answer..."
    
    return prompt
```

**9. Instructive Prompting**

Teach model how to think

```
"To solve logic puzzles:
1. List all known facts
2. Identify what we need to find
3. Work through deductions step-by-step
4. Verify solution against constraints
5. Double-check reasoning

Now apply this method to: [puzzle]"

Teaching the process improves solving
```

**10. Uncertainty-Aware Prompting**

Ask model to quantify confidence

```
"For each statement, provide:
1. The statement
2. Your confidence (0-100%)
3. Why you're confident (or not)
4. Key uncertainties

Statement: AI will achieve AGI by 2030"

Helps users understand reliability
```

**Effectiveness for Different Tasks:**

| Task | Best Techniques |
|------|-----------------|
| Math/Reasoning | CoT, Tree of Thought, Least-to-Most |
| Knowledge | Few-shot, Role-based |
| Creative | Analogical, Meta-prompting |
| Classification | Few-shot, Constraint-based |
| Complex | Prompt chaining, Decomposition |

---

## Chain of Thought & Reasoning

### Q5: Explain Chain of Thought prompting and its variations

**Answer:**

**Chain of Thought Definition:**

Model explicitly shows reasoning steps before concluding, rather than jumping to answer.

**Why It Works:**

```
Without CoT:
Q: "2 + 3 × 4 = ?"
A: "14" (might be wrong if not trained well)

With CoT:
Q: "2 + 3 × 4 = ? Let me think step by step."
A: "First, I do multiplication: 3 × 4 = 12
    Then, I do addition: 2 + 12 = 14
    Answer: 14"

CoT improves accuracy, especially for complex reasoning
```

**Simple CoT Example:**

```
Q: Sarah has 5 apples. She buys 3 more. Then eats 2. How many does she have?

A: "Let me think through this step by step:
1. Starting amount: Sarah has 5 apples
2. She buys 3 more: 5 + 3 = 8 apples
3. She eats 2: 8 - 2 = 6 apples
Therefore, Sarah has 6 apples."
```

**CoT Variations:**

**1. Zero-Shot CoT**

No examples, just ask for reasoning

```
"Answer the following question. 
Think step by step before responding.

Q: [Question]"

Works surprisingly well with modern models
```

**2. Few-Shot CoT**

Provide examples with reasoning

```
Example 1:
Q: If a train travels 60 mph for 3 hours, how far?
A: "Step 1: Identify formula: Distance = Speed × Time
    Step 2: Plug in values: 60 × 3 = 180
    Step 3: Answer: 180 miles"

Example 2:
Q: [New question]
A: "Step 1: [reasoning]
    Step 2: [reasoning]
    ...
    Answer: [answer]"

Showing examples improves performance
```

**3. Self-Consistency CoT**

Generate multiple reasoning paths, take majority

```
Generate 5 different solutions:
Path 1: [reasoning] → Answer A
Path 2: [reasoning] → Answer A
Path 3: [reasoning] → Answer B
Path 4: [reasoning] → Answer A
Path 5: [reasoning] → Answer A

Majority: Answer A (4 out of 5)
More reliable than single path
```

**4. Scratchpad CoT**

Model writes intermediate thoughts

```
Thought: What's the goal here?
[Answer]

Thought: What facts do I know?
[Answer]

Thought: What can I deduce?
[Answer]

Thought: What's the final answer?
[Answer]

Makes thinking explicit and auditable
```

**5. Counterfactual CoT**

Explore "what if" scenarios

```
Actual: User bought product, loved it

Counterfactual 1: What if user bought competitor?
[Reasoning]

Counterfactual 2: What if price was 2× higher?
[Reasoning]

Helps understand causal relationships
```

**6. Explicit Constraint Reasoning**

Highlight constraints during reasoning

```
Constraints:
- Budget: $5000
- Timeline: 2 weeks
- Team size: 3 people
- Must be cloud-based

Reasoning:
Given constraint 1 (budget $5000)...
Given constraint 2 (2 weeks)...
Considering all constraints together...
```

**7. Back-and-Forth CoT**

Model questions its own reasoning

```
Initial thought: The answer is X
Question: But wait, what about Y?
Revised thought: Actually, considering Y...
New answer: The answer is Z
Verification: Does Z satisfy all constraints?
```

**Example: Complex Problem with CoT**

```
Problem: An employer promises a raise of 50% to an employee. 
The employee's initial salary was $100. If the raise is 
given twice, what's the final salary?

With CoT:
"Let me break this down carefully:

Step 1: Understand what's being asked
- Starting salary: $100
- Two raises of 50% each
- Find: Final salary

Step 2: First raise
- Raise amount: 50% of $100 = $50
- Salary after: $100 + $50 = $150

Step 3: Second raise
- Raise amount: 50% of $150 = $75
- Salary after: $150 + $75 = $225

Step 4: Verify
- Each raise is 50% of current salary
- First: $100 → $150 (increased by 50%)
- Second: $150 → $225 (increased by 50%)
- Correct!

Final answer: $225"

Clear reasoning prevents common mistakes
```

**When to Use CoT:**

**Use CoT for:**
- Math problems
- Logic puzzles
- Complex reasoning
- Multi-step problems
- Decisions with multiple factors

**Don't need CoT for:**
- Simple factual questions ("What year was WWII?")
- Direct recall ("Who is the president?")
- Straightforward classifications

**Performance Impact:**

Studies show CoT improves:
- Math reasoning: +30-40% accuracy
- Logic problems: +20-30% accuracy
- General QA: +5-10% accuracy

Token cost: ~50% more tokens, but better quality worth it.

---

## Few-Shot Prompting

### Q6: How to design effective few-shot prompts?

**Answer:**

**Few-Shot Definition:**

Providing examples in the prompt to teach the model how to perform a task.

**Why Few-Shot Works:**

LLMs learn from patterns in text, including patterns in your prompt.

```
Without examples:
"Classify sentiment: I hate this"
→ Model guesses based on training

With examples:
"Positive: I love this!
 Negative: I hate this
 
 Classify: I hate this"
→ Model sees pattern, applies to new input
```

**Few-Shot vs Zero-Shot:**

```
Zero-shot: No examples
- Pros: Uses model's training knowledge
- Cons: May not understand your specific format
- Use when: Task familiar to model

Few-shot: 1-10 examples
- Pros: Shows exact format and logic
- Cons: Uses more tokens
- Use when: Custom format or task

Many-shot: 10-50+ examples
- Pros: Can handle complex patterns
- Cons: High token cost
- Use when: Complex task or high accuracy needed
```

**Number of Examples:**

```
Performance vs. Examples:

0 examples: 60% accuracy (baseline)
1 example: 70% accuracy
2 examples: 75% accuracy
3 examples: 78% accuracy
5 examples: 80% accuracy
10 examples: 81% accuracy
20 examples: 81.5% accuracy

Diminishing returns after 5 examples
Usually 3-5 examples optimal
```

**Example Selection Strategy:**

**1. Representative Examples**

Choose examples that cover the range

```
Bad: All positive sentiment examples
"I love this!"
"Amazing product"
"Excellent service"

Good: Mix of sentiments
"I love this!" (positive)
"It's okay" (neutral)
"Terrible experience" (negative)
"Good but could be better" (mixed)

Model learns the full spectrum
```

**2. Edge Cases**

Include boundary cases

```
Task: Classify email as spam or not spam

Normal examples:
"Get free money now!" → Spam
"Meeting at 3pm tomorrow" → Not spam

Edge cases:
"URGENT: Action required" → Spam (all caps)
"URGENT: Your account needs verification" → Spam (legitimate urgency)
"Check out our new product [link]" → Borderline (marketing)

Model learns boundaries
```

**3. Diversity**

Include different styles and formats

```
Task: Extract name from sentence

Example 1: "My name is Alice."
Example 2: "I'm Bob."
Example 3: "You can call me Charlie"
Example 4: "The CEO is Diana Johnson"

Model handles different phrasings
```

**4. Difficulty Progression**

Start simple, then complex

```
Example 1 (easy): "I like it" → Positive
Example 2 (medium): "It's okay, could be better" → Neutral
Example 3 (hard): "I like the features but hate the price" → Mixed

Model gradually learns complexity
```

**Effective Few-Shot Prompt Structure:**

```
[Task Description]
Here are some examples of [task]:

[Example 1]
Input: [input 1]
Output: [output 1]

[Example 2]
Input: [input 2]
Output: [output 2]

[Example 3]
Input: [input 3]
Output: [output 3]

Now apply the same logic to:
Input: [new input]
Output:
```

**Real Example: Sentiment Classification**

```
You are a sentiment classifier. 
Classify the following text as Positive, Negative, or Neutral.

Example 1:
Text: "I absolutely love this product!"
Sentiment: Positive

Example 2:
Text: "It's okay, nothing special"
Sentiment: Neutral

Example 3:
Text: "Terrible quality and expensive"
Sentiment: Negative

Example 4:
Text: "Great features, but too expensive for my budget"
Sentiment: Mixed (has positive and negative aspects)

Now classify:
Text: "The customer service was helpful but delivery took forever"
Sentiment:
```

**Advanced Few-Shot Techniques:**

**1. Contrastive Few-Shot**

Show what NOT to do

```
CORRECT examples:
"I like this" → Positive
"I hate this" → Negative

INCORRECT examples (don't do this):
❌ "I like this" → Negative (wrong!)
❌ "I hate this" → Positive (wrong!)

Now classify correctly:
"I dislike this" → ?
```

**2. Analogical Few-Shot**

Use analogies in examples

```
Example 1:
"Understanding machine learning is like learning to cook:
First you learn basic techniques (data types)
Then you practice recipes (algorithms)
Finally you create your own dishes (applications)"

Output: Good analogy - clear progression

Example 2:
"OOP is like object-oriented"
Output: Bad analogy - circular definition

Task: Rate this analogy...
```

**3. Retrieval-Augmented Few-Shot**

Dynamically select best examples

```python
def select_examples(query, example_pool, num_examples=3):
    # Find most similar examples to query
    similarities = [similarity(query, ex) for ex in example_pool]
    
    # Pick top examples
    best_examples = select_top_k(similarities, num_examples)
    
    return best_examples

# Different queries get different examples
# More relevant examples = better performance
```

**Few-Shot Prompts by Task Type:**

**Classification:**
```
Input: [example input]
Label: [example label]
[Repeat 3-5 times]

Classify:
Input: [new input]
Label:
```

**Question Answering:**
```
Q: [example question]
A: [example answer]
[Repeat 3-5 times]

Q: [new question]
A:
```

**Text Generation:**
```
Prompt: [example prompt]
Output: [example output]
[Repeat 3-5 times]

Prompt: [new prompt]
Output:
```

**Translation:**
```
English: [example English]
French: [example French]
[Repeat 3-5 times]

English: [new English]
French:
```

**Common Mistakes:**

❌ **Inconsistent formatting**
```
Example 1: "Output: Positive"
Example 2: "Result is Positive"
→ Model gets confused
✓ Use same format for all examples
```

❌ **Too many examples**
```
50 examples used
→ Wastes tokens, diminishing returns
✓ Use 3-5 carefully chosen examples
```

❌ **Cherry-picked easy examples**
```
Only simple examples shown
→ Fails on edge cases
✓ Include representative distribution
```

❌ **Poor example quality**
```
Example has errors or is unclear
→ Model learns from bad examples
✓ Verify examples are correct
```

---

## Prompt Optimization

### Q7: How do you optimize prompts for better performance?

**Answer:**

**Optimization Process:**

```
1. Baseline: Create initial prompt
2. Test: Evaluate on test set
3. Analyze: Identify failure modes
4. Iterate: Refine prompt
5. Repeat: Until acceptable performance
```

**Key Metrics to Track:**

```
Accuracy: % correct responses
Precision: True positives / All positives
Recall: True positives / All actual positives
Clarity: Output understandability
Cost: Tokens used per task
Latency: Time to response
Consistency: Similar inputs → similar outputs
```

**Optimization Techniques:**

**1. Adding Context**

```
❌ Poor: "What's the best programming language?"
✓ Better: "For a web backend startup with 2 engineers 
           and $50K budget, what programming language?"
✓ Best: "For a web backend startup (2 engineers, $50K budget, 
         12-month timeline, targeting 1M+ users), 
         considering developer availability, ecosystem maturity, 
         and cost, what's the best language?"

More context → More relevant answer
```

**2. Specifying Format**

```
❌ Poor: "Analyze this product"
✓ Better: "Analyze this product and provide strengths/weaknesses"
✓ Best: "Analyze this product in JSON format:
{
  \"strengths\": [\"...\", \"...\"],
  \"weaknesses\": [\"...\", \"...\"],
  \"rating\": \"1-5\",
  \"recommendation\": \"...\"
}"

Structured output → Easier parsing & consistency
```

**3. Chain of Thought Addition**

```
❌ Poor: "Is this a good investment?"
✓ Better: "Is this a good investment? Explain your reasoning."
✓ Best: "Is this a good investment? Explain step by step:
1. Financial metrics (revenue, growth, margins)
2. Market position and competition
3. Management quality
4. Risks and opportunities
5. Valuation assessment
6. Final recommendation"

CoT → Better accuracy, more reliable
```

**4. Few-Shot Examples**

```
❌ Zero-shot: "Classify sentiment"
✓ Few-shot: "Classify sentiment (provide examples first)
Example 1: ... → Positive
Example 2: ... → Negative
Example 3: ... → Neutral

Now classify: ..."

Examples → Model understands task better
```

**5. Constraint Specification**

```
❌ Poor: "Write a summary"
✓ Better: "Write a 3-sentence summary"
✓ Best: "Write a 3-sentence summary for a 6th-grade reading level,
         highlighting only the most important facts,
         without using technical jargon"

Clear constraints → Better output control
```

**6. Role Definition**

```
❌ Poor: "Help me with this code"
✓ Better: "You're an expert Python developer. Help me..."
✓ Best: "You're a senior Python developer with expertise in 
         performance optimization. Review this code for:
         1. Bugs
         2. Performance issues
         3. Code quality
         4. Best practices"

Clear role → Better domain-specific expertise
```

**7. Temperature Tuning**

```
Temperature = 0 (deterministic):
- Use for: Factual tasks, classification
- Example: "What's 2+2?" (always 4)

Temperature = 0.5-0.7 (balanced):
- Use for: General tasks
- Example: Most use cases

Temperature = 1.0+ (creative):
- Use for: Creative writing, brainstorming
- Example: "Generate creative product names"

Right temperature for task improves quality
```

**8. Negative Examples**

```
❌ Without: "What's a good API design?"
✓ With: "What's a good API design? 
Avoid: 
- Inconsistent parameter names
- Non-idempotent operations
- Unclear error messages
- Missing pagination

Good API has:
- Consistent patterns
- Clear documentation
- Proper error handling
- Performance optimizations"

Saying what NOT to do helps avoid pitfalls
```

**9. Step-by-Step Instructions**

```
❌ Poor: "Do this complex task"
✓ Better: "Do this task in these steps:
1. First, identify...
2. Then, analyze...
3. Next, evaluate...
4. Finally, recommend..."

Clear steps → Better execution
```

**10. Example-Based Improvement**

```
Original: "Summarize this article"
Performance: 60% user satisfaction

Add CoT: "Summarize focusing on key takeaways:
1. Main point
2. Supporting evidence  
3. Implications"
Performance: 75% user satisfaction

Add examples: "See examples of good summaries"
Performance: 85% user satisfaction

Iteratively improve with data
```

**Optimization Tools & Methods:**

**A/B Testing Prompts**

```python
prompts = {
    "baseline": "Summarize...",
    "with_cot": "Summarize step by step...",
    "with_examples": "Summarize (examples provided)...",
    "optimized": "With all improvements..."
}

results = {}
for name, prompt in prompts.items():
    accuracy = evaluate_prompt(prompt, test_set)
    results[name] = accuracy

best_prompt = max(results, key=results.get)
print(f"Best: {best_prompt} with {results[best_prompt]:.1%} accuracy")
```

**Prompt Evaluation Framework:**

```python
class PromptEvaluator:
    def evaluate(self, prompt, test_cases):
        results = {
            "accuracy": self.calculate_accuracy(prompt, test_cases),
            "consistency": self.calculate_consistency(prompt),
            "clarity": self.measure_clarity(prompt),
            "tokens": self.count_tokens(prompt),
            "latency": self.measure_latency(prompt)
        }
        return results
    
    def score(self, results):
        # Weighted scoring
        return (
            results["accuracy"] * 0.4 +
            results["consistency"] * 0.3 +
            results["clarity"] * 0.2 +
            (1 - results["tokens"]/max_tokens) * 0.05 +
            (1 - results["latency"]/max_latency) * 0.05
        )
```

**Optimization Workflow:**

```
Step 1: Define success metrics
- Accuracy target: 90%
- Cost target: <$0.01 per task
- Latency target: <2 seconds

Step 2: Create baseline prompt
- Simple, clear prompt
- Test performance

Step 3: Analyze failures
- Which cases fail?
- Why do they fail?
- What's needed to fix?

Step 4: Iterate on prompt
- Add context where needed
- Improve structure
- Add examples for hard cases

Step 5: Test improvements
- Compare metrics
- Pick best performing

Step 6: Deploy and monitor
- Track real-world performance
- Refine based on feedback
```

---

## Common Pitfalls & Solutions

### Q8: What are common prompt engineering mistakes and how to avoid them?

**Answer:**

**1. Vague Instructions**

❌ **Problem:**
```
"Summarize this text"
→ Unclear what level of detail
→ Unclear format
→ Unclear target audience
```

✓ **Solution:**
```
"Summarize this text in 3 bullet points, 
each 1-2 sentences, for a non-technical manager"
→ Clear format (3 bullets)
→ Clear length (1-2 sentences each)
→ Clear audience (non-technical manager)
→ Consistent, quality output
```

**2. Unclear Context**

❌ **Problem:**
```
"Is this a good solution?"
→ What domain?
→ What are constraints?
→ What metrics matter?
```

✓ **Solution:**
```
"Our mobile app needs to store user data. 
Constraints: <500MB database, offline capability.
Context: Startup with 2 engineers.
Is this solution good?"
```

**3. Inconsistent Examples**

❌ **Problem:**
```
Example 1: "Input: X, Output: A"
Example 2: "X → A"
Example 3: "X produces A"
→ Different formats confuse model
```

✓ **Solution:**
```
Example 1: "Input: X, Output: A"
Example 2: "Input: Y, Output: B"
Example 3: "Input: Z, Output: C"
→ Consistent format makes learning clear
```

**4. Too Many Examples**

❌ **Problem:**
```
50 examples provided
→ Wastes tokens
→ Diminishing returns
→ May confuse model
```

✓ **Solution:**
```
3-5 well-chosen examples
→ Efficient token usage
→ Clear pattern learning
→ Consistent performance
```

**5. Wrong Temperature Setting**

❌ **Problem:**
```
Task: Classify sentiment
Temperature: 2 (very random)
→ Random classifications
→ Unreliable results
```

✓ **Solution:**
```
Task: Classify sentiment
Temperature: 0.3 (deterministic)
→ Consistent classifications
→ Reliable results
```

**6. No Clear Output Format**

❌ **Problem:**
```
"Analyze this"
→ Free-form response
→ Hard to parse
→ Inconsistent structure
```

✓ **Solution:**
```
"Analyze this and return JSON:
{
  \"strengths\": [],
  \"weaknesses\": [],
  \"rating\": 1-5,
  \"recommendation\": \"...\"
}"
→ Structured output
→ Easy to parse
→ Consistent format
```

**7. Over-Complicated Prompts**

❌ **Problem:**
```
"Long, nested instructions"
→ Model gets confused
→ Poor performance
→ Hard to debug
```

✓ **Solution:**
```
"Clear, simple instructions"
→ Model understands
→ Good performance
→ Easy to debug
```

**8. Missing Role Definition**

❌ **Problem:**
```
"How should I design a database?"
→ Generic advice
→ Misses context
```

✓ **Solution:**
```
"You're a database architect with 10+ years experience 
in high-scale systems. How should I design a database for..."
→ Expert-level advice
→ Context-aware
```

**9. Asking Multiple Things at Once**

❌ **Problem:**
```
"Summarize this, classify it, extract entities, 
and rank by importance"
→ Overwhelming
→ May miss some tasks
```

✓ **Solution:**
```
"Step 1: Summarize the text"
[Get response]
"Step 2: Classify the summary"
[Get response]
"Step 3: Extract key entities"
[Get response]

Or in one prompt with clear separation:
"Task 1 - Summarize: ..."
"Task 2 - Classify: ..."
[etc]
```

**10. Not Checking for Hallucinations**

❌ **Problem:**
```
Q: "Who won the 2024 Olympics?"
A: "USA won with 150 medals" [MADE UP]
→ False information accepted
→ Used in decision-making
→ Spread to users
```

✓ **Solution:**
```
"If unsure about facts, say 'I don't know' 
rather than guessing"

Add verification step:
1. Get response
2. Fact-check claims
3. If suspicious, ask for sources
4. Only use verified information
```

**11. Not Optimizing for Your Specific Task**

❌ **Problem:**
```
"Generic prompt works for everything"
→ Okay performance
→ High token usage
→ Slow
```

✓ **Solution:**
```
"Optimize for your specific task"
→ Better performance
→ Lower token usage
→ Faster
→ More cost-effective
```

**12. Ignoring Model Limitations**

❌ **Problem:**
```
Prompt: "Process this 100-page document"
Model: 4K token context
→ Can't process all
→ Missing information
```

✓ **Solution:**
```
"Chunk document into 4K-token pieces"
"Process each chunk"
"Synthesize results"
→ Respects limitations
→ Complete analysis
```

**Quick Checklist for Prompt Quality:**

```
□ Clear and specific instructions
□ Sufficient context provided
□ Output format defined
□ Examples provided (if needed)
□ Temperature appropriate
□ Role defined (if needed)
□ Constraints specified
□ Tested on diverse inputs
□ Failures analyzed and addressed
□ Optimized for token efficiency
```

---

## Tools & Frameworks

### Q9: What tools exist for prompt engineering?

**Answer:**

**Popular Tools & Platforms:**

**1. LangChain**
- Most popular framework
- Chains, agents, memory, document handling
- Supports multiple LLMs (OpenAI, Anthropic, Hugging Face, etc.)
- Python and JavaScript

```python
from langchain.llms import OpenAI
from langchain.prompts import PromptTemplate

template = """Question: {question}
Answer:"""

prompt = PromptTemplate(template=template, input_variables=["question"])
llm = OpenAI()
chain = LLMChain(prompt=prompt, llm=llm)

response = chain.run(question="What is AI?")
```

**2. Prompt Engineering IDE (e.g., Promptpad)**
- Visual prompt building
- A/B testing interface
- Variable management
- Examples and testing

**3. ChatGPT/Claude Web Interface**
- Free or low-cost experimentation
- Good for quick iteration
- Limited automation

**4. OpenAI Playground**
- Visual interface
- Parameter tuning (temperature, frequency penalty, etc.)
- Cost estimation
- API testing

**5. Anthropic Prompt Testing Tools**
- Specific to Claude models
- Built-in examples
- Parameter guidance

**6. Hugging Face Spaces**
- Free hosting
- Demo interfaces
- Integration with HF models
- Open-source community

**7. LLM Evaluation Frameworks**

**HELM (Holistic Evaluation of Language Models)**
```
- Benchmarks for evaluating LLMs
- Accuracy, efficiency, robustness
- Comprehensive evaluation protocol
```

**LangSmith**
```
- Logging and monitoring for LangChain
- Trace execution
- Evaluate quality
- Debug issues
```

**8. Prompt Management Platforms**

**PromptHub**
- Store and version control prompts
- Share prompts with team
- Track performance
- Automated testing

**Weights & Biases**
- Experiment tracking
- Hyperparameter tuning
- Model comparison
- Visualization

**9. API Providers with Built-in Tools**

**OpenAI:**
```
- Playground (testing)
- Fine-tuning API
- Embeddings API
```

**Anthropic:**
```
- Console (testing)
- Claude API
- Tool use support
```

**10. Custom Solutions**

```python
class PromptOptimizer:
    def __init__(self):
        self.prompts = {}
        self.results = {}
    
    def test_prompt(self, name, prompt, test_cases):
        results = []
        for test in test_cases:
            response = llm.complete(prompt + test["input"])
            results.append({
                "input": test["input"],
                "output": response,
                "expected": test["expected"],
                "correct": self.evaluate(response, test["expected"])
            })
        
        accuracy = sum(r["correct"] for r in results) / len(results)
        self.results[name] = accuracy
        return results
    
    def find_best_prompt(self):
        return max(self.results, key=self.results.get)
```

**Comparison of Tools:**

| Tool | Best For | Ease | Features |
|------|----------|------|----------|
| **LangChain** | Chaining & automation | Medium | Chains, agents, tools |
| **Playground** | Quick testing | Easy | Visual, parameters |
| **LangSmith** | Monitoring | Medium | Tracing, evaluation |
| **PromptHub** | Team collaboration | Easy | Versioning, sharing |
| **Custom** | Specific needs | Hard | Fully customizable |

---

## Interview Questions & Answers

### Q10: What's the most important thing in prompt engineering?

**Answer:**

**The most important thing: Clarity**

Clarity encompasses:
1. **Clear instructions:** Model understands what you want
2. **Clear context:** Model has necessary information
3. **Clear format:** Model knows how to structure response
4. **Clear constraints:** Model knows boundaries

Why clarity matters:
```
Vague prompt → Vague response → Need many iterations → Wasted tokens
Clear prompt → Clear response → Gets it right → Efficient
```

**Example:**

```
❌ Unclear: "Summarize this article"
- What level of detail?
- How long?
- For what audience?
- What format?
Result: Random summary, may need to ask for clarification

✓ Clear: "Summarize this article in 3 bullet points 
          for a busy executive, each bullet max 1 sentence"
- Level: Key points only
- Length: 3 bullets, 1 sentence each
- Audience: Executive (no technical jargon)
- Format: Bullets, clear structure
Result: Exactly what's needed, first try
```

---

### Q11: How do you handle prompts that produce inconsistent results?

**Answer:**

**Problem:** Same prompt gives different outputs each time

**Causes:**
1. High temperature (randomness)
2. Insufficient examples
3. Ambiguous instructions
4. Model sensitivity to subtle variations

**Solutions:**

**1. Lower Temperature**

```python
# High temperature (random)
response = llm.complete(prompt, temperature=1.0)  # Random

# Low temperature (consistent)
response = llm.complete(prompt, temperature=0.0)  # Deterministic
```

**2. Add More Examples**

```
Without examples (inconsistent):
"Classify sentiment: I like it"

With examples (consistent):
"Positive: I love this
 Negative: I hate this
 
 Classify: I like it"
```

**3. Clarify Instructions**

```
Unclear: "Write a summary"
→ Length, style, audience unclear → Inconsistent

Clear: "Write a 3-sentence summary for a 6th-grader"
→ All parameters defined → Consistent
```

**4. Use Prompting Techniques**

```
Add CoT: "Explain your reasoning step by step"
Add constraints: "Use bullet points"
Add format: "Return as JSON"
```

**5. Use Seed for Reproducibility**

```python
# Same seed = same results
response1 = llm.complete(prompt, seed=42)
response2 = llm.complete(prompt, seed=42)
# response1 == response2
```

**6. Add Verification Step**

```
Step 1: Generate response
Step 2: Check against criteria
Step 3: If inconsistent with criteria, regenerate

Example:
- Generate: "Is sentiment positive?"
- Check: "Is response exactly 'Yes' or 'No'?"
- If not: "Rephrase as 'Yes' or 'No'"
```

---

### Q12: How do you prompt multi-language models?

**Answer:**

**Challenges:**
- Different languages have different structure
- Translation loses nuance
- Some languages under-represented in training

**Best Practices:**

**1. Be Explicit About Language**

```
"Answer in Spanish:
¿Cuál es la capital de Francia?"

Better than assuming model will use Spanish
```

**2. Provide Examples in Target Language**

```
Wrong:
Spanish query
English examples

Right:
Spanish query
Spanish examples
```

**3. Use Native-Language System Prompt**

```
For Spanish user:
"Eres un asistente servicial que..."

For French user:
"Tu es un assistant utile qui..."
```

**4. Be Careful with Mixed Languages**

```
Question: "What is 'machine learning' in Spanish?"
Be specific: Do you want:
- Definition of ML in Spanish?
- Or translation of "machine learning"?
```

**5. Account for Language-Specific Quirks**

```
English: "It's good" (subjective)
German: More precision/formality needed
Japanese: Context and hierarchy important
```

**Example Multilingual Prompt:**

```
System: "Vous êtes un assistant bilingue anglais-français utile."

Example 1:
English: "What's 2+2?"
French: "Combien font 2+2?"
Response: "La réponse est 4 / The answer is 4"

Now answer in French:
"Quel est la capitale de la France?"
```

---

### Q13: How do you write prompts for creative tasks?

**Answer:**

**Challenges:**
- Creativity hard to define
- Hard to evaluate
- Multiple valid solutions
- Needs fresh ideas

**Techniques:**

**1. Use High Temperature**

```python
temperature = 0.8-1.2  # More randomness for creativity
```

**2. Provide Creative Constraints**

```
Constraining actually helps creativity:

"Write a limerick about programming 
where the rhyme scheme is AABBA
and it makes a technical joke"

Constraints force creativity within bounds
```

**3. Use Analogies**

```
"Generate marketing copy for a water bottle.
Use an analogy with how water flows - 
smooth, powerful, unstoppable"
```

**4. Ask for Variations**

```
"Generate 5 different product slogans.
Each should:
- Appeal to different audience
- Use different style
- Vary in length

List all 5"
```

**5. Use Brainstorming Prompts**

```
"Brainstorm 10 creative uses for a cardboard box 
that are NOT the typical ones.
Be wild and unconventional.
Aim for surprise and delight."
```

**6. Include Style References**

```
"Write a product description in the style of:
- A 1920s advertisement
- A modern minimalist tech company
- A fantasy novel narrator"
```

**7. Chain Creative Tasks**

```
Step 1: Brainstorm ideas
Step 2: Pick 3 best ideas
Step 3: Develop each
Step 4: Combine best elements
```

**Example Creative Prompt:**

```
You are a creative director at an advertising agency.
Your client: Electric car startup

Task: Generate 3 completely different marketing campaigns

Campaign 1: Focus on [environmental impact]
Campaign 2: Focus on [performance/speed]
Campaign 3: Focus on [lifestyle/cool factor]

For each campaign:
1. Core message
2. Visual concept
3. Target audience
4. Key slogans (2-3)
5. Why it works

Make each unique and compelling.
```

---

### Q14: What are the latest prompt engineering trends?

**Answer:**

**1. Structured Output Prompting**

Explicitly ask for structured formats

```
"Return response in this JSON format:
{
  \"answer\": \"...\",
  \"confidence\": 0-100,
  \"sources\": [],
  \"reasoning\": \"...\"
}"
```

**2. Chain of Density Prompting**

Progressively more dense summaries

```
First: High-level summary
Second: Include more details
Third: Very dense, packed with info

User picks density level they prefer
```

**3. Metacognitive Prompting**

Ask model to think about its thinking

```
"Before answering, explain:
1. What knowledge do I need?
2. Do I have it?
3. What am I uncertain about?
4. How confident am I?"
```

**4. Tool-Integrated Prompting**

Built-in tool specifications

```
"You have access to:
- search_web(): Search internet
- calculator(): Perform math
- code_executor(): Run code

Use these tools to answer the question"
```

**5. Multi-Modal Prompting**

Combining text, images, audio

```
"Given this image [IMAGE] and this description [TEXT],
analyze the discrepancy"
```

**6. Persona Stacking**

Multiple roles/personas

```
"You are simultaneously:
- A data scientist (analytical)
- A business analyst (practical)
- A futurist (innovative)

Give perspective from each lens"
```

**7. Token-Efficient Prompting**

Optimize for token usage

```
Instead of:
"Please analyze this in great detail 
with multiple perspectives and examples"

Use:
"Analyze concisely"
```

**8. Prompt Caching**

Reuse common prompt parts

```
System prompt (cached, unchanged)
Context (cached, reused for similar queries)
New query (only new part, saves tokens)
```

---

### Q15: How do you prompt for code generation?

**Answer:**

**Challenges:**
- Code syntax is strict
- Logic errors break functionality
- Different languages have different styles
- Performance matters

**Best Practices:**

**1. Specify Language**

```
"Write Python code that..."
Not: "Write code that..."
```

**2. Include Requirements**

```
"Write Python function to sort a list.
Requirements:
- Time complexity: O(n log n)
- Space complexity: O(1)
- Handle edge cases (empty list, single element)
- Add docstring and type hints"
```

**3. Provide Context**

```
"Write a Python REST API endpoint that:
- Stack: FastAPI, SQLAlchemy
- Returns: JSON response
- Handles: 404 not found, validation errors
- Includes: Input validation"
```

**4. Ask for Error Handling**

```
"Write Python function with:
1. Main logic
2. Try-except blocks for errors
3. Descriptive error messages
4. Logging statements"
```

**5. Request Tests**

```
"Write function AND unit tests
Function: Sort list
Tests: Empty list, single element, duplicates,
       negative numbers, already sorted"
```

**6. Use Code Examples**

```
"Generate similar code to this pattern:
[Example code]

Now write code that:
- Follows same style
- Same error handling approach
- Same naming conventions"
```

**7. Ask for Explanation**

```
"Write code that:
1. Implements binary search
2. Works correctly
3. Has inline comments
4. Includes explanation of algorithm"
```

**Example Code Generation Prompt:**

```
You are an expert Python developer.

Write a function that:
1. Takes a list of dictionaries with 'name' and 'age' keys
2. Filters for people over 18
3. Sorts by age (descending)
4. Returns list of names

Requirements:
- Type hints (input and output)
- Docstring explaining function
- Handle empty input
- Include error handling
- Add 2-3 examples of usage

Language: Python 3.10+
Style: PEP 8 compliant
```

**Expected Quality Output:**

```python
def get_adult_names_sorted(
    people: list[dict[str, str | int]]
) -> list[str]:
    """
    Filter adults and return names sorted by age.
    
    Args:
        people: List of dicts with 'name' and 'age' keys
    
    Returns:
        Names of people 18+ sorted by age (descending)
    
    Raises:
        TypeError: If input is not list of dicts
        KeyError: If dict missing 'name' or 'age'
    """
    if not isinstance(people, list):
        raise TypeError("Input must be a list")
    
    adults = [
        person for person in people
        if isinstance(person.get('age'), int) and person['age'] >= 18
    ]
    
    return [
        person['name']
        for person in sorted(adults, key=lambda x: x['age'], reverse=True)
    ]

# Examples
print(get_adult_names_sorted([
    {'name': 'Alice', 'age': 30},
    {'name': 'Bob', 'age': 16},
    {'name': 'Charlie', 'age': 25}
]))
# Output: ['Alice', 'Charlie']
```

---

## Summary & Best Practices

**Core Principles:**
1. **Clarity is king:** Clear > Clever
2. **Specific is better:** More details = better results
3. **Examples help:** Few examples → Big improvement
4. **Context matters:** Provide relevant background
5. **Format explicitly:** Structured output is easier
6. **Iterate:** Refine based on results
7. **Optimize:** Balance quality and cost
8. **Test thoroughly:** Try different inputs

**Quick Prompt Quality Checklist:**

```
□ Clear, specific instructions
□ Relevant context provided
□ Output format defined
□ Examples provided (if needed)
□ Role defined (if applicable)
□ Constraints specified
□ Temperature appropriate
□ Error cases considered
□ Tested on multiple inputs
□ Optimized for efficiency
```

**Workflow:**

```
1. Start simple
2. Test with diverse inputs
3. Identify failures
4. Refine specific parts
5. Re-test
6. Deploy
7. Monitor quality
8. Iterate based on feedback
```

**Resources for Learning:**

- OpenAI Prompt Engineering Guide
- Anthropic's Prompt Engineering Documentation
- LangChain Documentation
- Prompt Engineering Reddit (r/PromptEngineering)
- Papers: "Prompting as Programming"

Good luck with your prompt engineering interviews!
