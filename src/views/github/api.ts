import { CommitComment, IssueComment, ReviewComment, Post } from './utils';
import { setTimeout } from 'timers';
import { Comment } from './utils';

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getOctokit(token: string) {
    const octokit = await import('octokit');
    const octo = new octokit.Octokit({
        auth: token
    });
    return octo;
}

export async function getPRsRelatedToCommit(commit: string, token: string, repo: string, owner: string): Promise<number[]> {
    try {
        const octokit = await getOctokit(token);
        const response = await octokit.request('GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls', {
            owner: owner,
            repo: repo,
            commit_sha: commit,
            headers: {
                'X-GitHub-Api-Version': '2022-11-28'
            }
        });
        return response.data.map(pr => pr.number);
    } catch(err) {
        console.log(err);
    }
    return [];
}

function extractNumberHashtags(input: string): number[] {
    const regex = /(#|issue|pull)[\/]?\d+/gi;  // 匹配 #、issue 或 pull 后面跟数字
    const matches = input.match(regex);
    return matches ? matches.map(match => {
        const numberPart = match.replace(/\D/g, '');  // 去掉非数字字符，保留数字
        return Number(numberPart);
    }) : [];
}


export async function getIssuesRelatedToPR(pr: number, token: string, repo: string, owner: string): Promise<number[]> {
    try {
        const tb = await getPRTitleAndBody(pr, token, repo, owner);
        let res = [...extractNumberHashtags(tb[0]), ...extractNumberHashtags(tb[1])];
        let uniqueRes = [...new Set(res)];
        return uniqueRes;
    } catch(err) {
        console.log(err);
    }
    return [];
}

export async function getIssueComments(issue: number, token: string, repo: string, owner: string): Promise<IssueComment[]> {
    try {
        const octokit = await getOctokit(token);
        const response = await octokit.request('GET /repos/{owner}/{repo}/issues/{issue_number}/comments', {
            owner: owner,
            repo: repo,
            issue_number: issue,
            headers: {
              'X-GitHub-Api-Version': '2022-11-28'
            }
        });
        return response.data.map(comment => new IssueComment(comment.user!.login, comment.body!, issue));
    } catch(err) {
        console.log(err);
    }
    return [];
}

export async function getCommitComments(commit: string, token: string, repo: string, owner: string): Promise<CommitComment[]> {
    try {
        const octokit = await getOctokit(token);
        const response = await octokit.request('GET /repos/{owner}/{repo}/commits/{commit_sha}/comments', {
            owner: owner,
            repo: repo,
            commit_sha: commit,
            headers: {
              'X-GitHub-Api-Version': '2022-11-28'
            }
        });
        return response.data.map(comment => new CommitComment(comment.user!.login, comment.body, comment.commit_id, comment.path));
    } catch(err) {
        console.log(err);
    }
    return [];
}

export async function getReviewComments(pr: number, token: string, repo: string, owner: string): Promise<ReviewComment[]> {
    try {
        const octokit = await getOctokit(token);
        const response = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/comments', {
            owner: owner,
            repo: repo,
            pull_number: pr,
            headers: {
              'X-GitHub-Api-Version': '2022-11-28'
            }
        });
        return response.data.map(comment => new ReviewComment(comment.user!.login, comment.body, comment.id, comment.in_reply_to_id ?? null, comment.diff_hunk, comment.path, comment.original_commit_id, comment.commit_id));
    } catch(err) {
        console.log(err);
    }
    
    return [];
}

export async function getPRTitleAndBody(pr: number, token: string, repo: string, owner: string): Promise<string[]> {
    try {
        const octokit = await getOctokit(token);
        const response = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
            owner: owner,
            repo: repo,
            pull_number: pr,
            headers: {
              'X-GitHub-Api-Version': '2022-11-28'
            }
        });
        let ret: string[] = [];
        ret.push(response.data.title);
        ret.push(response.data.body ?? '');
        return ret;
    } catch(err) {
        console.log(err);
    }
    return [];
}

export async function getIssueTitleAndBody(issue: number, token: string, repo: string, owner: string): Promise<string[]> {
    try {
        const octokit = await getOctokit(token);
        const response = await octokit.request('GET /repos/{owner}/{repo}/issues/{issue_number}', {
            owner: owner,
            repo: repo,
            issue_number: issue,
            headers: {
              'X-GitHub-Api-Version': '2022-11-28'
            }
        });
        let ret: string[] = [];
        ret.push(response.data.title);
        ret.push(response.data.body ?? '');
        return ret;
    } catch(err) {
        console.log(err);
    }
    return [];
}

export async function getCommitsRelatedToPR(pr: number, token: string, repo: string, owner: string): Promise<string[]> {
    try {
        const octokit = await getOctokit(token);
        const response = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/commits', {
            owner: owner,
            repo: repo,
            pull_number: pr,
            headers: {
                'X-GitHub-Api-Version': '2022-11-28'
            }
        });
        return response.data.map(commit => commit.sha);
    } catch (err) {
        console.log(err);
    }
    return [];
}

export async function summarizeConversation(prompt: {role: string; content: string}, posts: Post[], nameLLM: string, keyLLM: string): Promise<string> {
    if(nameLLM === 'deepseek-coder-v3') {
        const options = {
            method: 'POST',
            headers: {
              Authorization: keyLLM,
              'Content-Type': 'application/json'
            },
            body: `{"model":"Pro/deepseek-ai/DeepSeek-V3","messages":[${JSON.stringify(prompt)}],"max_tokens":4096}`
          };
          try {
            let response = await fetch('https://api.siliconflow.cn/v1/chat/completions', options);
            let data = await response.json();
            console.log(data);
            while(data.message) {
                console.log('exceed limit: ' + data.message);
                await sleep(61000);
                response = await fetch('https://api.siliconflow.cn/v1/chat/completions', options);
                data = await response.json();
            }
            const txt = data.choices[0].message.content;
            return txt;
          } catch(err) {
            console.log(err);
          }
    } else {
        console.log('no supported LLM');
    }
    return "";
}

export async function multipleChat(messages: {sender: string; text: string}[], nameLLM: string, keyLLM: string): Promise<string> {
    console.log(messages);
    if(nameLLM === 'deepseek-coder-v3') {
        const options = {
            method: 'POST',
            headers: {
              Authorization: keyLLM,
              'Content-Type': 'application/json'
            },
            body: `{"model":"Pro/deepseek-ai/DeepSeek-V3","messages":${JSON.stringify(messages.map(mes => {
                return {'role': mes.sender === 'User' ? 'user' : 'assistant', 'content': mes.text};
            }))},"max_tokens":4096}`
          };
          try {
            let response = await fetch('https://api.siliconflow.cn/v1/chat/completions', options);
            let data = await response.json();
            console.log(data);
            while(data.message) {
                console.log('exceed limit: ' + data.message);
                await sleep(61000);
                response = await fetch('https://api.siliconflow.cn/v1/chat/completions', options);
                data = await response.json();
            }
            const txt = data.choices[0].message.content;
            return txt;
          } catch(err) {
            console.log(err);
          }
    } else {
        console.log('no supported LLM');
    }
    return "";
}

export async function getPosts(commit: string, token: string, repo: string, owner: string): Promise<Post[]> {
  const posts = [];
  console.log('getting prs');
  let prs = await getPRsRelatedToCommit(commit, token, repo, owner);
  for(let pr of prs) {
      let issueComments = await getIssueComments(pr, token, repo, owner);
      let reviewComments = await getReviewComments(pr, token, repo, owner);
      let comments: Comment[] = [];
      comments.push(...issueComments);
      comments.push(...reviewComments);
      let tb = await getPRTitleAndBody(pr, token, repo, owner);
      posts.push(new Post('Pull Request', pr, tb[0], tb[1], comments));
  }
  console.log(prs);

  console.log('getting commits');
  const commits = [];
  for(let pr of prs) {
    const cmts = await getCommitsRelatedToPR(pr, token, repo, owner);
    commits.push(...cmts);
  }

  console.log('getting commit comments');
  for(let commit of commits) {
      let commitComments = await getCommitComments(commit, token, repo, owner);
      if(commitComments.length > 0) {
        posts.push(new Post('CommitComment', -1, `commit SHA: ${commit}`, '', commitComments));
      }
  }

  console.log('getting issues');
  for(let pr of prs) {
      let iss = await getIssuesRelatedToPR(pr, token, repo, owner);
      console.log(iss);
      for(let issue of iss) {
          if(posts.find((p, i) => p.id === issue)) {
            continue;
          }
          let issueComments = await getIssueComments(issue, token, repo, owner);
          let tb = await getIssueTitleAndBody(issue, token, repo, owner);
          posts.push(new Post('Issue', issue, tb[0], tb[1], issueComments));
      }
  }
  return posts;
}