import http from "http";
import https from "https";
import tls from "tls";
import constants from "constants";
import net from "net";
import fs from "fs";
import path from "path";
import os from "os";
import EasyCert from "node-easy-cert";

const rootDirPath = path.join(os.homedir(), "/.anyproxy/certificates");

const options = {
  rootDirPath,
  inMemory: false,
  defaultCertAttrs: [
    { name: "countryName", value: "CN" },
    { name: "organizationName", value: "AnyProxy" },
    { shortName: "ST", value: "SH" },
    { shortName: "OU", value: "AnyProxy SSL Proxy" },
  ],
};

const easyCert = new EasyCert(options);

if (!easyCert.isRootCAFileExists()) {
  fs.mkdirSync(rootDirPath, {
    recursive: true,
  });
  easyCert.generateRootCA({
    commonName: "AnyProxy",
  });
}

const PRESHARED_AUTH_HEADER_KEY = "X-Custom-PSK";
const PRESHARED_AUTH_HEADER_VALUE = process.argv[2] || "sfiejhr9p8quw";

const hostnames: { hostname: string; count: number }[] = [
  { hostname: "test.xna00.workers.dev", count: 0 },
  { hostname: "one.xna00.workers.dev", count: 0 },
  { hostname: "two.xna00.workers.dev", count: 0 },
];

const handler = (req: http.IncomingMessage, res: http.ServerResponse) => {
  const { url, method, headers } = req;
  if (!url) {
    res.writeHead(200);
    res.write(`${url}\n${method}\n${JSON.stringify(headers)}`);
    res.end();
    return;
  }
  const path =
    "/" +
    Buffer.from(url).toString("base64").replace(/\//g, "_").replace(/\+/g, "-");
  delete headers.host;
  //   delete headers["content-length"];
  delete headers.connection;
  const tmp = hostnames.sort((a, b) => a.count - b.count)[0];
  tmp.count++;
  const hostname = tmp.hostname;
  console.log(hostname, tmp.count);

  const request = https.request(
    {
      hostname,
      path,
      method,
      headers: {
        ...headers,
        [PRESHARED_AUTH_HEADER_KEY]: PRESHARED_AUTH_HEADER_VALUE,
      },
    },
    (response) => {
      res.writeHead(
        response.statusCode ?? 500,
        response.statusMessage,
        response.headers
      );
      response.pipe(res, { end: true });
      res.on("error", (e) => {
        console.log("res", e);
      });
      response.on("error", (e) => {
        console.log("response", e);
      });
    }
  );
  req.pipe(request, { end: true });
  req.on("error", (e) => {
    console.log("req", e);
  });
  request.on("error", (e) => {
    console.log("request", e);
    res.end();
  });
};

const httpServer = http.createServer((req, res) => {
  handler(req, res);
});

httpServer.addListener("connect", (req, socket, headbody) => {
  const host = req.url;
  console.log(req.url, req.method);
  socket.write(
    "HTTP/" + req.httpVersion + " 200 Connection established\r\n\r\n"
  );
  const se = https.createServer(
    {
      SNICallback: (serverName, callback) => {
        easyCert.getCertificate(serverName, (err, keyContent, certConcent) => {
          callback(
            null,
            tls.createSecureContext({
              cert: certConcent,
              key: keyContent,
            })
          );
        });
      },
      secureOptions: constants.SSL_OP_NO_SSLv3 || constants.SSL_OP_NO_TLSv1,
    },
    (req, res) => {
      req.url = `https://${host}${req.url}`;
      handler(req, res);
      se.close();
    }
  );

  se.listen(0);
  se.setTimeout(0);
  const conn = net.connect(
    (se.address() as net.AddressInfo).port,
    "127.0.0.1",
    () => {
      socket.pipe(conn);
      conn.pipe(socket);
      socket.on("error", (e) => {
        console.log("socket", e);
      });
      conn.on("error", (e) => {
        console.log("conn", e);
      });
    }
  );
});

httpServer.listen(8080);
httpServer.setTimeout(0);

console.log("http://localhost:8080");
