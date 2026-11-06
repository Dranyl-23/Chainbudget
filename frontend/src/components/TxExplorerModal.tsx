import React, { useState, useEffect, useCallback } from "react";
import { 
  X, ExternalLink, Copy, CheckCircle2, Activity, Box, Clock, 
  ShieldCheck, AlertCircle, RotateCcw 
} from "lucide-react";
import { fetchTxWithFallback, TxDetails } from "@/lib/rpcProvider";
import { getExplorerTxUrl } from "@/lib/config";
import Portal from "@/components/Portal";

interface TxExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  txHash: string;
}

export default function TxExplorerModal({ isOpen, onClose, txHash }: TxExplorerModalProps) {
  const [copied, setCopied] = useState(false);
  const [currentHash, setCurrentHash] = useState<string | null>(null);
  const [txData, setTxData] = useState<TxDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const isScanning = isLoading || (isOpen && Boolean(txHash) && currentHash !== txHash);
  const displayTxData = currentHash === txHash ? txData : null;
  const displayError = currentHash === txHash ? error : null;

  const handleRetry = useCallback(() => {
    setError(null);
    setCurrentHash(null);
    setRetryKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!isOpen || !txHash) return;

    let isCancelled = false;

    const runFetch = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Show scanning animation for at least 1.2s for pleasant UX
        const minWait = new Promise((resolve) => setTimeout(resolve, 1200));
        
        const fetchPromise = fetchTxWithFallback(txHash);
        const [, data] = await Promise.all([minWait, fetchPromise]);

        if (isCancelled) return;

        setTxData(data);
        setError(null);
        setCurrentHash(txHash);
        setIsLoading(false);
      } catch (err: unknown) {
        console.error("Error fetching tx data:", err);
        if (!isCancelled) {
          setError(
            "Public RPC nodes are congested or rate-limited. You can retry with a different node or inspect directly on Polygonscan."
          );
          setCurrentHash(txHash);
          setIsLoading(false);
        }
      }
    };

    void runFetch();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, txHash, retryKey]);

  const handleCopy = () => {
    navigator.clipboard.writeText(txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <Portal>
      <div 
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fade-in overflow-y-auto"
        style={{ background: "rgba(11, 12, 16, 0.75)", backdropFilter: "blur(12px)" }}
      >
        <div className="absolute inset-0" onClick={onClose}></div>

        <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#121215] rounded-2xl p-5 md:p-6 shadow-2xl border border-zinc-800 my-auto">
        
          {/* Header */}
          <div className="flex items-center justify-between mb-5 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <Activity className="w-4 h-4 text-zinc-300" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Blockchain Explorer</h2>
                <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium">Polygon Amoy Testnet</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors" 
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content Area */}
          <div className="relative z-10">
            {isScanning ? (
              <div className="flex flex-col items-center justify-center py-10">
                <div className="w-10 h-10 border-2 border-zinc-700 border-t-white rounded-full animate-spin mb-4" />
                <h3 className="text-sm font-semibold text-white tracking-wide mb-1">Scanning Blockchain</h3>
                <p className="text-xs text-zinc-400 font-mono text-center">
                  Fetching live data for {txHash.slice(0, 8)}...{txHash.slice(-8)}
                </p>
              </div>
            ) : displayError ? (
              <div className="py-6 text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-3">
                  <AlertCircle className="w-6 h-6 text-rose-500" />
                </div>
                <h3 className="text-sm font-semibold text-rose-400 mb-1">Connection Error</h3>
                <p className="text-xs text-zinc-400 mb-5 max-w-sm mx-auto leading-relaxed">{displayError}</p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                  <button 
                    onClick={handleRetry} 
                    className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white transition-colors flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Try Again
                  </button>
                  <a 
                    href={getExplorerTxUrl(txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-lg text-xs font-medium text-white transition-colors flex items-center justify-center gap-1.5"
                  >
                    View on Polygonscan <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button 
                    onClick={onClose} 
                    className="w-full sm:w-auto px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-400 hover:text-white transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : displayTxData ? (
              <div className="space-y-3.5">
                
                {/* Hash & Status Row */}
                <div className="p-3.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Transaction Hash</span>
                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide border ${
                      displayTxData.status === "success" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                      displayTxData.status === "failed" ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                      "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    }`}>
                      {displayTxData.status === "success" && <ShieldCheck className="w-3 h-3" />}
                      {displayTxData.status === "pending" && <Clock className="w-3 h-3 animate-spin" />}
                      {displayTxData.status === "failed" && <AlertCircle className="w-3 h-3" />}
                      {displayTxData.status}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-zinc-200 break-all">{txHash}</span>
                    <button 
                      onClick={handleCopy} 
                      className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors shrink-0" 
                      aria-label="Copy transaction hash"
                    >
                      {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {displayTxData.status !== "pending" && (
                  <>
                    {/* Grid Stats */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex flex-col justify-center">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Box className="w-3.5 h-3.5 text-zinc-400" />
                          <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">Block</span>
                        </div>
                        <span className="text-sm font-semibold text-white font-mono">{displayTxData.blockNumber}</span>
                      </div>
                      <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex flex-col justify-center">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Clock className="w-3.5 h-3.5 text-zinc-400" />
                          <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">Timestamp</span>
                        </div>
                        <span className="text-xs text-zinc-200 leading-tight">{displayTxData.timestamp}</span>
                      </div>
                    </div>

                    {/* Gas & Addresses */}
                    <div className="space-y-2 p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs">
                      <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
                        <span className="text-zinc-400">Gas Fee</span>
                        <span className="font-mono text-zinc-200">{displayTxData.gasFee} POL</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
                        <span className="text-zinc-400">From</span>
                        <span className="font-mono text-zinc-300">
                          {displayTxData.from ? `${displayTxData.from.slice(0, 6)}...${displayTxData.from.slice(-4)}` : "—"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-400">To</span>
                        <span className="font-mono text-zinc-300">
                          {displayTxData.to ? `${displayTxData.to.slice(0, 6)}...${displayTxData.to.slice(-4)}` : "—"}
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {/* Action */}
                <div className="pt-2">
                  <a 
                    href={getExplorerTxUrl(txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-white hover:bg-zinc-200 text-zinc-950 font-semibold rounded-lg text-xs transition-colors"
                  >
                    View on Polygonscan (Amoy) <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Portal>
  );
}
