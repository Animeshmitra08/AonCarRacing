import TcpSocket from "react-native-tcp-socket";

import { utf8Encode } from "./encoding";
import type { TcpServerFactory } from "./tcp";

/** TCP server backed by react-native-tcp-socket (native code: needs a dev build, not Expo Go). */
export const createNativeTcpServer: TcpServerFactory = (port, accept) =>
  new Promise((resolve, reject) => {
    let listening = false;
    const server = TcpSocket.createServer({ noDelay: true }, (socket) => {
      const handlers = accept({
        remoteAddress: socket.remoteAddress,
        write: (bytes) => {
          socket.write(bytes);
        },
        destroy: () => {
          socket.destroy();
        },
      });
      socket.on("data", (data) => handlers.onData(data instanceof Uint8Array ? data : utf8Encode(String(data))));
      socket.on("close", () => handlers.onClose());
      socket.on("error", () => socket.destroy());
    });

    server.on("error", (error) => {
      if (!listening) reject(error);
    });
    server.listen({ port, host: "0.0.0.0", reuseAddress: true }, () => {
      listening = true;
      resolve({
        close: () => {
          server.close();
        },
      });
    });
  });
