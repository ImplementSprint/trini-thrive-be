import * as net from 'net';

export async function findAvailablePort(startPort: number): Promise<number> {
  for (let port = startPort; port < startPort + 10; port++) {
    const available = await isPortAvailable(port);
    if (available) return port;
  }
  throw new Error(`No available port found between ${startPort} and ${startPort + 9}`);
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => { server.close(); resolve(true); });
    server.listen(port);
  });
}
