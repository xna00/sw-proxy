import http from 'http'
import https from 'https'
import tls from 'tls'
import constants from 'constants'
import net from 'net'
import EasyCert from 'node-easy-cert'

const options = {
    rootDirPath: '/Users/bytedance/.anyproxy/certificates',
    inMemory: false,
    defaultCertAttrs: [
        { name: 'countryName', value: 'CN' },
        { name: 'organizationName', value: 'AnyProxy' },
        { shortName: 'ST', value: 'SH' },
        { shortName: 'OU', value: 'AnyProxy SSL Proxy' }
    ]
};

const easyCert = new EasyCert(options)

const handler = (req: http.IncomingMessage, res: http.ServerResponse, isHttps = false) => {
    const { url, method, headers } = req
    if (!url) {
        res.writeHead(200)
        res.write(`${url}\n${method}\n${JSON.stringify(headers)}`)
        res.end()
        return
    }
    const tmp = new URL(url)
    console.log(tmp)
    const request = (isHttps ? https : http).request({
        hostname: tmp.hostname,
        path: tmp.pathname + tmp.search,
        method,
        headers: {
            ...headers
        }
    }, (response) => {
        res.writeHead(response.statusCode ?? 500, response.statusMessage, response.headers)
        response.pipe(res, { end: true })
    })
    req.pipe(request, { end: true })
}

const httpServer = http.createServer((req, res) => {
    handler(req, res)
})

httpServer.addListener('connect', (req, socket, headbody) => {
    const host = req.url
    console.log(req.url, req.method)
    socket.write("HTTP/" + req.httpVersion + " 200 Connection established\r\n\r\n");
    const se = https.createServer({
        SNICallback: (serverName, callback) => {
            easyCert.getCertificate(serverName, (err, keyContent, certConcent) => {
                callback(null, tls.createSecureContext({
                    cert: certConcent,
                    key: keyContent,
                }))
            })
        },
        secureOptions: constants.SSL_OP_NO_SSLv3 || constants.SSL_OP_NO_TLSv1
    }, (req, res) => {
        req.url = `https://${host}${req.url}`
        handler(req, res, true)
        se.close()
    })
    // TODO: conflict
    const port = Math.floor(Math.random() * 65535)
    console.log(port)
    se.listen(port)
    const conn = net.connect(port, '127.0.0.1', () => {
        socket.pipe(conn)
        conn.pipe(socket)
    })
})

httpServer.listen(8080)

console.log('http://localhost:8080')