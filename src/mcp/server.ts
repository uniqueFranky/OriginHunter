import express from 'express';
import * as http from 'http';
import * as git from '../git/gitAPI';
import cors from 'cors';

let server: http.Server | undefined;

export function getOrStartServer(port: number): http.Server {
    if(server) {
        return server;
    }
    const app = express();
    app.use(cors({
        origin: '*',
        methods: ['GET', 'POST'],
    }));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));    
    app.get('/', (req, res) => {
        res.send('Hello World!');
    });

    app.post('/file', (req, res) => {
        const { file_path, commit } = req.body;
        console.log('Received file_path:', file_path);
        console.log('Received commit:', commit);
        git.getFileContent(git.getGitRepo(), commit, file_path).then((content) => {
            res.send(content);
        });
    });
    

    server = app.listen(port, () => {
        console.log('Server is running on http://localhost:' + port);
    });
    return server;
}