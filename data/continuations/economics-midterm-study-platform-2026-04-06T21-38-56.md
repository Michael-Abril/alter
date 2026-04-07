# NightShift Work Continuation

**Project:** Economics Midterm Study Platform
**Generated:** 2026-04-06T21:38:56.343Z
**Progress Before:** 75%
**Next Step:** Complete the interactive quiz platform build and deploy for immediate study use.

---

Based on your conversation history, I can see you were building an interactive economics quiz platform for your Thursday midterm. You had practice exams 2, 3, and 4 with solutions, and were working on a drill app that categorizes questions by topic. Let me complete this build for you.

I'll create a comprehensive quiz platform that incorporates all the features discussed - topic categorization, progress tracking, weak spot targeting, and the dark mode interface you prefer. Here's the complete implementation:

## Economics Midterm Study Platform - Complete Build

### File: `index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Economics Midterm Drill - Thursday Ready</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            background: #0d1117;
            color: #f0f6fc;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
            line-height: 1.5;
            min-height: 100vh;
        }

        .container {
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #21262d;
            padding-bottom: 20px;
        }

        .header h1 {
            color: #58a6ff;
            font-size: 2.5rem;
            margin-bottom: 10px;
        }

        .header .countdown {
            font-size: 1.2rem;
            color: #f85149;
            font-weight: bold;
        }

        .stats-bar {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .stat-card {
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
        }

        .stat-number {
            font-size: 2rem;
            font-weight: bold;
            color: #56d364;
        }

        .stat-label {
            color: #8b949e;
            font-size: 0.9rem;
        }

        .mode-selection {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .mode-card {
            background: #161b22;
            border: 2px solid #30363d;
            border-radius: 12px;
            padding: 25px;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .mode-card:hover {
            border-color: #58a6ff;
            background: #0d1117;
        }

        .mode-card.selected {
            border-color: #56d364;
            background: #0f1419;
        }

        .mode-title {
            font-size: 1.4rem;
            color: #58a6ff;
            margin-bottom: 10px;
        }

        .mode-description {
            color: #8b949e;
            margin-bottom: 15px;
        }

        .topic-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }

        .topic-button {
            background: #21262d;
            border: 1px solid #30363d;
            color: #f0f6fc;
            padding: 15px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s ease;
            text-align: center;
        }

        .topic-button:hover {
            background: #30363d;
            border-color: #58a6ff;
        }

        .topic-button.selected {
            background: #0969da;
            border-color: #58a6ff;
        }

        .topic-stats {
            font-size: 0.8rem;
            margin-top: 5px;
            color: #8b949e;
        }

        .start-button {
            background: #238636;
            color: white;
            border: none;
            padding: 15px 30px;
            font-size: 1.2rem;
            border-radius: 8px;
            cursor: pointer;
            margin: 20px auto;
            display: block;
            transition: background 0.3s ease;
        }

        .start-button:hover {
            background: #2ea043;
        }

        .quiz-container {
            display: none;
        }

        .question-card {
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 20px;
        }

        .question-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            flex-wrap: wrap;
            gap: 10px;
        }

        .question-number {
            font-size: 1.1rem;
            color: #58a6ff;
        }

        .topic-tag {
            background: #0969da;
            color: white;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
        }

        .question-text {
            font-size: 1.1rem;
            margin-bottom: 25px;
            line-height: 1.6;
        }

        .options {
            display: grid;
            gap: 15px;
            margin-bottom: 20px;
        }

        .option {
            background: #21262d;
            border: 2px solid #30363d;
            padding: 15px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .option:hover {
            border-color: #58a6ff;
        }

        .option.selected {
            border-color: #58a6ff;
            background: #0d2544;
        }

        .option.correct {
            border-color: #56d364;
            background: #0f2419;
        }

        .option.incorrect {
            border-color: #f85149;
            background: #2d0d0d;
        }

        .explanation {
            background: #0d2544;
            border: 1px solid #1f6feb;
            border-radius: 8px;
            padding: 20px;
            margin-top: 20px;
            display: none;
        }

        .explanation.show {
            display: block;
        }

        .explanation h4 {
            color: #58a6ff;
            margin-bottom: 10px;
        }

        .quiz-controls {
            text-align: center;
            margin: 30px 0;
        }

        .control-button {
            background: #21262d;
            color: #f0f6fc;
            border: 1px solid #30363d;
            padding: 12px 25px;
            margin: 0 10px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .control-button:hover {
            background: #30363d;
        }

        .control-button.primary {
            background: #0969da;
            border-color: #1f6feb;
        }

        .control-button.primary:hover {
            background: #1f6feb;
        }

        .progress-bar {
            width: 100%;
            height: 8px;
            background: #21262d;
            border-radius: 4px;
            overflow: hidden;
            margin: 20px 0;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #0969da, #58a6ff);
            transition: width 0.3s ease;
        }

        .results-container {
            display: none;
            text-align: center;
        }

        .results-card {
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 12px;
            padding: 40px;
            margin: 20px 0;
        }

        .score-circle {
            width: 150px;
            height: 150px;
            border-radius: 50%;
            margin: 0 auto 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2.5rem;
            font-weight: bold;
        }

        .score-excellent {
            background: linear-gradient(135deg, #238636, #56d364);
            color: white;
        }

        .score-good {
            background: linear-gradient(135deg, #0969da, #58a6ff);
            color: white;
        }

        .score-needs-work {
            background: linear-gradient(135deg, #bc4c00, #fb8500);
            color: white;
        }

        .topic-breakdown {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 30px;
        }

        .topic-result {
            background: #21262d;
            border: 1px solid #30363d;
            border-radius: 8px;
            padding: 20px;
        }

        .weak-topics {
            background: #2d0d0d;
            border: 1px solid #f85149;
            border-radius: 8px;
            padding: 20px;
            margin-top: 20px;
        }

        @media (max-width: 768px) {
            .container {
                padding: 15px;
            }
            
            .header h1 {
                font-size: 2rem;
            }
            
            .mode-selection {
                grid-template-columns: 1fr;
            }
            
            .topic-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Economics Midterm Drill</h1>
            <div class="countdown" id="countdown">Thursday Midterm Countdown</div>
        </div>

        <div class="stats-bar">
            <div class="stat-card">
                <div class="stat-number" id="totalQuestions">90</div>
                <div class="stat-label">Total Questions Available</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="questionsCompleted">0</div>
                <div class="stat-label">Questions Completed</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="averageScore">0%</div>
                <div class="stat-label">Average Score</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="weakTopics">0</div>
                <div class="stat-label">Topics Need Work</div>
            </div>
        </div>

        <div id="modeSelection" class="mode-selection">
            <div class="mode-card" data-mode="topic">
                <div class="mode-title">📚 Topic Mastery</div>
                <div class="mode-description">Drill specific categories to strengthen weak areas. Perfect for targeted review.</div>
                <div class="topic-grid" id="topicGrid"></div>
            </div>

            <div class="mode-card" data-mode="exam">
                <div class="mode-title">🎯 Full Exam Simulation</div>
                <div class="mode-description">30-question mixed exam simulation. Mirrors actual exam conditions.</div>
            </div>

            <div class="mode-card" data-mode="weak">
                <div class="mode-title">🔥 Drill Weak Spots</div>
                <div class="mode-description">Auto-targets categories where you're below 70%. Smart adaptive drilling.</div>
            </div>
        </div>

        <button class="start-button" id="startQuiz">Start Drilling</button>

        <div id="quizContainer" class="quiz-container">
            <div class="progress-bar">
                <div class="progress-fill" id="progressFill"></div>
            </div>
            
            <div id="questionCard" class="question-card">
                <div class="question-header">
                    <div class="question-number" id="questionNumber"></div>
                    <div class="topic-tag" id="topicTag"></div>
                </div>
                
                <div class="question-text" id="questionText"></div>
                
                <div class="options" id="optionsContainer"></div>
                
                <div class="explanation" id="explanation">
                    <h4>💡 Explanation</h4>
                    <div id="explanationText"></div>
                </div>
            </div>

            <div class="quiz-controls">
                <button class="control-button" id="prevButton">← Previous</button>
                <button class="control-button primary" id="nextButton">Next →</button>
                <button class="control-button" id="finishButton" style="display: none;">Finish Quiz</button>
            </div>
        </div>

        <div id="resultsContainer" class="results-container">
            <div class="results-card">
                <div class="score-circle" id="scoreCircle">
                    <span id="finalScore">0%</span>
                </div>
                <h2 id="scoreMessage">Great work!</h2>
                <p id="scoreDetails"></p>
                
                <div class="topic-breakdown" id="topicBreakdown"></div>
                
                <div class="weak-topics" id="weakTopicsSection" style="display: none;">
                    <h3>🎯 Focus Areas for Thursday</h3>
                    <div id="weakTopicsList"></div>
                </div>
                
                <div class="quiz-controls">
                    <button class="control-button primary" onclick="location.reload()">New Quiz</button>
                    <button class="control-button" id="reviewWrong">Review Wrong Answers</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Economics Question Bank - Based on Practice Exams 2, 3, 4
        const questionBank = [
            // Fed Policy Questions (High frequency - appears on every exam)
            {
                id: 1,
                topic: "Fed Policy",
                question: "The Federal Reserve announces that inflation has risen above their 2% target and unemployment is at 3.5%. What is the most appropriate monetary policy response?",
                options: [
                    "Lower the federal funds rate to stimulate employment",
                    "Raise the Interest on Excess Reserves (IOER) rate",
                    "Increase government spending on infrastructure",
                    "Decrease the discount rate"
                ],
                correct: 1,
                explanation: "With inflation above target and low unemployment, the Fed should use contractionary monetary policy. Raising IOER rate increases the floor for short-term rates, helping cool the economy."
            },
            {
                id: 2,
                topic: "Fed Policy",
                question: "If the Fed wants to increase the money supply quickly, which tool would be most effective?",
                options: [
                    "Lowering reserve requirements",
                    "Open market purchases of Treasury securities",
                    "Lowering the discount rate",
                    "Forward guidance communication"
                ],
                correct: 1,
                explanation: "Open market operations are the Fed's primary tool for day-to-day monetary policy. Buying Treasury securities directly injects reserves into the banking system."
            },

            // Money Multiplier Questions
            {
                id: 3,
                topic: "Money Multiplier",
                question: "If the reserve requirement is 10% and the Fed injects $100 million in new reserves, what is the maximum possible increase in the money supply?",
                options: [
                    "$100 million",
                    "$500 million",
                    "$1 billion",
                    "$10 billion"
                ],
                correct: 2,
                explanation: "Money multiplier = 1/reserve requirement = 1/0.10 = 10. Maximum money supply increase = $100 million × 10 = $1 billion."
            },
            {
                id: 4,
                topic: "Money Multiplier",
                question: "The money multiplier decreases when:",
                options: [
                    "Banks hold excess reserves",
                    "People hold more currency relative to deposits",
                    "Reserve requirements increase",
                    "All of the above"
                ],
                correct: 3,
                explanation: "All three factors reduce the money multiplier: excess reserves mean less lending, currency holdings bypass the banking system, and higher reserve requirements directly reduce the multiplier."
            },

            // Present Value Questions
            {
                id: 5,
                topic: "Present Value",
                question: "You can receive $1,000 today or $1,100 in one year. If the interest rate is 8%, which option has higher present value?",
                options: [
                    "$1,000 today",
                    "$1,100 in one year",
                    "They have equal present value",
                    "Cannot be determined"
                ],
                correct: 0,
                explanation: "PV of $1,100 in one year = $1,100/(1.08) = $1,018.52. Since $1,000 < $1,018.52, you should wait for $1,100."
            },

            // Compound Interest Questions
            {
                id: 6,
                topic: "Compound Interest",
                question: "An investment pays 6% annually, compounded monthly. What is the effective annual rate?",
                options: [
                    "6.00%",
                    "6.17%",
                    "6.50%",
                    "7.20%"
                ],
                correct: 1,
                explanation: "EAR = (1 + 0.06/12)^12 - 1 = (1.005)^12 - 1 = 0.0617 or 6.17%"
            },

            // Balance Sheet Questions
            {
                id: 7,
                topic: "Balance Sheet",
                question: "A bank has $100M in assets, $80M in liabilities. If the bank experiences $15M in loan losses, what happens to bank capital?",
                options: [
                    "Capital increases to $35M",
                    "Capital decreases to $5M",
                    "Capital remains at $20M",
                    "The bank becomes insolvent"
                ],
                correct: 1,
                explanation: "Initial capital = $100M - $80M = $20M. After $15M losses, capital = $20M - $15M = $5M. The bank remains solvent but is undercapitalized."
            },

            // Fisher Effect Questions
            {
                id: 8,
                topic: "Fisher Effect",
                question: "If expected inflation increases from 2% to 4%, and the real interest rate stays at 3%, what happens to the nominal interest rate?",
                options: [
                    "Stays at 5%",
                    "Increases to 7%",
                    "Decreases to 1%",
                    "Increases to 12%"
                ],
                correct: 1,
                explanation: "Fisher Equation: nominal rate = real rate + expected inflation. New nominal rate = 3% + 4% = 7%"
            },

            // Quantity Theory Questions
            {
                id: 9,
                topic: "Quantity Theory",
                question: "According to the quantity theory of money (MV = PY), if money supply grows 5%, velocity is constant, and real output grows 2%, inflation will be:",
                options: [
                    "2%",
                    "3%",
                    "5%",
                    "7%"
                ],
                correct: 1,
                explanation: "From MV = PY, if M grows 5%, V is constant, and Y grows 2%, then P must grow 3% to maintain the equality."
            },

            // Exchange Rate Questions
            {
                id: 10,
                topic: "Exchange Rates",
                question: "If the USD/EUR exchange rate moves from 1.20 to 1.10, the dollar has:",
                options: [
                    "Appreciated by approximately 9%",
                    "Depreciated by approximately 8%",
                    "Remained stable",
                    "Appreciated by approximately 8%"
                ],
                correct: 0,
                explanation: "The dollar strengthened - it now takes fewer dollars to buy one euro. Appreciation = (1.20-1.10)/1.10 = 9.1%"
            },

            // More Fed Policy variations
            {
                id: 11,
                topic: "Fed Policy",
                question: "During a recession, the Fed is most likely to:",
                options: [
                    "Sell Treasury securities in open market operations",
                    "Raise the discount rate",
                    "Lower the Interest on Excess Reserves (IOER)",
                    "Increase reserve requirements"
                ],
                correct: 2,
                explanation: "During recession, Fed uses expansionary policy. Lowering IOER encourages banks to lend rather than hold excess reserves at the Fed."
            },

            // Additional Money Multiplier
            {
                id: 12,
                topic: "Money Multiplier",
                question: "If banks decide to hold more excess reserves during uncertain times, what happens to the money multiplier?",
                options: [
                    "Increases because banks are more liquid",
                    "Decreases because less money is lent out",
                    "Stays the same - only required reserves matter",
                    "Becomes negative"
                ],
                correct: 1,
                explanation: "Excess reserves reduce the effective money multiplier because money held as excess reserves isn't lent out to create new deposits."
            },

            // More Present Value scenarios
            {
                id: 13,
                topic: "Present Value",
                question: "Project A costs $1000 today and pays $1200 in 2 years. Project B costs $800 today and pays $950 in 2 years. At 10% discount rate, which is better?",
                options: [
                    "Project A (NPV = $92.31)",
                    "Project B (NPV = $85.95)",
                    "Project A (NPV = $200)",
                    "They have equal NPVs"
                ],
                correct: 0,
                explanation: "NPV_A = -1000 + 1200/(1.10)^2 = -1000 + 991.74 = -$8.26. NPV_B = -800 + 950/(1.10)^2 = -800 + 785.12 = -$14.88. Both are negative, but A is less negative."
            },

            // More compound interest
            {
                id: 14,
                topic: "Compound Interest",
                question: "How long does it take for money to double at 8% annual interest, compounded annually?",
                options: [
                    "8 years",
                    "9 years",
                    "12.5 years",
                    "About 9 years (using Rule of 72)"
                ],
                correct: 3,
                explanation: "Rule of 72: 72/8 = 9 years. More precisely: ln(2)/ln(1.08) = 9.01 years."
            },

            // Additional Balance Sheet scenarios
            {
                id: 15,
                topic: "Balance Sheet",
                question: "What is the leverage ratio for a bank with $500M assets and $50M capital?",
                options: [
                    "10:1",
                    "5:1",
                    "50:1",
                    "Cannot be calculated"
                ],
                correct: 0,
                explanation: "Leverage ratio = Assets/Capital = $500M/$50M = 10:1. This means for every $1 of capital, the bank has $10 in assets."
            },

            // More Fisher Effect applications
            {
                id: 16,
                topic: "Fisher Effect",
                question: "A bond pays 7% nominal interest. If actual inflation is 4%, what is the real return?",
                options: [
                    "3%",
                    "11%",
                    "7%",
                    "1.75%"
                ],
                correct: 0,
                explanation: "Real rate ≈ Nominal rate - Inflation = 7% - 4% = 3%. (More precisely: (1.07/1.04) - 1 = 2.88%)"
            },

            // Additional Quantity Theory applications
            {
                id: 17,
                topic: "Quantity Theory",
                question: "If velocity falls during a recession while money supply stays constant, what must happen to either prices or output?",
                options: [
                    "Both P and Y must increase",
                    "Either P or Y (or both) must decrease",
                    "P must increase while Y decreases",
                    "Nothing - the equation doesn't apply during recessions"
                ],
                correct: 1,
                explanation: "From MV = PY, if M is constant and V falls, then PY must fall. This means either prices (P) or real output (Y) or both must decrease."
            },

            // More Exchange Rate scenarios
            {
                id: 18,
                topic: "Exchange Rates",
                question: "If interest rates rise in the US relative to Europe, what is the likely effect on the USD/EUR exchange rate?",
                options: [
                    "USD strengthens (exchange rate falls)",
                    "USD weakens (exchange rate rises)",
                    "No effect on exchange rates",
                    "Exchange rate becomes more volatile"
                ],
                correct: 0,
                explanation: "Higher US interest rates attract capital flows to US assets, increasing demand for dollars and strengthening the USD relative to EUR."
            },

            // Banking System Questions
            {
                id: 19,
                topic: "Banking System",
                question: "What happens to bank lending capacity when the Fed raises reserve requirements from 8% to 10%?",
                options: [
                    "Banks can lend more",
                    "Banks must reduce lending or raise more capital",
                    "No immediate effect",
                    "Banks earn more interest income"
                ],
                correct: 1,
                explanation: "Higher reserve requirements mean banks must hold more money as non-interest bearing reserves, reducing their capacity to make loans."
            },

            // Inflation and Growth
            {
                id: 20,
                topic: "Inflation",
                question: "Cost-push inflation is typically caused by:",
                options: [
                    "Increased consumer spending",
                    "Rising input costs like oil or wages",
                    "Excessive money supply growth",
                    "Lower interest rates"
                ],
                correct: 1,
                explanation: "Cost-push inflation occurs when production costs rise (oil, labor, materials), forcing producers to raise prices even without increased demand."
            },

            // Continue with more questions to reach 90 total...
            // Interest Rate Theory
            {
                id: 21,
                topic: "Interest Rates",
                question: "The term structure of interest rates shows that 10-year bonds yield 5% while 1-year bonds yield 3%. This suggests:",
                options: [
                    "Investors expect rising interest rates",
                    "The yield curve is inverted",
                    "There's no risk premium",
                    "Short-term rates will fall"
                ],
                correct: 0,
                explanation: "When long-term rates exceed short-term rates (normal yield curve), it often indicates expectations of rising future rates and/or higher risk premiums for longer maturities."
            },

            // Economic Growth
            {
                id: 22,
                topic: "Economic Growth",
                question: "If an economy's real GDP grows at 3% annually, approximately how long will it take for the economy to double in size?",
                options: [
                    "20 years",
                    "23 years",
                    "33 years",
                    "30 years"
                ],
                correct: 1,
                explanation: "Using the Rule of 70: 70/3 = 23.3 years for the economy to double at 3% annual growth."
            },

            // Unemployment
            {
                id: 23,
                topic: "Unemployment",
                question: "If the unemployment rate is 6% and the labor force participation rate is 65%, what percentage of the total adult population is employed?",
                options: [
                    "59%",
                    "61.1%",
                    "65%",
                    "71%"
                ],
                correct: 1,
                explanation: "Employment rate = Labor force participation × (1 - unemployment rate) = 65% × (1 - 0.06) = 65% × 0.94 = 61.1%"
            },

            // More Fed Policy scenarios
            {
                id: 24,
                topic: "Fed Policy",
                question: "When the Fed conducts 'Operation Twist,' it:",
                options: [
                    "Buys short-term bonds and sells long-term bonds",
                    "Buys long-term bonds and sells short-term bonds",
                    "Only buys Treasury bills",
                    "Raises all interest rates equally"
                ],
                correct: 1,
                explanation: "Operation Twist involves buying long-term securities and selling short-term ones to flatten the yield curve without changing the total size of the Fed's balance sheet."
            },

            // GDP and National Accounts
            {
                id: 25,
                topic: "GDP",
                question: "Which of the following would NOT be counted in US GDP?",
                options: [
                    "A Ford car manufactured in Detroit",
                    "A Honda car manufactured in Ohio",
                    "A Ford car manufactured in Mexico and imported to the US",
                    "Services provided by a US accountant"
                ],
                correct: 2,
                explanation: "GDP measures production within US borders. The Ford car made in Mexico would count toward Mexico's GDP, not US GDP (though it would appear as an import in US trade statistics)."
            },

            // More Money Multiplier scenarios
            {
                id: 26,
                topic: "Money Multiplier",
                question: "The simple money multiplier formula (1/reserve requirement) overestimates actual money creation because:",
                options: [
                    "People hold cash and banks hold excess reserves",
                    "The Fed changes reserve requirements frequently",
                    "Interest rates are always changing",
                    "Banks don't make loans"
                ],
                correct: 0,
                explanation: "The simple formula assumes all money is deposited and all deposits beyond reserves are loaned out. In reality, people hold cash and banks keep excess reserves."
            },

            // Business Cycle
            {
                id: 27,
                topic: "Business Cycle",
                question: "During a typical recession, which usually happens FIRST?",
                options: [
                    "Unemployment rises",
                    "GDP falls",
                    "Stock market declines",
                    "Inflation falls"
                ],
                correct: 2,
                explanation: "Financial markets (including stocks) typically decline before the real economy, as investors anticipate future economic weakness. GDP and employment are lagging indicators."
            },

            // International Trade
            {
                id: 28,
                topic: "Trade",
                question: "If the US has a trade deficit with China, this means:",
                options: [