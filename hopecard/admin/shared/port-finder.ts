import * as net from "net";

/**
 * Find an available port starting from the given port
 * Tries up to 10 ports before giving up
 */
export async function findAvailablePort(startPort: number): Promise<number> {
  console.log(`🔍 Checking available ports starting from ${startPort}...`);
  for (let port = startPort; port < startPort + 10; port++) {
    const available = await isPortAvailable(port);
    if (available) {
      console.log(`✅ Port ${port} is available`);
      return port;
    }
    console.log(`❌ Port ${port} is in use`);
  }
  throw new Error(
    `Could not find an available port between ${startPort} and ${startPort + 9}`
  );
}

/**
 * Check if a port is available
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        resolve(false);
      } else {
        resolve(false);
      }
    });

    server.once("listening", () => {
      server.close();
      resolve(true);
    });

    server.listen(port);
  });
}
