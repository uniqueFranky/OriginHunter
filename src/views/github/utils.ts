export class Comment {
    type: string;
    user: string;
    body: string;
    constructor(type: string, user: string, body: string) {
        this.type = type;
        this.user = user;
        this.body = body;
    }
}

export class CommitComment extends Comment {
    commit: string;
    path: string | null;
    constructor(user: string, body: string, commit: string, path: string | null) {
        super("CommitComment", user, body);
        this.commit = commit;
        this.path = path;
    }
}

export class IssueComment extends Comment {
    issue: number;
    constructor(user: string, body: string, issue: number) {
        super("PostComment", user, body);
        this.issue = issue;
    }
}

export class ReviewComment extends Comment {
    id: number;
    reply: number | null;
    diffHunk: string;
    path: string;
    prevCommit: string;
    newCommit: string;
    constructor(user: string, body: string, id: number, reply: number | null, diffHunk: string, path: string, prevCommit: string, newCommit: string) {
        super("ReviewComment", user, body);
        this.id = id;
        this.reply = reply;
        this.diffHunk = diffHunk;
        this.path = path;
        this.prevCommit = prevCommit;
        this.newCommit = newCommit;
    }
}

export class Post {
    type: string;
    id: number;
    title: string;
    body: string;
    comments: Comment[];
    constructor(type: string, id: number, title: string, body: string, comments: Comment[]) {
        this.type = type;
        this.id = id;
        this.title = title;
        this.body = body;
        this.comments = comments;
    }
}