import express from 'express';
import * as http from 'http';
import { Post } from '../views/github/utils';


let server: http.Server | undefined;

export function getOrStartServer(port: number): http.Server {
    if(server) {
        return server;
    }
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));    
    app.get('/', (req, res) => {
        res.send('Hello World!');
    });

    

    server = app.listen(port, () => {
        console.log('Server is running on http://localhost:' + port);
    });
    return server;
}