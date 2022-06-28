const configFileName = process.argv?.[2] || ".env";
const path = require("path");
let configPath = path.resolve(__dirname, "/", configFileName);
require("dotenv").config({ path: configPath });

const IO = require("socket.io");
const express = require("express");
const http = require("http");

const main = require("./src/main.ts");
const config = require("./src/configs");

const app = express();
const server = http.createServer(app);
const io = new IO.Server(server);

app.use("/", express.static("public/dist"));

server.listen(config.serverPort, () => {
    console.log("listening on *:" + config.serverPort);
});

main.start(io)
    .then((r) => {
        console.log("main.start() returned: done??", r);
    })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
