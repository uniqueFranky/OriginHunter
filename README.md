# OriginHunter 

This is a vscode extension for discovering origins of code changes.

## Motivation

In open source collaboration platforms such as GitHub, developers record the thinking, trade-offs and decision-making process behind the changes in detail in the discussion of Issues and Pull Requests. For example, the review feedback in the PR may include optimization suggestions for the implementation method, and the comments in the Issue often reveal the motivation for adding new features or the deep reasons for fixing bugs. However, these discussion information is scattered and not easy to be directly associated with specific code. Traditional version control tools often cannot effectively integrate this information, resulting in developers spending a lot of time manually retrieving these contents to fully understand the background of code changes.

The goal of this project is to develop an automated code traceability and change motivation analysis system to help developers systematically track the complete change history of specific code snippets, and mine the discussion content in PRs and Issues to reveal the deep-seated reasons and technical decisions behind code changes.

## Roadmap

1. Mining the complete history (associated with commits) of the selected code snippet (may include methods, classes or/and blocks).
2. Mining the PRs and Issues behind the corresponding commits.
3. Analysing the discussions in PRs and Issues (probably via LLMs).
4. Drawing a timeline to display the changes and the underlying deep-seated reasons and technical decisions.

## Todo List
(for now)

- [x] Integrating Git Extension of vscode
- [ ] Integrating Tree-Sitter for parsing codes
- [ ] Implementing CodeShovel(ICSE'21) for method-level history mining.
- [ ] Implementing crawlers for mining related PRs and Issues and discussions.
- [ ] Leveraging LLMs for analyzing discussions.
- [ ] Drawing a timeline to display the results.



## References
[1] F. Grund, S. A. Chowdhury, N. C. Bradley, B. Hall and R. Holmes, "CodeShovel: Constructing Method-Level Source Code Histories," 2021 IEEE/ACM 43rd International Conference on Software Engineering (ICSE), Madrid, ES, 2021, pp. 1510-1522, doi: 10.1109/ICSE43902.2021.00135.

[2] N. Tsantalis, A. Ketkar and D. Dig, "RefactoringMiner 2.0," in IEEE Transactions on Software Engineering, vol. 48, no. 3, pp. 930-950, 1 March 2022, doi: 10.1109/TSE.2020.3007722.

[3] Emre Sülün, Metehan Saçakçı, and Eray Tüzün. 2024. An Empirical Analysis of Issue Templates Usage in Large-Scale Projects on GitHub. ACM Trans. Softw. Eng. Methodol. 33, 5, Article 117 (June 2024), 28 pages. https://doi.org/10.1145/3643673

