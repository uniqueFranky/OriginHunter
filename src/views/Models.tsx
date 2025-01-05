export class MethodHistory {
    commit: Commit;
    code: string;
    container: string;
    constructor(commit: Object, code: string, container: string) {
      this.commit = new Commit(commit);
      this.code = code;
      this.container = container;
    }
  }
  
  export class Commit {
      hash: string;
      message: string;
      authorDate?: Date;
      authorName?: string;
      authorEmail?: string;
      commitDate?: Date;
  
      constructor(obj: any) {
          this.hash = obj.hash;
          this.message = obj.message;
          this.authorDate = obj.authorDate;
          this.authorName = obj.authorName;
          this.authorEmail = obj.authorEmail;
          this.commitDate = obj.commitDate;
      }
  }