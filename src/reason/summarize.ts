import * as github from '../github/api';
import * as chat from '../chat/api';
import { Comment, IssueComment, ReviewComment, Post } from '../github/utils';
import { MethodLevelHistory } from '../history/codeshovel';

export async function queryReason(h1: MethodLevelHistory, h2: MethodLevelHistory) {
    let posts: Post[] = [];

    let prs = await github.getPRsRelatedToCommit(h2.commit.hash);
    for(let pr of prs) {
        let issueComments = await github.getIssueComments(pr);
        let reviewComments = await github.getReviewComments(pr);
        let comments: Comment[] = [];
        comments.push(...issueComments);
        comments.push(...reviewComments);
        let tb = await github.getPRTitleAndBody(pr);
        posts.push(new Post('Pull Request', pr, tb[0], tb[1], comments));
    }


    for(let pr of prs) {
        let iss = await github.getIssuesRelatedToPR(pr);
        for(let issue of iss) {
            let issueComments = await github.getIssueComments(issue);
            let tb = await github.getIssueTitleAndBody(issue);
            posts.push(new Post('Issue', issue, tb[0], tb[1], issueComments));
        }
    }
    console.log(posts);
    let sum = await chat.summarizeConversation(h1.method, h2.method, posts);
    console.log(sum);
}