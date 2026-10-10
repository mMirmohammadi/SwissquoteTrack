// Separate from the 42-test preserved harness: run with `npm run story`.
// Real Hardhat EVM exposed to the RPC-only story on a temporary loopback port.
const assert = require('node:assert/strict');
const http = require('node:http');
const { network } = require('hardhat');

describe('RPC-only complete local chain story', function () {
  it('creates, pays, cancels, recovers, sweeps and rotates using real chain state', async function () {
    const server = http.createServer(async (req, res) => {
      const chunks=[]; for await(const chunk of req) chunks.push(chunk);
      const handle = async message => {
        try {return {jsonrpc:'2.0',id:message.id,result:await network.provider.request({method:message.method,params:message.params??[]})};}
        catch(error) {return {jsonrpc:'2.0',id:message.id,error:{code:error.code??-32000,message:error.message,data:error.data}};}
      };
      try {
        const message=JSON.parse(Buffer.concat(chunks).toString());
        const result=Array.isArray(message)?await Promise.all(message.map(handle)):await handle(message);
        res.writeHead(200,{'content-type':'application/json'}); res.end(JSON.stringify(result));
      } catch(error) {res.writeHead(400);res.end(JSON.stringify({error:error.message}));}
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    try {
      const { tsImport } = await import('tsx/esm/api');
      const { runStory } = await tsImport('../../scripts/story.ts',__filename);
      const result=await runStory(`http://127.0.0.1:${server.address().port}`);
      assert.equal(result.checks.length,9);
    } finally {await new Promise(resolve=>server.close(resolve));}
  });
});
