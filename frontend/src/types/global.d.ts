// Extends the browser Window type to include MetaMask's injected ethereum provider
interface EthereumProvider {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  selectedAddress?: string;
  chainId?: string;
  providers?: EthereumProvider[];
}

interface Window {
  ethereum?: EthereumProvider;
}
