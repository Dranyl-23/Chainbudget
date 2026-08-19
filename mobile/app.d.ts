/// <reference types="nativewind/types" />

declare module 'socket.io-client/dist/socket.io.js' {
  import { io, Socket } from 'socket.io-client';
  export { Socket };
  export default io;
}
