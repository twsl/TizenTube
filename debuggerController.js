import WebSocket from 'ws';
import { readFileSync } from 'node:fs';
import Config from './config.json' assert { type: 'json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function startDebugging(port) {
    // Sleep to get the app to load.
    // For some reason, without it, using the launcher gives an error
    await sleep(5000)
    const debuggerJsonReq = await fetch(`http://${Config.tvIP}:${port}/json`);
    const debuggerJson = await debuggerJsonReq.json();
    return attachDebugger(debuggerJson[0].webSocketDebuggerUrl);
}

async function attachDebugger(wsUrl) {
    const client = await new WebSocket(wsUrl);
    let id = 12;
    let modFile;
    try {
        modFile = readFileSync('mods/dist/userScript.js', 'utf-8');
    } catch {
        console.error('Could not find the built mod file. Did you build it?');
        client.close();
        return;
    }
    client.onmessage = (message) => {
        const msg = JSON.parse(message.data);

        // Future-proof it just incase the page reloads/something happens.
        if (msg.method && msg.method == 'Runtime.executionContextCreated') {
            client.send(JSON.stringify({ "id": id, "method": "Runtime.evaluate", "params": { "expression": modFile, "objectGroup": "console", "includeCommandLineAPI": true, "doNotPauseOnExceptionsAndMuteConsole": false, "contextId": msg.params.context.id, "returnByValue": false, "generatePreview": true } }))
            id++;
        }

        if (Config.debug) {
            if (msg.method == 'Console.messageAdded') {
                console.log(msg.params.message.text, msg.params.message.parameters);
            } else if (msg?.result?.result?.wasThrown) {
                console.error(msg.result.result.description);
            }
        }
    }
    client.onopen = () => {
        if (Config.debug) {
            client.send(JSON.stringify({ "id": 2, "method": "Console.enable" }));
        }

        client.send(JSON.stringify({ "id": 7, "method": "Debugger.enable" }));
        client.send(JSON.stringify({ "id": 11, "method": "Runtime.enable" }));
    }
}

export default startDebugging;