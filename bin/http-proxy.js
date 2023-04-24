#!/usr/bin/env node

const argValueRE = /=(\S+)$/

const http = require('http'),
  https = require('https'),
  uri = require('url')

let target = ''
let port = ''
process.argv.forEach((arg) => {
  switch (true) {
    case /^-t=\S+/.test(arg):
    case /^--target=\S+/.test(arg):
      target = arg.match(argValueRE)[1]
      break
    case /^-p=\S+/.test(arg):
    case /^--port=\S+/.test(arg):
      port = arg.match(argValueRE)[1]
      break
  }
})

if (!target) {
  console.log(
    `
Usage: http-proxy (--target|-t)=Target (--port|-p)=Local Port
Example: http-proxy --target=https://example.org --local=8000`.trim()
  )
  process.exit()
}
if (!port) port = '8000'

const { target: TARGET, port: SERVER_PORT } = { target, port }

var server = http.createServer()

server.on('request', function (req, rsp) {
  delete req.headers['host']
  delete req.headers['referer']
  delete req.headers['origin']
  if (req.method === 'OPTIONS')
    return rsp
      .writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': '*',
      })
      .end()

  var url = uri.parse(TARGET + req.url)
  var proxy = (/^https/.test(TARGET) ? https : http).request(
    {
      ...url,
      method: req.method,
      headers: req.headers,
    },
    function (proxyRsp) {
      // CORS
      rsp.setHeader('Access-Control-Allow-Origin', '*')
      rsp.setHeader('Access-Control-Allow-Headers', '*')
      rsp.setHeader('Access-Control-Allow-Methods', '*')
      // Pipe Header
      for (var key in proxyRsp.headers) {
        rsp.setHeader(key, proxyRsp.headers[key])
      }
      rsp.writeHead(proxyRsp.statusCode)
      // pipe response data
      proxyRsp
        .on('data', function (chunk) {
          rsp.write(chunk)
        })
        .on('end', function () {
          rsp.end()
        })
    }
  )
  // 500 if proxy error
  proxy.once('error', function (e) {
    console.error('Proxy error:', e.toString())
    rsp.writeHead(500).end()
  })
  // if client close response unexpectedly
  rsp.on('close', function () {
    proxy.destroy()
  })
  // pipe data: request -> proxy request
  req.on('data', (chunk) => proxy.write(chunk)).on('end', () => proxy.end())
})

server.listen(SERVER_PORT)
