# PokerBench: A Texas Hold'em Arena-style LLM Benchmark

![](runs/Gemini_Flash_and_Pro_Heads_Up/stack_history.png)

**PokerBench** establishes a high-frequency, adversarial, and imperfect-information environment: a No-Limit Texas Hold’em (NLTH) tournament. PokerBench places frontier models - including Claude Opus, Gemini 3, and GPT-5.2 - into direct competition. This introduces a "Theory of Mind" requirement; agents must not only manage their own state (chips, cards) but also model the epistemic states and strategies of hostile actors [[1]](https://arxiv.org/html/2309.17277v3).

The complexity of NLTH, with a game tree exceeding $10^{160}$ decision points, forces the LLM to integrate probability estimation (pot odds), resource management (stack depth), and deceptive capability (bluffing) simultaneously [[2]](https://arxiv.org/html/2501.08328v2).

The benchmark simulates a large number of independent games, each lasting 150 hands or until one player accumulates all chips. This scale is necessary to dampen the extreme variance inherent in NLTH and achieve statistical significance in the primary metric: stack size [[3]](https://www.primedope.com/poker-variance-calculator/).

## Important Notes

All of the runs are stored in JSON files in runs/ and can be inspected. You may also generate your own runs using pokerbench-runner/pokerbench.py. Contributions and bug-fixes are welcome.

Try out https://pokerbench.adfontes.io/ for game visualizations, stats, etc.

**Sources:**
1. [Suspicion-Agent: Playing Imperfect Information Games with Theory of Mind Aware GPT-4](https://arxiv.org/html/2309.17277v3)
2. [PokerBench: Training Large Language Models to become Professional Poker Players](https://arxiv.org/html/2501.08328v2)
3. [Poker Variance Calculator](https://www.primedope.com/poker-variance-calculator/)

Note: This project is licensed under the MIT License with the Commons Clause restriction. Commercial use and redistribution for a fee require explicit permission. Reach out to [x.com/adfontes_](https://x.com/adfontes_) for more information.
