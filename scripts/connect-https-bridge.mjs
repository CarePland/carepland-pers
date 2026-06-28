#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:https";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { request } from "node:http";
import net from "node:net";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const targetHost = process.env.CONNECT_HTTPS_TARGET_HOST || "127.0.0.1";
const targetPort = Number(process.env.CONNECT_HTTPS_TARGET_PORT || 3000);
const bridgeHost = process.env.CONNECT_HTTPS_HOST || "0.0.0.0";
const bridgePort = Number(process.env.CONNECT_HTTPS_PORT || 3001);
const lanHost = process.env.CONNECT_HTTPS_LAN_HOST || firstLanHost() || "localhost";
const certDir = path.join(rootDir, "certificates");
const certPath = path.join(certDir, "connect-dev.pem");
const keyPath = path.join(certDir, "connect-dev-key.pem");

ensureCertificate();

const options = {
  cert: readFileSync(certPath),
  key: readFileSync(keyPath),
};

const server = createServer(options, (incoming, outgoing) => {
  const proxy = request(
    {
      headers: {
        ...incoming.headers,
        host: `${lanHost}:${bridgePort}`,
        "x-forwarded-host": `${lanHost}:${bridgePort}`,
        "x-forwarded-proto": "https",
      },
      hostname: targetHost,
      method: incoming.method,
      path: incoming.url,
      port: targetPort,
    },
    (upstream) => {
      outgoing.writeHead(upstream.statusCode || 502, upstream.headers);
      upstream.pipe(outgoing);
    }
  );

  proxy.on("error", (error) => {
    outgoing.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    outgoing.end(
      [
        "CarePland Connect HTTPS bridge could not reach the app.",
        `Target: http://${targetHost}:${targetPort}`,
        `Error: ${error.message}`,
        "Start the app first with: npm run dev",
      ].join("\n")
    );
  });

  incoming.pipe(proxy);
});

server.on("upgrade", (incoming, socket, head) => {
  const upstream = net.connect(targetPort, targetHost, () => {
    upstream.write(`${incoming.method} ${incoming.url} HTTP/${incoming.httpVersion}\r\n`);
    for (const [key, value] of Object.entries(incoming.headers)) {
      upstream.write(`${key}: ${value}\r\n`);
    }
    upstream.write("\r\n");
    if (head.length) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });

  upstream.on("error", () => socket.destroy());
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${bridgePort} is already in use.`);
  } else {
    console.error(error);
  }
  process.exit(1);
});

server.listen(bridgePort, bridgeHost, () => {
  console.log("CarePland Connect HTTPS bridge is ready.");
  console.log(`Dashboard: https://${lanHost}:${bridgePort}/connect/dashboard`);
  console.log(`Receiver:  https://${lanHost}:${bridgePort}/connect/receiver`);
  console.log(`Target:    http://${targetHost}:${targetPort}`);
  console.log("If the phone shows a privacy warning, continue to the site for dev testing.");
});

function ensureCertificate() {
  if (existsSync(certPath) && existsSync(keyPath)) return;

  mkdirSync(certDir, { recursive: true });
  const sanEntries = [
    `IP:${lanHost}`,
    "DNS:localhost",
    "IP:127.0.0.1",
  ].join(",");

  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      keyPath,
      "-out",
      certPath,
      "-days",
      "30",
      "-subj",
      `/CN=${lanHost}`,
      "-addext",
      `subjectAltName=${sanEntries}`,
    ],
    { stdio: "ignore" }
  );
}

function firstLanHost() {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses || []) {
      if (
        address.family === "IPv4" &&
        !address.internal &&
        /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(address.address)
      ) {
        return address.address;
      }
    }
  }
  return "";
}
